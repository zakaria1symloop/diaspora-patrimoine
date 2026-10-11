// Packages 3.7 and 3.8 through the screens of the back office: the tab « Tâches » of a dossier (TAC-031) creates a task
// (TAC-003) and an appointment (TAC-040); one click completes the task and « Annuler » reopens it (TAC-005); the tasks
// screen shows it in « Terminées » (TAC-002); the agenda shows the appointment, opens it on the right and cancels it
// (TAC-035, TAC-042).
import { expect, test, type Page } from '@playwright/test';
import type { ClientPick, DossierCreated } from '@dp/contracts';
import { signUpClient } from './helpers/account.js';
import { ADMIN, adminPost, signInDirection } from './helpers/admin.js';

const parisDay = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() + offset * 86_400_000));

async function openDossier(admin: Page, email: string): Promise<DossierCreated> {
  const clients = await (await admin.request.get(`${ADMIN}/api/v1/admin/dossiers/pickers/clients?q=${encodeURIComponent(email)}`)).json();
  const client = (clients.data as ClientPick[])[0]!;
  const created = await adminPost(admin, admin.request, '/admin/dossiers', { clientId: client.id, propertyId: null, financingRequested: true });
  expect(created.status(), await created.text()).toBe(201);
  return (await created.json()) as DossierCreated;
}

test.describe('TAC-031, TAC-003, TAC-005, TAC-040, TAC-042 — tasks and appointments from a dossier', () => {
  test.skip(({ isMobile }) => isMobile, 'the back office is designed for 1280 px and more (TRV-130)');

  test('a task created, completed, undone and found again; an appointment planned, seen in the agenda, cancelled', async ({ browser, page }) => {
    test.setTimeout(240_000);
    const clientPage = await (await browser.newContext()).newPage();
    const { email } = await signUpClient(clientPage, 'Nadia');
    await signInDirection(page);
    const { reference, id: dossierId } = await openDossier(page, email);
    const tomorrow = parisDay(1);
    const title = `Rappeler pour le budget ${reference}`;

    // TAC-031, TAC-003 — the window, opened from the tab, attaches the task to the dossier
    await page.goto(`${ADMIN}/dossiers/${reference.toLowerCase()}?onglet=taches`);
    await page.getByRole('button', { name: 'Tâche', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' });
    await expect(dialog.getByText(`Dossier ${reference}`)).toBeVisible({ timeout: 20_000 });
    await dialog.getByLabel('Intitulé').fill(title);
    await dialog.getByLabel(/^Échéance/).fill(tomorrow);
    await dialog.getByRole('button', { name: 'Créer la tâche' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: /Demain/ })).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();

    // TAC-005 — one click completes it, « Annuler » reopens it, a second click completes it again
    await page.getByRole('button', { name: `Terminer « ${title} »` }).click();
    await page.getByRole('status').filter({ hasText: 'Tâche terminée.' }).getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('button', { name: `Terminer « ${title} »` })).toBeVisible();
    await page.getByRole('button', { name: `Terminer « ${title} »` }).click();
    await expect(page.getByText(title)).toBeHidden();

    // TAC-002 — the tasks screen, « Terminées »
    await page.goto(`${ADMIN}/taches?view=done`);
    await expect(page.getByRole('tab', { name: /Terminées/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(title)).toBeVisible();

    // TAC-040 — an appointment from the tab: the client and the dossier are fixed
    await page.goto(`${ADMIN}/dossiers/${reference.toLowerCase()}?onglet=taches`);
    await page.getByRole('button', { name: 'Rendez-vous', exact: true }).click();
    const win = page.getByRole('dialog', { name: 'Nouveau rendez-vous' });
    await expect(win.getByText(/Nadia/).first()).toBeVisible({ timeout: 20_000 });
    await win.getByLabel('Date').fill(tomorrow);
    await win.getByLabel('Heure', { exact: true }).fill('10:00');
    await expect(win.getByText('Chez moi')).toBeVisible();
    await win.getByRole('button', { name: 'Créer le rendez-vous' }).click();
    await expect(win).toBeHidden();
    await expect(page.getByRole('heading', { name: /Rendez-vous du dossier/ })).toBeVisible();

    // TAC-035, TAC-042 — the agenda of that day shows it; opened on the right, it is cancelled there
    const planned = await (await page.request.get(`${ADMIN}/api/v1/admin/appointments?view=upcoming&dossierId=${dossierId}`)).json();
    const appointmentId = planned.data[0].id as string;
    await page.goto(`${ADMIN}/agenda?vue=jour&date=${tomorrow}`);
    const block = page.locator('button[class*="__event"]').filter({ hasText: /10 h 00/ }).filter({ hasText: /Nadia/ });
    await expect(block.first()).toBeVisible();
    await page.goto(`${ADMIN}/agenda?vue=jour&date=${tomorrow}&rdv=${appointmentId}`);
    await expect(page.locator('button[class*="__eventOn"]')).toBeVisible();
    const panel = page.getByRole('complementary', { name: 'Détail du rendez-vous' });
    await expect(panel.getByText('Confirmé')).toBeVisible();
    await expect(panel.getByRole('link', { name: reference })).toBeVisible();
    await panel.getByRole('button', { name: 'Autres actions' }).click();
    await page.getByRole('menuitem', { name: 'Annuler le rendez-vous' }).click();
    await panel.getByLabel(/^Motif/).fill('Le client préfère la semaine prochaine.');
    await panel.getByRole('button', { name: 'Annuler le rendez-vous' }).click();
    await expect(panel.getByText('Annulé', { exact: true })).toBeVisible();
    await expect(panel.getByText('Le client préfère la semaine prochaine.')).toBeVisible();
  });
});
