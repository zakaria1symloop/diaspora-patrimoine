// Back office — requests received, in reading (EA-10, EA-11, package 2.11) and the foundation they use (package 3.1):
// a request sent from the public contact form arrives in the list (CRM-001), with its bell notification (NS_LEAD_NEW);
// origin views, filters, sort and page in the address (TRV-101, TRV-107); the record (CRM-010); the global search by
// exact reference (BO-030); a note in the timeline (BO-050, BO-055); a saved view (BO-040); the list as it was left
// (TRV-105).
import { expect, test } from '@playwright/test';
import { freshIp } from './helpers/account.js';
import { ADMIN, signInDirection } from './helpers/admin.js';

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

test.describe('back office — requests', () => {
  test.skip(({ isMobile }) => isMobile, 'the back office is designed for 1280 px and more (TRV-130)');

  test('a contact message arrives, is found, read, annotated; the list remembers', async ({ page, browser }) => {
    test.setTimeout(180_000);
    // A visitor writes from the public site (the real form, the real API).
    const visitor = await (await browser.newContext({ locale: 'fr-FR' })).newPage();
    await freshIp(visitor);
    const tag = unique();
    const email = `demande-${tag}@example.test`;
    const lastName = `Recette${tag.slice(-4)}`.replace(/\d/g, 'x');
    const message = `Quels documents faut-il pour un crédit depuis la France ? (${tag})`;
    await visitor.goto('http://localhost:3000/contact');
    await visitor.getByRole('textbox', { name: 'Prénom' }).fill('Nadia');
    await visitor.getByLabel('Nom', { exact: true }).fill(lastName);
    await visitor.getByRole('textbox', { name: 'E-mail' }).fill(email);
    await visitor.getByLabel('Objet').selectOption('FINANCING');
    await visitor.getByLabel('Votre message').fill(message);
    await visitor.getByLabel(/J’accepte que Diaspora Patrimoine me contacte/).check();
    await visitor.getByRole('button', { name: 'Envoyer mon message' }).click();
    await expect(visitor.getByText('Merci Nadia, votre demande est enregistrée.')).toBeVisible({ timeout: 20_000 });
    await visitor.context().close();

    await signInDirection(page);
    await page.goto(`${ADMIN}/demandes?view=all&q=${lastName}`);
    await expect(page.getByRole('heading', { name: 'Demandes', level: 1 })).toBeVisible();
    // CRM-001 columns
    for (const name of ['Référence', 'Reçue le', 'Nature', 'Client', 'Objet', 'Origine', 'Conseiller', 'Premier contact', 'État']) await expect(page.getByRole('columnheader', { name: new RegExp(`^${name}`) })).toBeVisible();
    const line = page.getByRole('row').filter({ hasText: lastName.toUpperCase() });
    await expect(line).toHaveCount(1, { timeout: 20_000 });
    await expect(line).toContainText('Message de contact');
    await expect(line).toContainText('Site');
    // CRM-002 — two business days ahead: time left, never « en retard »
    await expect(line).toContainText(/dans \d/);
    const reference = (await line.getByRole('link').first().textContent())!.trim();
    expect(reference).toMatch(/^DEM-\d{4}-\d{5}$/);

    // NOT-030 `NS_LEAD_NEW` — the bell tells it (the outbox writes it after the commit)
    await expect
      .poll(
        async () => {
          const r = await page.request.get(`${ADMIN}/api/v1/admin/notifications?pageSize=50`);
          const body = (await r.json()) as { data: { type: string; title: string; link: string | null }[] };
          return body.data.some((n) => n.type === 'NS_LEAD_NEW' && n.title.includes(lastName) && n.link === `/demandes/${reference}`);
        },
        { timeout: 20_000 },
      )
      .toBe(true);

    // BO-035 — a click on the row opens the record (EA-11)
    await line.getByRole('cell').nth(3).click();
    await expect(page).toHaveURL(new RegExp(`/demandes/${reference.toLowerCase()}$`));
    await expect(page.getByRole('heading', { name: `Demande ${reference}` })).toBeVisible({ timeout: 30_000 });
    // CRM-010 — three zones
    await expect(page.getByRole('heading', { name: 'Ce que la personne a envoyé' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contexte' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Client et suite' })).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText('/contact', { exact: true })).toBeVisible();
    await expect(page.getByText('Le financement')).toBeVisible();
    // delivery 2: read only — none of the actions of CRM-011
    for (const action of ['Prendre en charge', 'Clôturer', 'Affecter à…', 'Indésirable']) await expect(page.getByRole('button', { name: action })).toHaveCount(0);
    // NOT-032 — opening the object marks its notifications read
    await expect
      .poll(async () => {
        const r = await page.request.get(`${ADMIN}/api/v1/admin/notifications?pageSize=50&unread=1`);
        return ((await r.json()) as { data: { title: string }[] }).data.some((n) => n.title.includes(lastName));
      })
      .toBe(false);

    // BO-050 — the timeline tells the reception and the acknowledgement e-mail; BO-055, BO-080 — `N` opens a note
    const timeline = page.getByRole('region', { name: 'Chronologie' });
    await expect(timeline.getByText(/Demande reçue : message de contact/)).toBeVisible();
    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('n');
    await expect(timeline.getByText('Note interne : le client ne la voit pas.')).toBeVisible();
    const note = `Rappeler après 18 h (${tag})`;
    await timeline.getByLabel('Nouvelle note').fill(note);
    await timeline.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Note enregistrée.')).toBeVisible();
    await expect(timeline.getByText(note)).toBeVisible();
    await timeline.getByRole('button', { name: 'Actions sur la note' }).click();
    await page.getByRole('menuitem', { name: 'Épingler en tête' }).click();
    await expect(timeline.getByText('Épinglée')).toBeVisible();
    // filter by type: only the notes remain
    await timeline.getByRole('group', { name: 'Filtrer la chronologie' }).getByRole('button', { name: 'Note' }).click();
    await expect(timeline.getByText(/Demande reçue/)).toHaveCount(0);
    await expect(timeline.getByText(note)).toBeVisible();

    // TRV-108 — back to the list: same criteria, the opened row highlighted and focused
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`q=${lastName}`));
    await expect(page.getByRole('row').filter({ hasText: reference })).toBeFocused();

    // BO-030 — the exact reference comes first in the global search; Enter opens it
    await page.keyboard.press('Control+k');
    await page.keyboard.type(reference);
    await expect(page.getByRole('option').filter({ hasText: reference })).toBeVisible();
    await expect(page.getByRole('option').filter({ hasText: reference })).toContainText('Référence exacte');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/demandes/${reference.toLowerCase()}$`));

    // TRV-101, TRV-107 — views, sort and filters live in the address, without reloading the page
    await page.goto(`${ADMIN}/demandes?view=all`);
    await expect(page.getByRole('tab', { name: /Toutes/ })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('columnheader', { name: /^Reçue le/ }).getByRole('button').click();
    await expect(page).toHaveURL(/sort=createdAt/);
    await expect(page.getByRole('columnheader', { name: /^Reçue le/ })).toHaveAttribute('aria-sort', 'ascending');
    await page.getByRole('group').getByRole('button', { name: 'Nature' }).click();
    await page.getByRole('dialog', { name: 'Nature' }).getByLabel(/Message de contact/).check();
    await expect(page).toHaveURL(/kind=CONTACT_MESSAGE/);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /Nature : Message de contact/ })).toBeVisible();
    await expect(page.getByText(/^\d+–\d+ sur \d+$/).first()).toBeVisible();

    // BO-040 — « Enregistrer cette vue »: a personal tab that keeps the filters
    const viewName = `Contacts ${tag}`;
    await page.getByRole('button', { name: 'Vue', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Enregistrer cette vue' }).click();
    await page.getByRole('dialog').getByLabel('Nom de la vue').fill(viewName);
    await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('tab', { name: viewName })).toHaveAttribute('aria-selected', 'true');

    // TRV-105 — the list reopens as it was left (the view), from the menu
    await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: 'Équipe' }).click();
    await expect(page.getByRole('heading', { name: 'Équipe', level: 1 })).toBeVisible();
    await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: /Demandes/ }).click();
    await expect(page.getByRole('tab', { name: viewName })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: /Nature : Message de contact/ })).toBeVisible();

    // the view is deleted (its owner): the confirmation names it (TRV-095)
    await page.getByRole('button', { name: 'Vue', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Supprimer la vue' }).click();
    await expect(page.getByRole('dialog').getByText(new RegExp(`Supprimer la vue « ${viewName} »`))).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.getByRole('tab', { name: viewName })).toHaveCount(0);

    // BO-015 — a reference that does not exist
    await page.goto(`${ADMIN}/demandes/dem-1999-00000`);
    await expect(page.getByText('Cet élément est introuvable.', { exact: true })).toBeVisible();
  });
});
