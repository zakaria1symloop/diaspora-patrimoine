// Review of 14/10/2026 (D-108). EC-12, EC-13 — the client answers the properties of his dossier from his space
// (INT-004, INT-010, INT-020, INT-021, INT-030, INT-031; « Demander une visite » through its fallback, ECL-006). The
// dossier is the demonstration's followed dossier (`demo -- --suivi-pour=`, PAR-082): qualified, properties proposed
// and sent, all written by the use cases of the back office — never by the test. And FIC-054: « Demande
// envoyée » on a property page belongs to the account that sent it.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { freshIp, signUpClient } from './helpers/account';

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'api');

/** PAR-082 — the followed dossier of the demonstration for this account (waits for the minute of its first call). */
function followedDossierFor(email: string): void {
  execFileSync(process.execPath, ['--env-file=.env', 'dist/install/demo.js', `--suivi-pour=${email}`], { cwd: API_DIR, stdio: 'pipe', timeout: 180_000 });
}

/** The card of a property envisaged, by its title. */
const card = (page: Page, title: string) => page.locator('article[data-candidate]', { has: page.getByRole('heading', { level: 3, name: title, exact: true }) });

test('INT-010, INT-020, INT-021, INT-030, INT-031, INT-004, ECL-006 — the client answers the properties proposed to him', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one journey through the demonstration dossier is enough');
  test.setTimeout(360_000);
  await freshIp(page);
  const { email } = await signUpClient(page, 'Nadia');
  followedDossierFor(email);

  // INT-010 — the proposals sent (the property the dossier was opened with stays a draft: never shown), each with its
  // two answers while it waits for one
  await page.goto('/espace-client/biens-proposes');
  const proposals = page.locator('article[data-candidate]');
  await expect(proposals.nth(1)).toBeVisible({ timeout: 30_000 });
  const [first, second] = await proposals.locator('h3').allInnerTexts();
  for (const c of await proposals.all()) {
    await expect(c.getByRole('button', { name: /^Ce bien m’intéresse/ })).toBeVisible();
    await expect(c.getByRole('button', { name: /^Ce bien ne me convient pas/ })).toBeVisible();
  }

  // INT-020 — « Ce bien m'intéresse », with what pleases; the advisor is told
  await card(page, first!).getByRole('button', { name: /^Ce bien m’intéresse/ }).click();
  const like = page.getByRole('dialog', { name: 'Ce bien m’intéresse' });
  await like.getByLabel(/Qu’est-ce qui vous plaît/).fill('La vue et le quartier.');
  await like.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(page.getByText(/^Merci, .+ est prévenu\.$/).first()).toBeVisible({ timeout: 15_000 });
  await expect(card(page, first!)).toHaveAttribute('data-candidate', 'INTERESTED');
  await expect(card(page, first!).getByRole('link', { name: 'Voir dans mes intérêts' })).toBeVisible();

  // INT-021 — « Ce bien ne me convient pas »: the reason first, then « Écarté », and the way back
  await card(page, second!).getByRole('button', { name: /^Ce bien ne me convient pas/ }).click();
  const refuse = page.getByRole('dialog', { name: 'Ce bien ne me convient pas' });
  await refuse.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(refuse.getByText('Choisissez une raison.')).toBeVisible();
  await refuse.getByRole('radio', { name: 'Trop cher' }).check();
  await refuse.getByLabel(/Une précision/).fill('Au-dessus de mon budget.');
  await refuse.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(card(page, second!)).toHaveAttribute('data-candidate', 'DECLINED', { timeout: 15_000 });
  await card(page, second!).getByRole('button', { name: /^Finalement, il m’intéresse/ }).click();
  await page.getByRole('dialog', { name: 'Finalement, il m’intéresse' }).getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(card(page, second!)).toHaveAttribute('data-candidate', 'INTERESTED', { timeout: 15_000 });

  // INT-004 — in « Mes intérêts », the answers of a property followed
  await page.goto('/espace-client/interets');
  const mine = card(page, first!);
  const other = card(page, second!);
  await expect(mine.getByRole('button', { name: /^Je retiens ce bien/ })).toBeVisible({ timeout: 30_000 });
  await expect(mine.getByRole('button', { name: /^Ce bien ne m’intéresse plus/ })).toBeVisible();

  // INT-030 — « Je retiens ce bien »: what it means, then the choice waits for the advisor (the status does not change)
  await mine.getByRole('button', { name: /^Je retiens ce bien/ }).click();
  const retain = page.getByRole('dialog', { name: 'Je retiens ce bien' });
  await expect(retain.getByText('Cela ne vous engage pas.')).toBeVisible();
  await retain.getByRole('button', { name: 'Envoyer mon choix' }).click();
  await expect(mine.getByText('Choix envoyé à votre conseiller')).toBeVisible({ timeout: 15_000 });
  await expect(mine).toHaveAttribute('data-candidate', 'INTERESTED');

  // INT-031 — one pending choice per dossier: choosing another property asks to replace the first one
  await other.getByRole('button', { name: /^Je retiens ce bien/ }).click();
  const replace = page.getByRole('dialog', { name: 'Je retiens ce bien' });
  await replace.getByRole('button', { name: 'Envoyer mon choix' }).click();
  await expect(replace.getByText(`Vous aviez indiqué ${first}. Le remplacer ?`)).toBeVisible();
  await replace.getByRole('button', { name: 'Oui, le remplacer' }).click();
  await expect(other.getByText('Choix envoyé à votre conseiller')).toBeVisible({ timeout: 15_000 });
  await expect(mine.getByText('Choix envoyé à votre conseiller')).toHaveCount(0);
  // … and « Annuler mon choix » as long as the advisor has not confirmed it
  await other.getByRole('button', { name: /^Annuler mon choix/ }).click();
  await expect(page.getByText('Votre choix est annulé.')).toBeVisible({ timeout: 15_000 });
  await expect(other.getByRole('button', { name: /^Je retiens ce bien/ })).toBeVisible();

  // INT-004 — « Ce bien ne m'intéresse plus »: a declined proposal goes back to « Biens proposés », marked « Écarté »
  await mine.getByRole('button', { name: /^Ce bien ne m’intéresse plus/ }).click();
  const drop = page.getByRole('dialog', { name: 'Ce bien ne m’intéresse plus' });
  await drop.getByRole('radio', { name: 'L’emplacement ne convient pas' }).check();
  await drop.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(mine).toHaveCount(0, { timeout: 15_000 });

  // ECL-006 — « Demander une visite »: until the visit request is delivered, the message to the advisor, prefilled
  await other.getByRole('link', { name: /^Demander une visite/ }).click();
  await expect(page).toHaveURL(/\/espace-client\/messages\?.*depuis=PROPERTY_VISIT/);
  await expect(page.getByRole('textbox', { name: /Votre message/ })).toHaveValue(new RegExp(`^Je souhaite visiter ${second!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(réf\\. `));

  await page.goto('/espace-client/biens-proposes');
  await expect(card(page, first!)).toHaveAttribute('data-candidate', 'DECLINED', { timeout: 30_000 });
});

