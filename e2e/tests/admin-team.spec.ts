// Back office — the team (EA-96, package 1.9): ADM-030 list, invitation (send, duplicate address, resend, cancel),
// function, role, suspension and reactivation; ROL-010 / ROL-011 refusals; what a role that cannot manage sees.
// Every account is created by the real « Inviter » window; an invitation that is not followed is cancelled at the end
// (the account is then deleted by the use case, MOD-100) — nothing is left behind.
import { expect, test, type Page } from '@playwright/test';
import { mailLink } from './helpers/account.js';
import { ADMIN, adminPost, signInDirection } from './helpers/admin.js';

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function invite(page: Page, m: { firstName: string; lastName: string; email: string; role: string }) {
  await page.getByRole('button', { name: 'Inviter' }).click();
  const dialog = page.getByRole('dialog', { name: 'Inviter un membre de l’équipe' });
  await dialog.getByLabel('Prénom').fill(m.firstName);
  await dialog.getByLabel('Nom', { exact: true }).fill(m.lastName);
  await dialog.getByLabel('E-mail').fill(m.email);
  await dialog.getByLabel('Rôle').selectOption({ label: m.role });
  await dialog.getByRole('button', { name: 'Envoyer l’invitation' }).click();
  return dialog;
}

const row = (page: Page, email: string) => page.getByRole('row').filter({ hasText: email });
const act = async (page: Page, email: string, action: string) => {
  await row(page, email).getByRole('button', { name: /^Actions sur le compte/ }).click();
  await page.getByRole('menuitem', { name: action }).click();
};

