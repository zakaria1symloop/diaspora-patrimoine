// Package 3.7 through the screens: open a dossier (PIP-015), the window « Marquer comme qualifié » lists what is missing
// and completes the record in one gesture (CYC-021, CRM-050), the panel « Proposer des biens » sends a proposal
// (PIP-031), pause and resumption (CYC-031, CYC-032), closing and reopening (CYC-035, CYC-036).
import { expect, test, type Locator } from '@playwright/test';
import { signUpClient } from './helpers/account.js';
import { ADMIN, adminPost, signInDirection } from './helpers/admin.js';

async function fillIfVisible(dialog: Locator, label: string, value: string | { index: number }) {
  const field = dialog.getByLabel(label, { exact: true });
  if (!(await field.count()) || !(await field.isVisible())) return;
  if (typeof value === 'string') await field.fill(value);
  else await field.selectOption(value);
}

test.describe('PIP-015, CYC-021, PIP-031, CYC-031, CYC-035 — a dossier through its screens', () => {
  test.skip(({ isMobile }) => isMobile, 'the back office is designed for 1280 px and more (TRV-130)');

  test('open, qualify, propose, pause, resume, close, reopen', async ({ browser, page }) => {
    test.setTimeout(300_000);
    const clientPage = await (await browser.newContext()).newPage();
    const { email } = await signUpClient(clientPage, 'Nadia');
    await signInDirection(page);

    // PIP-015 — three steps and what will happen, then the record
    await page.goto(`${ADMIN}/dossiers/nouveau`);
    await page.getByLabel('Nom, e-mail ou téléphone').fill(email);
    await page.getByRole('button', { name: /Nadia/ }).first().click();
    await page.getByRole('radio', { name: /Avec financement/ }).click();
    await expect(page.getByText('Il est pris en charge aussitôt : étape « Qualification ».')).toBeVisible();
    await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();
    await page.waitForURL(/\/dossiers\/dos-/);
    const reference = page.url().split('/dossiers/')[1]!.split('?')[0]!.toUpperCase();
    const dossier = await (await page.request.get(`${ADMIN}/api/v1/admin/dossiers/${reference}`)).json();

    // CYC-021 — without first contact the window says what is missing and cannot qualify
    await page.getByRole('button', { name: 'Marquer comme qualifié' }).click();
    let dialog = page.getByRole('dialog', { name: new RegExp(`^Qualifier le projet.*${reference}$`) });
    await expect(dialog.locator('[data-condition="FIRST_CONTACT"]')).toHaveAttribute('data-state', 'missing');
    await expect(dialog.getByRole('button', { name: 'Marquer comme qualifié' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Annuler' }).click();

    // A call held now is the first contact (TAC-044, CYC-004)
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const part = (k: string) => parts.find((x) => x.type === k)!.value;
    await page.waitForTimeout(1100);
    const call = await adminPost(page, page.request, '/admin/appointments', { clientId: dossier.client.id, dossierId: dossier.id, type: 'CALL', date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}`, durationMinutes: 5, zone: 'Europe/Paris' });
    expect(call.status()).toBe(201);

    // CRM-050 — the window completes the record and qualifies in one gesture
    await page.reload();
    await page.getByRole('button', { name: 'Marquer comme qualifié' }).click();
    dialog = page.getByRole('dialog', { name: new RegExp(`^Qualifier le projet.*${reference}$`) });
    await expect(dialog.locator('[data-condition="FIRST_CONTACT"]')).toHaveAttribute('data-state', 'met');
    await fillIfVisible(dialog, 'Pays de résidence', { index: 1 });
    await fillIfVisible(dialog, 'Situation de résidence', { index: 1 });
    await fillIfVisible(dialog, 'Budget total', '180000');
    await fillIfVisible(dialog, 'Apport', '30000');
    await fillIfVisible(dialog, 'Financement souhaité', { index: 1 });
    await fillIfVisible(dialog, 'Horizon d’achat', { index: 1 });
    await dialog.getByRole('button', { name: 'Marquer comme qualifié' }).click();
    await expect(page.getByText('Projet qualifié : place au rapprochement.')).toBeVisible();

    // PIP-031 — the panel on the right: tick one property, send it
    await page.goto(`${ADMIN}/dossiers/${reference.toLowerCase()}?onglet=biens`);
    await page.getByRole('button', { name: 'Proposer des biens' }).first().click();
    const panel = page.getByRole('dialog', { name: 'Proposer des biens' });
    await expect(panel).toBeVisible();
    await panel.locator('input[type="checkbox"]:not([disabled])').first().check();
    await panel.getByRole('button', { name: 'Proposer et envoyer 1 bien' }).click();
    await expect(page.getByText(/1 bien (envoyé au client|proposé)/)).toBeVisible();

    // CYC-031, CYC-032 — pause, then « Reprendre le dossier »
    await page.getByRole('button', { name: 'Autres actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Mettre en pause' }).click();
    dialog = page.getByRole('dialog', { name: new RegExp(`^Mettre en pause.*${reference}$`) });
    await dialog.getByLabel('Motif').selectOption({ index: 1 });
    await dialog.getByRole('button', { name: 'Mettre en pause' }).click();
    await expect(page.getByText('Dossier mis en pause.')).toBeVisible();
    await page.getByRole('button', { name: 'Reprendre le dossier' }).first().click();
    await page.getByRole('dialog', { name: new RegExp(`^Reprendre.*${reference}$`) }).getByRole('button', { name: 'Reprendre' }).click();
    await expect(page.getByText('Dossier repris.')).toBeVisible();

    // CYC-035, CYC-036 — closing, then reopening with a reason
    await page.getByRole('button', { name: 'Autres actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Clôturer' }).click();
    dialog = page.getByRole('dialog', { name: new RegExp(`^Clôturer.*${reference}$`) });
    await dialog.getByLabel('Motif').selectOption('BUDGET');
    await dialog.getByRole('button', { name: 'Clôturer' }).click();
    await expect(page.getByText('Dossier clôturé.')).toBeVisible();
    await page.getByRole('button', { name: 'Autres actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Rouvrir' }).click();
    dialog = page.getByRole('dialog', { name: new RegExp(`^Rouvrir.*${reference}$`) });
    await dialog.getByLabel('Raison').fill('Le client revient vers nous.');
    await dialog.getByRole('button', { name: 'Rouvrir' }).click();
    await expect(page.getByText('Dossier rouvert.')).toBeVisible();
    const back = await (await page.request.get(`${ADMIN}/api/v1/admin/dossiers/${reference}`)).json();
    expect(back).toMatchObject({ status: 'OPEN', stage: 'MATCHING' });
  });
});
