// D-098 « chaque bouton montré fonctionne là où il est » — the dead-control audit of the client space. On EVERY page
// of a space filled with real data (and of an empty one), it fails on:
//   · a console error or an uncaught exception, a response in 4xx/5xx (the page's own calls);
//   · a link that leads nowhere: no address, « # », an anchor whose target is not on the page, an internal address
//     that answers 4xx/5xx (every internal link is requested);
//   · a button, tab, switch or menu entry that does NOTHING when clicked: no change on the page, no navigation, no
//     request, no window, no download (each one is clicked, on a freshly loaded page);
//   · a control without an accessible name, or a touch target under 44 px on a phone (TRV-121).
// Controls that leave the space for good are checked without being clicked: « Se déconnecter » and the removal of a
// favourite (their own specs click them). ECL-006: nothing leads to a function that is not there.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { apiUp, freshIp, signUpClient } from './helpers/account';
import { apiReady, fillSpace, type FilledSpace } from './helpers/space-data';

/** The site under test: localhost, or the machine's network address (E2E_BASE_URL) as the owner opens it. */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/** Never clicked here: they end the session or destroy the data the next pages need. */
const NOT_CLICKED = /^(Se déconnecter|Me déconnecter de tous les autres appareils|Déconnecter)$|^Retirer /;

function pagesOf(space: FilledSpace | null): string[] {
  const list = ['/espace-client'];
  if (space) {
    if (space.dossiers.length > 1) list.push('/espace-client/dossiers');
    for (const d of space.dossiers) list.push(`/espace-client/dossiers/${d}`);
    list.push(`/espace-client/dossiers/${space.documentsDossier}/pieces`);
  }
  list.push(
    '/espace-client/interets',
    '/espace-client/biens-proposes',
    '/espace-client/messages',
    '/espace-client/simulations',
    '/espace-client/favoris',
    '/espace-client/alertes',
    '/espace-client/profil',
    '/espace-client/profil/securite',
    '/espace-client/profil/confidentialite',
  );
  return list;
}

interface Watch {
  problems: string[];
  requests: number;
  /** Checks of the API's health still running for a 5xx answer. */
  pending: Promise<void>[];
}

/** Console errors, exceptions and failed responses of the page; counts the requests (a click that calls the API acts). */
function watch(page: Page): Watch {
  const w: Watch = { problems: [], requests: 0, pending: [] };
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // The browser's own line for a failed response: the response listener below reports it with its address.
    if (/Failed to load resource/.test(text)) return;
    w.problems.push(`console: ${text.slice(0, 300)}`);
  });
  page.on('pageerror', (e) => {
    // Next's development router, when a link is clicked before it has started (the audit clicks fast): a dev artefact.
    if (/Router action dispatched before initialization/.test(e.message)) return;
    w.problems.push(`exception: ${e.message.slice(0, 300)}`);
  });
  page.on('request', () => w.requests++);
  page.on('response', (r) => {
    const url = r.url();
    if (r.status() < 400 || !url.startsWith(BASE)) return;
    // AUTH-023 — an access token that ended is renewed by the page itself: that 401 is the mechanism, not a fault.
    if (r.status() === 401 && /\/api\/v1\/(client|auth)\//.test(url)) return;
    const line = `${r.status()} ${r.request().method()} ${url.replace(BASE, '')}`;
    if (r.status() < 500) return void w.problems.push(line);
    // The shared local API restarts whenever someone rebuilds it: a 5xx while its health check fails is that, not
    // the page. Checked at once; the line is kept only if the API was up.
    w.pending.push(
      fetch('http://localhost:4000/api/v1/public/health')
        .then((h) => h.ok, () => false)
        .then((up) => void (up && w.problems.push(line))),
    );
  });
  return w;
}

/**
 * Opens a page of the space and waits for its title. The local API restarts whenever its code is rebuilt (several
 * people work on it): a page caught during a restart shows its error state — wait and open it again, a few times.
 */
async function open(page: Page, path: string, w?: Watch): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const at = w?.problems.length ?? 0;
    // a click just before may have started a navigation that this one aborts: that is not a fault
    await page.goto(path, { waitUntil: 'load' }).catch(() => undefined);
    const title = page.locator('main#contenu h1').first();
    const there = new URL(page.url()).pathname === path;
    const ok = there && (await title.waitFor({ state: 'visible', timeout: attempt < 6 ? 12_000 : 30_000 }).then(() => true, () => false));
    if (ok) break;
    if (attempt >= 6) {
      expect(new URL(page.url()).pathname).toBe(path);
      await expect(title).toBeVisible();
    }
    if (w) w.problems.length = at; // what a restart produced is not the page's fault
    await page.waitForTimeout(5000);
  }
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
}

