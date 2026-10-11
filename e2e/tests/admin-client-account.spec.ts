// Back office — package 3.3 « Compte » and « Voir comme le client », against the real stack:
//   CRM-070 the tab « Compte »: state, devices, close the sessions, suspend and reactivate (reason required), change the
//   address of the account (the link leaves for the new address); invitation of a record without account
//   (C_ACCOUNT_ACTIVATION found in `.local/mail`), « Renvoyer l’invitation »; no invitation without e-mail (MOD-302);
//   CRM-075, ROL-017, ECL-004 the client's space opened read-only in a new tab, its band, a write refused
//   (403 PREVIEW_READ_ONLY), « Quitter l’aperçu »;
//   CRM-046 « Faire une simulation »: the credit simulator of the back office, computed live, saved on the record, listed
//   « Faite par l’équipe » in the tab.
import { expect, test, type Page } from '@playwright/test';
import { ORIGIN, mailLink, signUpClient, unique } from './helpers/account.js';
import { ADMIN, adminPost, signInDirection } from './helpers/admin.js';

const letters = (tag: string) => tag.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]!);

async function clientIdOf(page: Page, q: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(async () => {
      const r = await page.request.get(`${ADMIN}/api/v1/admin/clients`, { params: { q, view: 'all' } });
      id = r.ok() ? ((await r.json()) as { data: { id: string }[] }).data[0]?.id : undefined;
      return Boolean(id);
    }, { timeout: 20_000 })
    .toBe(true);
  return id!;
}

