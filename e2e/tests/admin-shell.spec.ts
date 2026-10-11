// Back office — the door and the frame (packages 1.8, 3.1): EA-00 sign-in with the second factor (BO-002), the frame
// (BO-010, BO-011: only delivered entries), the account menu (BO-013), the help window (BO-081), the bell (BO-060),
// the global search (BO-030), « Mes préférences » (BO-070), and the refusals of BO-001 / BO-015.
import { expect, test } from '@playwright/test';
import { ADMIN, signInDirection } from './helpers/admin.js';

test.describe('back office — door and frame', () => {
  test.skip(({ isMobile }) => isMobile, 'the back office is designed for 1280 px and more (TRV-130); its phone layout is checked by screenshots');

  test('BO-001 — a page of the shell without a session leads to the sign-in page, which says nothing about accounts', async ({ page }) => {
    await page.goto(`${ADMIN}/equipe`);
    await expect(page).toHaveURL(/\/connexion\?suite=%2Fequipe$/);
    await expect(page.getByRole('heading', { name: 'Se connecter' })).toBeVisible();
    // BO-002 — no « Se souvenir de moi », no sign-in by link
    await expect(page.getByText('Se souvenir de moi')).toHaveCount(0);
    await page.getByLabel('E-mail').fill('personne@example.test');
    await page.getByLabel('Mot de passe').fill('un mot de passe quelconque');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('E-mail ou mot de passe incorrect.')).toBeVisible();
    const robots = (await page.request.get(`${ADMIN}/connexion`)).headers()['x-robots-tag'];
    expect(robots).toContain('noindex');
  });

  test('BO-003 — a dead invitation link says what to do', async ({ page }) => {
    await page.goto(`${ADMIN}/invitation/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`);
    await expect(page.getByText('Ce lien a expiré ou a déjà été utilisé. Demandez à un administrateur de vous renvoyer l’invitation.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Retour à la connexion' })).toBeVisible();
  });

  test('BO-002, BO-010, BO-011, BO-013 — sign-in with the second factor, then the frame', async ({ page }) => {
    await signInDirection(page);
    const nav = page.getByRole('navigation', { name: 'Menu principal' });
    // BO-011 — only what is delivered (the menu grows with each package: Demandes, Dossiers, Tâches, Agenda, Équipe…)
    await expect(nav.getByRole('link', { name: /Demandes/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Équipe' })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Tâches/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Agenda' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Pipeline' })).toHaveCount(0);
    // BO-012 — « + Créer » lists only the delivered creation forms
    await expect(page.getByRole('button', { name: 'Créer' })).toBeVisible();
    // BO-014 — the environment banner
    await expect(page.getByText(/ENVIRONNEMENT LOCAL/)).toBeVisible();

    // BO-081 — the « ? » key opens the help window, which recalls the shortcuts
    await page.keyboard.press('?');
    await expect(page.getByRole('heading', { name: 'Raccourcis clavier' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Raccourcis clavier' })).toBeHidden();

    // BO-060 — the bell
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeVisible();
    await page.getByRole('link', { name: 'Tout voir' }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible();

    // BO-030 — `/` reaches the global search; fewer than two characters ask nothing
    await page.keyboard.press('/');
    await expect(page.getByRole('combobox', { name: 'Recherche globale' })).toBeFocused();
    await page.keyboard.type('zzzz-introuvable');
    await expect(page.getByText(/Aucun résultat pour « zzzz-introuvable »/).first()).toBeVisible();
    await page.keyboard.press('Escape');

    // BO-013 — account menu: Mes préférences, Se déconnecter
    await page.getByRole('button', { name: /Direction/ }).click();
    await page.getByRole('menuitem', { name: 'Mes préférences' }).click();
    await expect(page).toHaveURL(/\/preferences$/);
    await expect(page.getByRole('heading', { name: 'Mes préférences' })).toBeVisible();

    // BO-015 — an address that does not exist keeps the frame
    await page.goto(`${ADMIN}/une-page-qui-n-existe-pas`);
    await expect(page.getByText('Cet élément est introuvable.', { exact: true })).toBeVisible();
    await expect(nav).toBeVisible();
  });

  test('BO-070 — profile saved, devices listed, the second factor cannot be switched off', async ({ page }) => {
    await signInDirection(page);
    await page.goto(`${ADMIN}/preferences`);
    const jobTitle = `Direction ${Date.now().toString(36)}`;
    await page.getByLabel(/^Fonction/).fill(jobTitle);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Modifications enregistrées.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/^Fonction/)).toHaveValue(jobTitle);

    await page.getByRole('link', { name: 'Sécurité' }).click();
    await expect(page).toHaveURL(/\/preferences\/securite$/);
    await expect(page.getByText('Elle est obligatoire pour toute l’équipe : elle ne se désactive pas.')).toBeVisible();
    await expect(page.getByText('Cet appareil')).toBeVisible();
    // the password form is there, with its rules written before the typing (TRV-116); a wrong current password would
    // count as a failed sign-in (AUTH-032): it is not tried here, so that reruns never lock the test account
    await expect(page.getByLabel('Mot de passe actuel')).toBeVisible();
    await expect(page.getByText(/10 caractères au minimum/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reconfigurer (nouveau téléphone)' })).toBeVisible();
  });
});