const nameOf = (el: Locator) =>
  el.evaluate((node) => {
    const e = node as HTMLElement;
    const labelled = e.getAttribute('aria-labelledby');
    const byId = labelled ? labelled.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ') : '';
    return (e.getAttribute('aria-label') || byId || e.textContent || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
  });

/** Every link of the page: a real address; internal ones answer; an anchor has its target. */
async function checkLinks(page: Page, path: string, seen: Map<string, number>): Promise<string[]> {
  const problems: string[] = [];
  const links = await page.locator('a:visible').evaluateAll((nodes) =>
    nodes.map((n) => ({
      href: n.getAttribute('href'),
      name: (n.getAttribute('aria-label') || n.textContent || '').replace(/\s+/g, ' ').trim(),
      hidden: n.getAttribute('aria-hidden') === 'true',
    })),
  );
  for (const l of links) {
    if (!l.hidden && !l.name) problems.push(`link without a name → ${l.href}`);
    if (!l.href || l.href === '#' || l.href.startsWith('javascript:')) {
      problems.push(`link « ${l.name} » leads nowhere (${l.href ?? 'no address'})`);
      continue;
    }
    if (/^(tel:|mailto:)/.test(l.href) || (/^https?:\/\//.test(l.href) && !l.href.startsWith(BASE))) continue;
    const url = new URL(l.href, `${BASE}${path}`);
    if (url.hash && url.pathname === new URL(`${BASE}${path}`).pathname) {
      const there = await page.locator(`[id="${url.hash.slice(1)}"]`).count();
      if (!there) problems.push(`link « ${l.name} » points to ${url.hash}, which is not on the page`);
      continue;
    }
    const key = url.pathname + url.search;
    if (!seen.has(key)) {
      // A PDF or a file answers with its content: the status is what matters.
      // The dev server may drop a connection while it compiles a page for the first time: ask again.
      let status = 0;
      for (let attempt = 0; attempt < 5 && (status === 0 || status >= 500); attempt++) {
        if (attempt) await apiUp(); // a 5xx while the shared API restarts: ask again once it is back
        status = await page.request.get(key, { maxRedirects: 5, failOnStatusCode: false, timeout: 90_000 }).then((r) => r.status(), () => 0);
      }
      seen.set(key, status || 599);
    }
    const status = seen.get(key)!;
    if (status >= 400) problems.push(`link « ${l.name} » → ${key} answers ${status}`);
  }
  return problems;
}

const CLICKABLE = 'button:visible, [role="switch"]:visible, [role="tab"]:visible, [role="menuitem"]:visible, summary:visible, label:has(input[type="checkbox"]):visible, label:has(input[type="radio"]):visible';

/** Clicks every button of the page, each on a freshly loaded page, and says which ones did nothing. */
async function checkButtons(page: Page, path: string, w: Watch): Promise<string[]> {
  const problems: string[] = [];
  await open(page, path, w);
  const count = await page.locator(CLICKABLE).count();
  const names: string[] = [];
  for (let i = 0; i < count; i++) names.push(await nameOf(page.locator(CLICKABLE).nth(i)));
  let dirty = false;
  for (let i = 0; i < count; i++) {
    const name = names[i]!;
    if (!name) {
      problems.push(`control #${i} has no accessible name`);
      continue;
    }
    if (NOT_CLICKED.test(name)) continue;
    if (dirty) {
      await apiUp();
      await open(page, path, w);
      dirty = false;
    }
    const el = page.locator(CLICKABLE).nth(i);
    if (!(await el.isVisible().catch(() => false)) || (await el.isDisabled().catch(() => false))) continue;
    if ((await nameOf(el)) !== name) continue; // the page rendered differently this time: the same control is met elsewhere
    await page.evaluate(() => {
      const g = window as unknown as { __changes: number; __observer?: MutationObserver };
      g.__observer?.disconnect();
      g.__changes = 0;
      g.__observer = new MutationObserver((list) => (g.__changes += list.length));
      g.__observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    });
    const before = { url: page.url(), requests: w.requests, focus: await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120) ?? '') };
    let download = false;
    const onDownload = () => (download = true);
    page.once('download', onDownload);
    await el.scrollIntoViewIfNeeded().catch(() => undefined);
    await el.click({ timeout: 5000 }).catch((e: Error) => problems.push(`« ${name} » cannot be clicked: ${e.message.split('\n')[0]}`));
    await page.waitForTimeout(450);
    page.off('download', onDownload);
    const after = await page
      .evaluate(() => ({ changes: (window as unknown as { __changes?: number }).__changes ?? 1, focus: document.activeElement?.outerHTML.slice(0, 120) ?? '' }))
      .catch(() => ({ changes: 1, focus: '' })); // the page navigated: it acted
    const acted = download || page.url() !== before.url || w.requests !== before.requests || after.changes > 0 || after.focus !== before.focus;
    if (!acted) problems.push(`« ${name} » does nothing`);
    dirty = true;
  }
  return problems;
}

test.describe('client space — every control works where it is shown (D-098)', () => {
  test('a filled space: no dead link, no dead button, no error on any page', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the full audit runs once, on a computer; the phone frame has its own test');
    test.setTimeout(1_500_000);
    await freshIp(page);
    await apiReady(page);
    const { email } = await signUpClient(page);
    await page.evaluate(() => localStorage.setItem('dp_tour_space', '1'));
    const space = await fillSpace(page, email);
    const w = watch(page);
    const seen = new Map<string, number>();
    const report: string[] = [];
    for (const path of pagesOf(space)) {
      await apiUp();
      const at = w.problems.length;
      await open(page, path, w);
      const found = [...(await checkLinks(page, path, seen)), ...(await checkButtons(page, path, w))];
      await Promise.all(w.pending.splice(0));
      for (const p of [...w.problems.slice(at), ...found]) report.push(`${path} — ${p}`);
    }
    expect(report, report.join('\n')).toEqual([]);
  });

  test('an empty space: every page says what will come and offers an action that works', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once');
    test.setTimeout(600_000);
    await freshIp(page);
    await apiReady(page);
    await signUpClient(page, 'Nadia');
    await page.evaluate(() => localStorage.setItem('dp_tour_space', '1'));
    const w = watch(page);
    const seen = new Map<string, number>();
    const report: string[] = [];
    for (const path of pagesOf(null)) {
      await apiUp();
      const at = w.problems.length;
      await open(page, path, w);
      const found = [...(await checkLinks(page, path, seen)), ...(await checkButtons(page, path, w))];
      await Promise.all(w.pending.splice(0));
      for (const p of [...w.problems.slice(at), ...found]) report.push(`${path} — ${p}`);
    }
    expect(report, report.join('\n')).toEqual([]);
  });

  test('on a phone: the five tabs, « Plus » and « Écrire à mon conseiller » lead somewhere; targets of 44 px', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone frame');
    test.setTimeout(240_000);
    // Next's development badge sits over the first tab at 390 px (development only): out of the way of the taps.
    await page.addInitScript(() => {
      const hide = () => document.head?.insertAdjacentHTML('beforeend', '<style>nextjs-portal{display:none!important}</style>');
      if (document.head) hide();
      else document.addEventListener('DOMContentLoaded', hide);
    });
    await freshIp(page);
    await apiReady(page);
    await signUpClient(page);
    await page.evaluate(() => localStorage.setItem('dp_tour_space', '1'));
    const w = watch(page);
    await open(page, '/espace-client');
    const tabs = page.getByRole('navigation', { name: 'Navigation de mon espace' });
    for (const [name, url] of [
      ['Biens', /\/espace-client\/interets/],
      ['Messages', /\/espace-client\/messages/],
      ['Accueil', /\/espace-client$/],
    ] as const) {
      await tabs.getByText(name, { exact: true }).click();
      await expect(page).toHaveURL(url);
    }
    const sheet = page.getByRole('dialog', { name: 'Plus' });
    // the development server hydrates late: a tap before React has taken the page over does nothing yet
    await expect(async () => {
      if (!(await sheet.isVisible())) await tabs.getByText('Plus', { exact: true }).click();
      await expect(sheet).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    for (const name of ['Simulations', 'Favoris', 'Alertes', 'Mon profil']) await expect(sheet.getByRole('link', { name })).toBeVisible();
    await sheet.getByRole('link', { name: 'Favoris' }).click();
    await expect(page).toHaveURL(/\/espace-client\/favoris/);
    await page.getByRole('link', { name: 'Écrire à mon conseiller' }).last().click();
    await expect(page).toHaveURL(/\/espace-client\/messages/);

    // TRV-121 — touch targets of 44 px at least on the pages of the space.
    const small: string[] = [];
    for (const path of ['/espace-client', '/espace-client/interets', '/espace-client/simulations', '/espace-client/alertes', '/espace-client/profil/confidentialite']) {
      await open(page, path, w);
      const found = await page.locator('main#contenu a:visible, main#contenu button:visible').evaluateAll((nodes) =>
        nodes
          .map((n) => ({ r: n.getBoundingClientRect(), name: (n.getAttribute('aria-label') || n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), inline: getComputedStyle(n).display === 'inline' }))
          // a link inside a sentence is text (TRV-124: underlined), not a target of its own
          .filter((x) => !x.inline && x.r.width > 0 && (x.r.height < 43.5 || x.r.width < 43.5))
          .map((x) => `${x.name} (${Math.round(x.r.width)}×${Math.round(x.r.height)})`),
      );
      for (const f of found) small.push(`${path} — ${f}`);
    }
    expect(small, small.join('\n')).toEqual([]);
    expect(w.problems, w.problems.join('\n')).toEqual([]);
  });
});
