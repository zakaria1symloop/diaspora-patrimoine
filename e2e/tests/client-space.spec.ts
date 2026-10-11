// Package 2.8 — the client space through the real stack (web, API, PostgreSQL): its own frame (ECL-001, ECL-002), the
// dashboard of a space without project (ECL-013), « Écrire à mon conseiller » with its prefill (MSG-021, MSG-017),
// the request found in « Mes demandes » (INT-001), the notifications read in « Dernières nouvelles » (ECL-010, MSG-046),
// a profile section saved alone (PRO-002), the « Actualités » switch (PRO-030/PRO-051), and ROL-030 (someone else's
// dossier is 404; without session, 401).
import { expect, test } from '@playwright/test';
import { freshIp, signUpClient } from './helpers/account';

const NOT_FOUND = /introuvable|n’existe|plus là|perdu/i;

test.describe('client space', () => {
  test('frame, dashboard, MSG-021, Mes demandes, Dernières nouvelles, profile, agreements', async ({ page, isMobile }) => {
    await freshIp(page);
    await signUpClient(page);
    // TRV-126 — the first-visit tour is not what this test is about.
    await page.evaluate(() => localStorage.setItem('dp_tour_space', '1'));
    await page.goto('/espace-client');

    // ECL-013 — a space without request nor dossier.
    await expect(page.getByRole('heading', { level: 1, name: 'Bonjour Karima' })).toBeVisible();
    await expect(page.getByText('Bienvenue dans votre espace')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Découvrir les programmes' }).first()).toBeVisible();
    await expect(page.getByText('Aucune notification pour le moment.')).toBeVisible();

    // ECL-001 — the menu (side menu on a computer, tabs on a phone); ECL-006: no entry for undelivered screens.
    if (isMobile) {
      const tabs = page.getByRole('navigation', { name: 'Navigation de mon espace' });
      for (const name of ['Accueil', 'Dossier', 'Biens', 'Messages', 'Plus']) await expect(tabs.getByText(name, { exact: true })).toBeVisible();
    } else {
      const menu = page.getByRole('navigation', { name: 'Menu de mon espace' });
      for (const name of ['Tableau de bord', 'Mes intérêts', 'Biens proposés', 'Messages', 'Simulations', 'Profil']) await expect(menu.getByRole('link', { name })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Mon dossier' })).toHaveCount(0); // no dossier yet
      await expect(menu.getByRole('link', { name: 'Rendez-vous' })).toHaveCount(0);
    }

    // MSG-021, MSG-017 — opened from a property button: the start of the message is prefilled, nothing leaves alone.
    await page.goto('/espace-client/messages?depuis=PROPERTY_ABOUT&ref=DP-TEST-1&bien=Appartement%20F3');
    await expect(page.getByRole('heading', { name: /^Écrire à/ })).toBeVisible();
    const box = page.getByLabel('Votre message');
    await expect(box).toHaveValue('Au sujet de Appartement F3 (réf. DP-TEST-1) : ');
    await box.fill('court');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByText("10 caractères au minimum.")).toBeVisible();
    await box.fill('Bonjour, ce bien est-il encore disponible ? Je souhaiterais en parler.');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByText(/^Votre message est envoyé/).first()).toBeVisible();

    // INT-001, INT-003 — the request is in « Mes demandes », marked as written from the space.
    await page.getByRole('link', { name: 'Voir mes demandes' }).click();
    await expect(page).toHaveURL(/\/espace-client\/interets/);
    await expect(page.getByText('Message de contact').first()).toBeVisible();
    await expect(page.getByText(/Écrit depuis votre espace/)).toBeVisible();

    // ECL-014 / ECL-010 — the dashboard says the request is registered; the notification is read in « Dernières
    // nouvelles » (written from the outbox after the commit: wait for it).
    await expect(async () => {
      await page.goto('/espace-client');
      await expect(page.getByText(/^Votre demande DEM-\d{4}-\d+ est enregistrée\.$/)).toBeVisible({ timeout: 2000 });
      await expect(page.getByRole('button', { name: /Votre message est bien reçu/ })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Tout marquer comme lu' }).click();
    await expect(page.getByRole('button', { name: 'Tout marquer comme lu' })).toHaveCount(0);

    // PRO-002 — one section saved alone; the completion moves (PRO-003).
    await page.goto('/espace-client/profil');
    const situation = page.locator('form#situation');
    // The dev server hydrates late: retry the choice until React has taken the page over.
    await expect(async () => {
      await situation.getByLabel(/Situation de résidence/).selectOption('NON_RESIDENT');
      await expect(situation.getByText('Modifications non enregistrées')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    await situation.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Modifications enregistrées.')).toBeVisible();
    await page.reload();
    await expect(page.locator('form#situation').getByLabel(/Situation de résidence/)).toHaveValue('NON_RESIDENT');

    // PRO-030 / PRO-051 — the « Actualités » switch is the consent itself.
    await page.goto('/espace-client/profil/confidentialite');
    await expect(page.getByText(/Acceptées le/)).toBeVisible();
    const sw = page.getByRole('switch', { name: 'Actualités par e-mail' });
    const before = await sw.getAttribute('aria-checked');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
    await expect(page.getByText('Non donné.')).toBeVisible();

    // EC-51 — the current device is listed.
    await page.goto('/espace-client/profil/securite');
    await expect(page.getByText('Cet appareil')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Activer la double authentification' })).toBeVisible();

    // ROL-030 — someone else's dossier (or none) answers 404; the space's data need a session.
    const other = await page.request.get('/api/v1/client/dossiers/DOS-2000-99999');
    expect(other.status()).toBe(404);
    // The space streams (loading state, TRV-080): the status is already sent, the page shows the « not found » screen.
    await page.goto('/espace-client/dossiers/dos-2000-99999');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(NOT_FOUND);
  });

  test('without session: the API refuses, the pages lead to the sign-in', async ({ page, request }) => {
    expect((await request.get('/api/v1/client/space')).status()).toBe(401);
    expect((await request.get('/api/v1/client/dashboard')).status()).toBe(401);
    await page.goto('/espace-client/interets');
    await expect(page).toHaveURL(/\/connexion\?suite=%2Fespace-client%2Finterets/);
  });
});