test('FIC-054, D-108 — « Demande envoyée » on a property belongs to the account that sent it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'a two-account journey: once is enough');
  test.setTimeout(300_000);
  await freshIp(page);
  await signUpClient(page, 'Lina');
  const list = (await (await page.request.get('/api/v1/public/properties?limit=12')).json()) as { data: { slug: string; availability: string }[] };
  const slug = list.data.find((x) => x.availability === 'AVAILABLE')?.slug;
  test.skip(!slug, 'no available property in the demo data');

  await page.goto(`/biens/${slug}?interet=1`);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('signed-in-contact')).toBeVisible({ timeout: 30_000 });
  const country = dialog.getByLabel('Pays de résidence');
  if (await country.isVisible()) await country.selectOption('FR');
  await page.waitForTimeout(3_000); // DEM-030: a form sent in under 3 s is suspect
  await dialog.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(dialog.getByText(/votre demande est enregistrée/)).toBeVisible({ timeout: 30_000 });
  await page.goto(`/biens/${slug}`);
  await expect(page.getByRole('button', { name: 'Demande envoyée' }).first()).toBeVisible({ timeout: 30_000 });

  // another person signs in, in the same tab: the property is not « sent » for her
  await page.goto('/espace-client');
  await page.getByRole('button', { name: /Lina/ }).click();
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/$/);
  await signUpClient(page, 'Sara');
  await page.goto(`/biens/${slug}`);
  await expect(page.getByRole('link', { name: /Exprimer mon intérêt/ }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Demande envoyée' })).toHaveCount(0);
});