test.describe('back office — team', () => {
  test.skip(({ isMobile }) => isMobile, 'the back office is designed for 1280 px and more (TRV-130)');

  test('ADM-030 — invite, duplicate address, resend, function, cancel', async ({ page }) => {
    await signInDirection(page);
    await page.goto(`${ADMIN}/equipe`);
    await expect(page.getByRole('heading', { name: 'Équipe', level: 1 })).toBeVisible();
    // ADM-030 columns; « Reçoit des demandes » came with package 3.2
    for (const name of ['Nom', 'E-mail', 'Rôle', 'État', 'Double authentification', 'Dernière connexion', 'Reçoit des demandes']) await expect(page.getByRole('columnheader', { name })).toBeVisible();

    // TRV-114 — a form sent with several errors: the summary and the messages under the fields
    await page.getByRole('button', { name: 'Inviter' }).click();
    const empty = page.getByRole('dialog', { name: 'Inviter un membre de l’équipe' });
    await empty.getByRole('button', { name: 'Envoyer l’invitation' }).click();
    await expect(empty.getByText(/points sont à corriger avant d’envoyer/)).toBeVisible();
    await page.keyboard.press('Escape');

    const email = `staff-${unique()}@example.test`;
    await invite(page, { firstName: 'Amel', lastName: 'Testeuse', email, role: 'Conseiller' });
    await expect(page.getByText('Invitation envoyée.')).toBeVisible();
    await expect(row(page, email)).toContainText('Invité');
    await expect(row(page, email)).toContainText('Conseiller');
    // « — » for the second factor of an invited account
    await expect(row(page, email).getByRole('cell').nth(4)).toHaveText('—');
    // S_INVITATION leads to the back office host (BO-003)
    const first = await mailLink(email, 'S_INVITATION', /http:\/\/localhost:3001\/invitation\/[A-Za-z0-9_-]+/);

    // ROL-003 — one address, one account
    const dup = await invite(page, { firstName: 'Autre', lastName: 'Personne', email, role: 'Lecture seule' });
    await expect(dup.getByText('Cette valeur est déjà utilisée.')).toBeVisible();
    await page.keyboard.press('Escape');

    // « Modifier la fonction »
    await act(page, email, 'Modifier la fonction');
    await page.getByRole('dialog').getByLabel(/^Fonction/).fill('Conseillère en financement');
    await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Modifications enregistrées.')).toBeVisible();

    // « Renvoyer l'invitation » — a new link that kills the previous one (MOD-105)
    await act(page, email, 'Renvoyer l’invitation');
    await page.getByRole('dialog').getByRole('button', { name: 'Renvoyer l’invitation' }).click();
    await expect(page.getByText('Nouvelle invitation envoyée.')).toBeVisible();
    let second = first;
    for (let i = 0; i < 30 && second === first; i++) {
      await page.waitForTimeout(500);
      second = await mailLink(email, 'S_INVITATION', /http:\/\/localhost:3001\/invitation\/[A-Za-z0-9_-]+/);
    }
    expect(second).not.toBe(first);
    const stale = await page.context().browser()!.newContext();
    const other = await stale.newPage();
    await other.goto(first);
    await expect(other.getByText(/Ce lien a expiré ou a déjà été utilisé/)).toBeVisible({ timeout: 30_000 });
    await stale.close();

    // an invited account is not suspended: its invitation is resent or cancelled
    await row(page, email).getByRole('button', { name: /^Actions sur le compte/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Suspendre' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // filter chip « État : Invité » applies without any button, and the address carries it (TRV-101)
    await page.getByRole('group').getByRole('button', { name: 'État' }).click();
    await page.getByRole('dialog', { name: 'État' }).getByLabel(/Invité/).check();
    await expect(page).toHaveURL(/status=INVITED/);
    await expect(row(page, email)).toBeVisible();
    await expect(row(page, 'direction.test@example.test')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // « Annuler l'invitation » — the confirmation names the account (TRV-095); the account leaves the list
    await act(page, email, 'Annuler l’invitation');
    await expect(page.getByRole('dialog').getByText(/Annuler l’invitation de Amel Testeuse/)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Annuler l’invitation' }).click();
    await expect(page.getByText('Invitation annulée.')).toBeVisible();
    await expect(row(page, email)).toHaveCount(0);
    const dead = await page.context().browser()!.newContext();
    const deadPage = await dead.newPage();
    await deadPage.goto(second);
    await expect(deadPage.getByText(/Ce lien a expiré ou a déjà été utilisé/)).toBeVisible({ timeout: 30_000 });
    await dead.close();
  });

  test('ROL-010, ROL-011 — no action on one’s own account; the API refuses what the screen hides', async ({ page, request }) => {
    await signInDirection(page);
    await page.goto(`${ADMIN}/equipe`);
    const me = row(page, 'direction.test@example.test');
    await expect(me).toContainText('(vous)');
    // on his own line: only the function
    await me.getByRole('button', { name: /^Actions sur le compte/ }).click();
    await expect(page.getByRole('menuitem')).toHaveCount(1);
    await expect(page.getByRole('menuitem', { name: 'Modifier la fonction' })).toBeVisible();
    await page.keyboard.press('Escape');

    const list = await page.request.get(`${ADMIN}/api/v1/admin/users?q=direction.test`);
    const self = ((await list.json()) as { data: { id: string; isSelf: boolean }[] }).data.find((m) => m.isSelf)!;
    const demote = await adminPost(page, request, `/admin/users/${self.id}/change-role`, { role: 'AGENT' });
    expect(demote.status()).toBe(409);
    expect(((await demote.json()) as { error: { reason: string } }).error.reason).toBe('OWN_ACCOUNT');
    const suspend = await adminPost(page, request, `/admin/users/${self.id}/suspend`, { reason: 'test' });
    expect(suspend.status()).toBe(409);
    // API-011 — an unknown parameter is refused; SEC-027 — a write without the anti-forgery token too
    expect((await page.request.get(`${ADMIN}/api/v1/admin/users?inconnu=1`)).status()).toBe(400);
    const forged = await page.request.post(`${ADMIN}/api/v1/admin/users/invite`, { data: {}, headers: { Origin: ADMIN } });
    expect(forged.status()).toBe(403);
    // SEC-030 — the routes of the back office are not reachable from the public site's origin
    const fromSite = await request.get('http://localhost:3000/api/v1/admin/users');
    expect(fromSite.status()).toBe(401);
  });
});
