// INT-040, INT-041, INT-042, INT-044, CYC-080 (package A.8) — the client asks for a visit from « Mes intérêts »
// (INT-004), changes his wishes, the team confirms it, he finds it confirmed with its calendar file, then cancels it.
// Real flows and the real API: the client is created through the sign-up and given the demonstration's followed
// dossier (`demo -- --suivi-pour=`, PAR-082: qualified, properties proposed and sent by the back office's use cases).
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import type { AppointmentList, ClientAppointments, ClientInterests, TaskList } from '@dp/contracts';
import { freshIp, signUpClient } from './helpers/account.js';
import { ADMIN, adminPost, signInDirection } from './helpers/admin.js';
import { api } from './helpers/space-api.js';

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'api');

/** PAR-082 — the followed dossier of the demonstration for this account. */
function followedDossierFor(email: string): void {
  execFileSync(process.execPath, ['--env-file=.env', 'dist/install/demo.js', `--suivi-pour=${email}`], { cwd: API_DIR, stdio: 'pipe', timeout: 180_000 });
}

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

async function until<T>(read: () => Promise<T>, ok: (v: T) => boolean, label: string): Promise<T> {
  for (let i = 0; i < 40; i++) {
    const v = await read();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`timeout: ${label}`);
}

async function clientWithProposals(page: Page): Promise<void> {
  await freshIp(page);
  const { email } = await signUpClient(page);
  followedDossierFor(email);
  await page.goto('/espace-client/biens-proposes');
}

test.describe('INT-040 … INT-042 — the client asks for a visit', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('INT-040, INT-041, INT-042, CYC-080 — request, wishes, confirmation by the team, calendar, cancellation', async ({ page, browser }) => {
    test.setTimeout(300_000);
    await clientWithProposals(page);
    // A property the client is interested in.
    await page.getByRole('button', { name: /^Ce bien m’intéresse/ }).first().click();
    await page.getByRole('dialog', { name: 'Ce bien m’intéresse' }).getByRole('button', { name: 'Envoyer ma réponse' }).click();
    await expect(page.getByText(/est prévenu\./).first()).toBeVisible();

    // INT-004 « Demander une visite » from « Mes intérêts » opens the request on that property.
    await page.goto('/espace-client/interets');
    await page.getByRole('link', { name: /Demander une visite/ }).first().click();
    await expect(page).toHaveURL(/\/espace-client\/rendez-vous/);
    await expect(page.getByRole('button', { name: 'Envoyer ma demande' })).toBeVisible();
    await page.locator('input[type="date"]').first().fill(day(3));
    await page.locator('select').nth(1).selectOption('MORNING');
    await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
    const requested = page.locator('[data-appointment="REQUESTED"]');
    await expect(requested).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Envoyer ma demande' })).toHaveCount(0); // the panel does not come back

    // INT-040 — the API keeps its rules: a wish beyond 60 days; a second request on the same property.
    const interests = (await (await api(page, 'GET', '/client/interests')).json()) as ClientInterests;
    const candidate = interests.properties.find((c) => c.status === 'VISIT_REQUESTED');
    expect(candidate, 'the property moved to VISIT_REQUESTED (CYC-070)').toBeTruthy();
    const far = await api(page, 'POST', '/client/appointments', { type: 'CALL', slots: [{ date: day(90), slot: 'MORNING' }] });
    expect(far.status()).toBe(422);
    const twice = await api(page, 'POST', '/client/appointments', { type: 'PROPERTY_VISIT', candidateId: candidate!.id, slots: [{ date: day(4), slot: 'NOON' }] });
    expect(twice.status()).toBe(409);
    expect((await twice.json()).error.reason).toBe('APPOINTMENT_PENDING');

    // INT-041 « Modifier mes souhaits ».
    await requested.getByRole('button', { name: 'Modifier mes souhaits' }).click();
    await page.locator('select').last().selectOption('EVENING');
    await page.getByRole('button', { name: 'Enregistrer mes souhaits' }).click();
    await expect(requested.getByText(/Le soir/)).toBeVisible();

    // CYC-080 — the adviser has the task « Confirmer le rendez-vous demandé » and confirms (TAC-041).
    const mine = ((await (await api(page, 'GET', '/client/appointments')).json()) as ClientAppointments).upcoming.find((a) => a.status === 'REQUESTED')!;
    const team = await browser.newPage();
    await signInDirection(team);
    await until(
      async () => (await (await team.request.get(`${ADMIN}/api/v1/admin/appointments?view=to-confirm`)).json()) as AppointmentList,
      (l) => l.data.some((x) => x.id === mine.id),
      'appointment to confirm',
    );
    const tasks = await until(
      async () => (await (await team.request.get(`${ADMIN}/api/v1/admin/tasks?view=team&q=${encodeURIComponent('Confirmer le rendez-vous')}`)).json()) as TaskList,
      (l) => l.data.some((x) => x.title.startsWith('Confirmer le rendez-vous demandé')),
      'R_APPOINTMENT_CONFIRM task',
    );
    expect(tasks.data.length).toBeGreaterThan(0);
    const confirm = await adminPost(team, team.request, `/admin/appointments/${mine.id}/confirm`, { date: day(3), time: '15:00', zone: 'Africa/Algiers', durationMinutes: 60, location: 'Sur place' });
    expect(confirm.status()).toBe(200);
    await team.close();

    // INT-041 — confirmed: its time in the place's zone, « Ajouter à mon agenda » (.ics).
    await page.reload();
    // the followed dossier of the demonstration has its own appointments: this one is found by its id
    const confirmed = page.locator(`[data-appointment-id="${mine.id}"]`);
    await expect(confirmed).toHaveAttribute('data-appointment', 'CONFIRMED');
    await expect(confirmed.getByText(/15 h 00/)).toBeVisible();
    const href = await confirmed.getByRole('link', { name: 'Ajouter à mon agenda' }).getAttribute('href');
    const ics = await page.request.get(href!);
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain('BEGIN:VEVENT');

    // INT-042 — cancelled by the client, with an optional reason.
    await confirmed.getByRole('button', { name: 'Annuler' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Annuler le rendez-vous' }).click();
    await expect(page.locator(`[data-appointment-id="${mine.id}"]`)).toHaveAttribute('data-appointment', 'CANCELLED');
    const after = (await (await api(page, 'GET', '/client/appointments')).json()) as ClientAppointments;
    expect(after.past.find((a) => a.id === mine.id)?.cancelledBy).toBe('CLIENT');
  });
});