test.describe('back office — client account and preview', () => {
  test.skip(({ isMobile }) => isMobile, 'the back office is designed for 1280 px and more (TRV-130)');
  test.beforeEach(async ({ request }) => {
    await request.get(`${ADMIN}/connexion`, { timeout: 60_000 }).catch(() => undefined);
    await expect.poll(async () => (await request.get(`${ADMIN}/api/v1/public/health`).catch(() => null))?.status() ?? 0, { timeout: 120_000, intervals: [1000, 2000, 3000] }).toBe(200);
  });

  test('CRM-070, CRM-075, ROL-017, ECL-004 — preview read-only, sessions closed, suspended and reactivated, address changed', async ({ page, browser }) => {
    test.setTimeout(240_000);
    // a real client, signed up on the site in his own browser
    const clientContext = await browser.newContext({ baseURL: ORIGIN });
    const clientPage = await clientContext.newPage();
    const { email } = await signUpClient(clientPage, 'Karima');

    await signInDirection(page);
    const id = await clientIdOf(page, email);
    await page.goto(`${ADMIN}/clients/${id}?onglet=compte`);
    await expect(page.getByText(/Actif, dernière connexion le \d/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Appareils et dernières connexions' })).toBeVisible();
    await expect(page.getByText('L’équipe ne voit ni ne définit jamais le mot de passe d’un client.')).toBeVisible();

    // CRM-075 — « Voir comme le client »: a window says what happens, the space opens in a new tab
    await page.getByRole('button', { name: 'Voir comme le client' }).first().click();
    const dialog = page.getByRole('dialog', { name: /Voir l’espace de Karima/ });
    await expect(dialog.getByText(/lecture seule, pour 30 minutes/)).toBeVisible();
    await dialog.getByLabel(/Raison/).fill('Aide à la lecture de son dossier');
    const [preview] = await Promise.all([page.waitForEvent('popup'), dialog.getByRole('button', { name: 'Ouvrir son espace' }).click()]);
    await expect(preview).toHaveURL(/\/espace-client/, { timeout: 60_000 });
    await expect(preview.getByText('Vous consultez l’espace de Karima Testeuse en lecture seule')).toBeVisible({ timeout: 30_000 });
    await expect(preview.getByRole('button', { name: 'Quitter l’aperçu' })).toBeVisible();

    // ROL-017 — a write is refused (403 PREVIEW_READ_ONLY), even with the anti-forgery token
    const refused = await preview.evaluate(async () => {
      const token = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith('dp_web_csrf='))?.split('=')[1] ?? '';
      const r = await fetch('/api/v1/client/notifications/read-all', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(token) }, body: '{}' });
      return { status: r.status, body: await r.json().catch(() => null) };
    });
    expect(refused.status).toBe(403);
    expect(refused.body?.error?.reason).toBe('PREVIEW_READ_ONLY');

    // « Quitter l’aperçu »: the tab closes (it was opened by the back office)
    await Promise.all([preview.waitForEvent('close', { timeout: 30_000 }), preview.getByRole('button', { name: 'Quitter l’aperçu' }).click()]);

    // CRM-070 — « Fermer ses sessions »: the client's own browser is signed out
    await page.getByRole('button', { name: 'Fermer ses sessions' }).click();
    await page.getByRole('dialog', { name: /Fermer les sessions de/ }).getByRole('button', { name: 'Fermer ses sessions' }).click();
    await expect(page.getByText(/session fermée|sessions fermées/)).toBeVisible({ timeout: 15_000 });
    const after = await clientPage.request.get(`${ORIGIN}/api/v1/client/space`);
    expect(after.status()).toBe(401);
    await expect(page.getByText('Aucun appareil connecté en ce moment.')).toBeVisible();

    // suspend (reason required), then reactivate
    await page.getByRole('button', { name: 'Suspendre le compte' }).click();
    const suspend = page.getByRole('dialog', { name: /Suspendre le compte de/ });
    await suspend.getByRole('button', { name: 'Suspendre le compte' }).click();
    await expect(suspend.getByText('Ce champ est obligatoire.').or(suspend.getByText(/obligatoire/)).first()).toBeVisible();
    await suspend.getByLabel(/^Raison/).fill('Usage abusif signalé');
    await suspend.getByRole('button', { name: 'Suspendre le compte' }).click();
    await expect(page.getByText('Compte suspendu.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Raison : Usage abusif signalé')).toBeVisible();
    await page.getByRole('button', { name: 'Réactiver le compte' }).click();
    const reactivate = page.getByRole('dialog', { name: /Réactiver le compte de/ });
    await reactivate.getByLabel(/^Raison/).fill('Vérification faite avec le client');
    await reactivate.getByRole('button', { name: 'Réactiver le compte' }).click();
    await expect(page.getByText('Compte réactivé.')).toBeVisible({ timeout: 15_000 });

    // CRM-048 — « Changer l’adresse du compte »: the confirmation link leaves for the new address
    const next = `nouvelle-${unique()}@example.test`;
    await page.getByRole('button', { name: 'Changer l’adresse du compte' }).click();
    const change = page.getByRole('dialog', { name: /Changer l’adresse du compte de/ });
    await change.getByLabel('Nouvelle adresse').fill(next);
    await change.getByRole('button', { name: 'Changer l’adresse du compte' }).click();
    await expect(page.getByText('Lien de confirmation envoyé à la nouvelle adresse.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Nouvelle adresse en attente de confirmation : ${next}`)).toBeVisible();
    expect(await mailLink(next, 'C_EMAIL_CHANGE_CONFIRM', /http:\/\/localhost:3000\/nouvelle-adresse\/[A-Za-z0-9_-]+/)).toBeTruthy();
    await clientContext.close();
  });

  test('CRM-070, MOD-302 — invite a record without account, resend; no invitation without e-mail', async ({ page }) => {
    test.setTimeout(150_000);
    await signInDirection(page);
    const tag = letters(unique());
    const email = `invite-${tag}@example.test`;
    const created = await adminPost(page, page.request, '/admin/clients', { firstName: 'Nadia', lastName: `Invitee${tag.slice(-5)}`, email, source: 'PHONE' });
    expect(created.status(), await created.text()).toBe(201);
    const { id } = (await created.json()) as { id: string };

    await page.goto(`${ADMIN}/clients/${id}?onglet=compte`);
    await expect(page.getByText('Aucun compte', { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Inviter le client' }).click();
    const dialog = page.getByRole('dialog', { name: /Inviter Nadia/ });
    await expect(dialog.getByText(email)).toBeVisible();
    await dialog.getByRole('button', { name: 'Inviter le client' }).click();
    await expect(page.getByText('Invitation envoyée.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Invité le \d/)).toBeVisible();
    expect(await mailLink(email, 'C_ACCOUNT_ACTIVATION', /http:\/\/localhost:3000\/activation\/[A-Za-z0-9_-]+/)).toBeTruthy();
    // « Voir comme le client » stays greyed: the account is not active
    await expect(page.getByRole('button', { name: 'Voir comme le client' }).first()).toBeDisabled();
    await page.getByRole('button', { name: 'Renvoyer l’invitation' }).click();
    await page.getByRole('dialog', { name: 'Renvoyer l’invitation' }).getByRole('button', { name: 'Renvoyer l’invitation' }).click();
    await expect(page.getByText('Invitation renvoyée.')).toBeVisible({ timeout: 15_000 });

    // MOD-302 — a record without e-mail: the invitation says why it is impossible
    const phoneOnly = await adminPost(page, page.request, '/admin/clients', { firstName: 'Samir', lastName: `Sansmail${tag.slice(-5)}`, phone: `+3361${String(Date.now()).slice(-7)}`, source: 'PHONE' });
    expect(phoneOnly.status(), await phoneOnly.text()).toBe(201);
    await page.goto(`${ADMIN}/clients/${((await phoneOnly.json()) as { id: string }).id}?onglet=compte`);
    await expect(page.getByText(/Sans adresse e-mail, pas d’invitation possible/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Inviter le client' })).toHaveCount(0);
  });

  test('CRM-046 — « Faire une simulation » from the record: computed live, saved, listed as made by the team', async ({ page }) => {
    test.setTimeout(150_000);
    await signInDirection(page);
    const tag = letters(unique());
    const created = await adminPost(page, page.request, '/admin/clients', { firstName: 'Yacine', lastName: `Simule${tag.slice(-5)}`, email: `sim-${tag}@example.test`, source: 'PHONE' });
    expect(created.status(), await created.text()).toBe(201);
    const { id } = (await created.json()) as { id: string };

    await page.goto(`${ADMIN}/clients/${id}?onglet=simulations`);
    await expect(page.getByText('Aucune simulation pour l’instant')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('link', { name: /Faire une simulation · Crédit/ }).click();
    await expect(page.getByRole('heading', { name: 'Faire une simulation', level: 1 })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel('Prix du bien').fill('180000');
    await page.getByLabel(/^Apport/).fill('30000');
    await page.getByLabel('Durée, en années').fill('20');
    await expect(page.getByText('Mensualité', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByLabel(/Nom de la simulation/).fill(`Crédit test ${tag}`);
    await page.getByRole('button', { name: 'Enregistrer sur la fiche' }).click();
    await expect(page).toHaveURL(new RegExp(`/clients/${id}\\?onglet=simulations`), { timeout: 30_000 });
    await expect(page.getByText(`Crédit test ${tag}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Faite par l’équipe').first()).toBeVisible();
    await expect(page.getByText(/\/ mois sur 20 ans/)).toBeVisible();
  });
});
