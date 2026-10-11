// D-098 « chaque bouton montré fonctionne là où il est » — the dead-control audit of the PUBLIC site. On every public
// page, with the demonstration catalogue and Cafés loaded, it fails on:
//   · a console error or an uncaught exception, a response in 4xx/5xx (other than the 401 of a session probe and the
//     answers a page is there to show: 404, 410, 503);
//   · a link that leads nowhere: no address, « # », an anchor whose target is not on the page, an internal address
//     that answers 4xx/5xx (every internal link is requested once);
//   · a button, tab, switch, disclosure or checkbox that does NOTHING when clicked: no change on the page, no
//     navigation, no request, no window, no download — each one is clicked on a freshly loaded page; when a click
//     opens a window or a panel, every control inside it is clicked the same way (second level);
//   · a control without an accessible name;
//   · on a phone: a page wider than the screen (DSN-080) or a touch target under 44 px (TRV-121).
// The header, the footer and the cookie banner are audited once, on the home page; elsewhere only the page's own
// content is clicked. One test per family: `npx playwright test tests/public-controls.spec.ts -g catalogue`.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { freshIp } from './helpers/account';

const API_HEALTH = 'http://localhost:4000/api/v1/public/health';
const BIEN = '/biens/appartement-t3-residence-el-yasmine-alger-dp-dz-0142';
const PROGRAMME = '/programmes/residence-el-yasmine';
const CAFE = '/le-cafe/paris-17-octobre-2026';

interface Target {
  path: string;
  /** Status the page itself is there to answer (404, 410, 503): not a fault. */
  expect?: number;
  /** Failed calls this page makes on purpose (an unknown token answers 404 or 410). */
  allow?: RegExp;
}

const FAMILIES: Record<string, Target[]> = {
  accueil: [{ path: '/' }],
  catalogue: [
    { path: '/programmes' },
    { path: '/programmes?region=alger' },
    { path: '/programmes?vue=carte' },
    { path: '/programmes?grouper=programme' },
    { path: '/programmes?q=zzzzqqq' },
  ],
  fiches: [{ path: BIEN }, { path: PROGRAMME }, { path: '/biens/bien-inconnu', expect: 404 }],
  cafe: [{ path: '/le-cafe' }, { path: CAFE }, { path: '/le-cafe/inscription/jeton-inconnu', allow: /registrations/ }],
  financement: [
    { path: '/financements' },
    { path: '/financements/simulateur-eligibilite' },
    { path: '/financements/simulateur-credit' },
    { path: '/projection' },
    { path: '/assistant' },
  ],
  pages: [
    { path: '/notre-concept' },
    { path: '/faq' },
    { path: '/contact' },
    { path: '/promoteurs' },
    { path: '/promoteurs/bahia-promotion' },
    { path: '/nos-partenaires' },
    { path: '/devenir-partenaire' },
    { path: '/mentions-legales' },
    { path: '/confidentialite' },
    { path: '/conditions-generales' },
    { path: '/cookies' },
    { path: '/charte-partenaires' },
    { path: '/une-page-inconnue', expect: 404 },
    // shown only when maintenance (NAV-061) or the acceptance gate (NAV-064) is on: off locally, they answer 404
    { path: '/maintenance', expect: 404 },
    { path: '/attente', expect: 404 },
  ],
  compte: [
    { path: '/inscription' },
    { path: '/connexion' },
    { path: '/connexion/lien' },
    { path: '/verification' },
    { path: '/mot-de-passe-oublie' },
    { path: '/verification/jeton-inconnu', allow: /auth|verif/ },
    { path: '/reinitialisation/jeton-inconnu', allow: /auth|reset|password/ },
    { path: '/activation/jeton-inconnu', allow: /auth|activ/ },
    { path: '/partenaires/inscription' },
    { path: '/partenaires/connexion' },
    { path: '/partenaires/mot-de-passe-oublie' },
    { path: '/favoris' },
    { path: '/comparer' },
    { path: '/alertes/jeton-inconnu', allow: /alerts/ },
    { path: '/preferences/jeton-inconnu', allow: /preferences/ },
  ],
};

/** Never clicked: they would leave the site for another application or print. */
const NOT_CLICKED = /^(Imprimer|Télécharger en PDF)/;

interface Watch {
  problems: string[];
  requests: number;
  allow?: RegExp;
  expectStatus?: number;
}

function watch(page: Page): Watch {
  const w: Watch = { problems: [], requests: 0 };
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/Failed to load resource/.test(text)) return; // reported by the response listener, with its address
    // the local dev server reloading (HMR socket) and the local map provider (OpenFreeMap, Q-056) are not the page's
    if (/_next\/hmr|tiles\.openfreemap\.org/.test(text)) return;
    // React in development, when it renders the document on the client (a 404 inside the site): the two inline boot
    // scripts of the root layout (text size, simplified display) — never printed in production
    if (/Encountered a script tag/.test(text) && w.expectStatus === 404) return;
    w.problems.push(`console: ${text.slice(0, 300)}`);
  });
  page.on('pageerror', (e) => w.problems.push(`exception: ${e.message.slice(0, 300)}`));
  page.on('request', () => w.requests++);
  page.on('response', (r) => {
    const url = r.url();
    if (r.status() < 400 || !url.startsWith('http://localhost')) return;
    if (r.request().resourceType() === 'document') return; // judged by open()
    // a visitor without a session: the probe answers 401 (AUTH-023), that is the mechanism
    if (r.status() === 401 && /\/api\/v1\/(client|auth|partner)\//.test(url)) return;
    if (w.allow && w.allow.test(url)) return;
    w.problems.push(`${r.status()} ${r.request().method()} ${url.replace('http://localhost:3000', '')}`);
  });
  return w;
}

async function apiUp(page: Page): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const ok = await page.request.get(API_HEALTH, { failOnStatusCode: false, timeout: 4000 }).then((r) => r.ok(), () => false);
    if (ok) return;
    await page.waitForTimeout(3000);
  }
}

/**
 * Opens a page and waits for it to be still. The local API restarts whenever its code is rebuilt (several people work
 * on it): a page caught during a restart answers 500 — wait for the API and open it again; what the restart produced
 * is not the page's fault.
 */
async function open(page: Page, target: Target, w: Watch): Promise<void> {
  w.allow = target.allow;
  w.expectStatus = target.expect ?? 200;
  const wanted = target.expect ?? 200;
  for (let attempt = 0; ; attempt++) {
    const at = w.problems.length;
    const res = await page.goto(target.path, { waitUntil: 'load', timeout: 90_000 }).catch(() => null);
    const status = res?.status() ?? 0;
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    const broken = status !== wanted && (status === 0 || status >= 500);
    const failedCalls = w.problems.slice(at).some((p) => /^(5\d\d|0) /.test(p) || /fetch failed|ECONNREFUSED|Failed to fetch/.test(p));
    if (!broken && !failedCalls) {
      if (status !== wanted) w.problems.push(`page answers ${status}, expected ${wanted}`);
      return;
    }
    if (attempt >= 5) {
      w.problems.push(`page answers ${status} after ${attempt + 1} tries`);
      return;
    }
    w.problems.length = at;
    await page.waitForTimeout(3000);
    await apiUp(page);
  }
}

const nameOf = (el: Locator) =>
  el.evaluate((node) => {
    const e = node as HTMLElement;
    const labelled = e.getAttribute('aria-labelledby');
    const byId = labelled ? labelled.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ') : '';
    return (e.getAttribute('aria-label') || byId || e.textContent || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
  });

async function checkLinks(page: Page, scope: string, path: string, seen: Map<string, number>, pageStatus = 200): Promise<string[]> {
  const problems: string[] = [];
  const linkSelector = scope.split(',').map((sc) => `${sc.trim()} a:visible`).join(', ');
  const links = await page.locator(linkSelector).evaluateAll((nodes) =>
    nodes.map((n) => ({
      href: n.getAttribute('href'),
      name: (n.getAttribute('aria-label') || n.textContent || n.querySelector('img')?.getAttribute('alt') || '').replace(/\s+/g, ' ').trim(),
      hidden: n.getAttribute('aria-hidden') === 'true',
    })),
  );
  const here = new URL(`http://localhost:3000${path}`);
  for (const l of links) {
    if (!l.hidden && !l.name) problems.push(`link without a name → ${l.href}`);
    if (!l.href || l.href === '#' || l.href.startsWith('javascript:')) {
      problems.push(`link « ${l.name} » leads nowhere (${l.href ?? 'no address'})`);
      continue;
    }
    if (/^(tel:|mailto:|https?:\/\/(?!localhost))/.test(l.href)) continue;
    const url = new URL(l.href, here);
    if (url.hash && url.pathname === here.pathname && url.search === here.search) {
      const there = await page.locator(`[id="${url.hash.slice(1)}"]`).count();
      if (!there) problems.push(`link « ${l.name} » points to ${url.hash}, which is not on the page`);
      continue;
    }
    const key = url.pathname + url.search;
    if (!seen.has(key)) {
      let status = 0;
      for (let i = 0; i < 4; i++) {
        const res = await page.request.get(key, { maxRedirects: 5, failOnStatusCode: false, timeout: 60_000 }).catch(() => null);
        status = res?.status() ?? 0;
        if (status && status < 500) break;
        await apiUp(page);
      }
      seen.set(key, status);
    }
    const status = seen.get(key)!;
    if (url.pathname === here.pathname && status === pageStatus) continue; // the same page, with a window open on it
    if (status >= 400 || status === 0) problems.push(`link « ${l.name} » → ${key} answers ${status}`);
  }
  return problems;
}

const KINDS = ['button', '[role="switch"]', '[role="tab"]', '[role="menuitem"]', '[role="option"]', 'summary', 'label:has(input[type="checkbox"])', 'label:has(input[type="radio"])'];
const clickable = (scope: string) =>
  scope
    .split(',')
    .flatMap((sc) => KINDS.map((k) => `${sc.trim()} ${k}:visible`))
    .join(', ');
/** What a click may open: a window, a side panel, a menu, a list. */
const OPENED = 'dialog[open], [role="dialog"]:visible, [role="menu"]:visible, [role="listbox"]:visible';

async function arm(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = window as unknown as { __changes: number; __observer?: MutationObserver };
    g.__observer?.disconnect();
    g.__changes = 0;
    g.__observer = new MutationObserver((list) => (g.__changes += list.length));
    g.__observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  });
}

/** Clicks `el`; says whether anything happened (page change, navigation, request, download, focus). */
async function acts(page: Page, el: Locator, w: Watch): Promise<boolean | string> {
  await arm(page);
  const before = { url: page.url(), requests: w.requests, focus: await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120) ?? '') };
  let download = false;
  const onDownload = () => (download = true);
  page.once('download', onDownload);
  await el.scrollIntoViewIfNeeded().catch(() => undefined);
  const failed = await el.click({ timeout: 5000 }).then(() => null, (e: Error) => e.message.split('\n')[0] ?? 'error');
  if (failed) {
    page.off('download', onDownload);
    return failed;
  }
  await page.waitForTimeout(450);
  page.off('download', onDownload);
  const after = await page
    .evaluate(() => ({ changes: (window as unknown as { __changes?: number }).__changes ?? 1, focus: document.activeElement?.outerHTML.slice(0, 120) ?? '' }))
    .catch(() => ({ changes: 1, focus: '' })); // the page navigated: it acted
  return download || page.url() !== before.url || w.requests !== before.requests || after.changes > 0 || after.focus !== before.focus;
}

async function namesOf(page: Page, selector: string): Promise<string[]> {
  const n = await page.locator(selector).count();
  const names: string[] = [];
  for (let i = 0; i < n; i++) names.push(await nameOf(page.locator(selector).nth(i)).catch(() => ''));
  return names;
}

/** Clicks every control of the scope, each on a freshly loaded page; then every control of what a click opened. */
async function checkButtons(page: Page, scope: string, target: Target, w: Watch): Promise<string[]> {
  const problems: string[] = [];
  const selector = clickable(scope);
  await open(page, target, w);
  const names = await namesOf(page, selector);
  let dirty = false;
  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    if (!name) {
      const html = await page.locator(selector).nth(i).evaluate((n) => n.outerHTML.slice(0, 140)).catch(() => '');
      problems.push(`control #${i} has no accessible name: ${html}`);
      continue;
    }
    if (NOT_CLICKED.test(name)) continue;
    if (dirty) await open(page, target, w);
    dirty = true;
    const el = page.locator(selector).nth(i);
    if (!(await el.isVisible().catch(() => false)) || (await el.isDisabled().catch(() => false))) continue;
    if ((await nameOf(el)) !== name) continue; // rendered differently this time: the same control is met elsewhere
    const url = page.url();
    const result = await acts(page, el, w);
    if (typeof result === 'string') problems.push(`« ${name} » cannot be clicked: ${result}`);
    else if (!result) problems.push(`« ${name} » does nothing`);
    if (page.url() !== url) continue;

    // Second level — the window, panel or menu this click opened.
    const inner = clickable(OPENED.replace(/:visible/g, ''));
    const innerNames = await namesOf(page, inner).catch(() => []);
    if (!innerNames.length || innerNames.length > 40) continue;
    for (let j = 0; j < innerNames.length; j++) {
      const innerName = innerNames[j]!;
      if (!innerName) {
        problems.push(`in « ${name} »: control #${j} has no accessible name`);
        continue;
      }
      if (NOT_CLICKED.test(innerName)) continue;
      if (j > 0) {
        await open(page, target, w);
        const again = page.locator(selector).nth(i);
        if ((await nameOf(again).catch(() => '')) !== name) break;
        await again.click({ timeout: 5000 }).catch(() => undefined);
        await page.waitForTimeout(350);
      }
      const child = page.locator(inner).nth(j);
      if (!(await child.isVisible().catch(() => false)) || (await child.isDisabled().catch(() => false))) continue;
      if ((await nameOf(child).catch(() => '')) !== innerName) continue;
      const r = await acts(page, child, w);
      if (typeof r === 'string') problems.push(`in « ${name} »: « ${innerName} » cannot be clicked: ${r}`);
      else if (!r) problems.push(`in « ${name} »: « ${innerName} » does nothing`);
    }
  }
  return problems;
}

/**
 * What the shared local stack produces while someone else rebuilds the API or the site (both restart several times an
 * hour): a 5xx, a refused connection, a message missing until the dev server reloads its texts, a click that timed out
 * while the page was being recompiled. A page that met one of them is audited again once, after the stack is back;
 * only what happens twice is reported.
 */
const TRANSIENT = /^(5\d\d|0) |fetch failed|ECONNREFUSED|ECONNRESET|Missing message|cannot be clicked: .*Timeout|Encountered a script tag/;

async function audit(page: Page, targets: Target[], scope: (t: Target) => string): Promise<string[]> {
  await freshIp(page);
  const w = watch(page);
  const seen = new Map<string, number>();
  const report: string[] = [];
  for (const target of targets) {
    let found: string[] = [];
    for (let round = 0; round < 3; round++) {
      const at = w.problems.length;
      await open(page, target, w);
      const sc = scope(target);
      // one frame per page: a 404 inside the site once drew the header, the main and the footer twice
      const frames = await page.evaluate(() => ({ main: document.querySelectorAll('main').length, footer: document.querySelectorAll('body > footer').length }));
      if (frames.main !== 1 || frames.footer > 1) w.problems.push(`the page has ${frames.main} main and ${frames.footer} footer elements`);
      const checked = [...(await checkLinks(page, sc, target.path, seen, target.expect ?? 200)), ...(await checkButtons(page, sc, target, w))];
      found = [...new Set([...w.problems.slice(at), ...checked])];
      if (round < 2 && found.some((p) => TRANSIENT.test(p))) {
        await page.waitForTimeout(10_000);
        await apiUp(page);
        for (const [k, v] of seen) if (v >= 500 || v === 0) seen.delete(k);
        continue;
      }
      break;
    }
    for (const p of found) report.push(`${target.path} — ${p}`);
  }
  return report;
}

/** The consent choice is made beforehand, so that the banner does not cover the page (it has its own test). */
async function consentGiven(page: Page): Promise<void> {
  await page.context().addCookies([{ name: 'dp_consent', value: 'none', url: 'http://localhost:3000' }]);
}

const contentScope = () => 'main#contenu';

test.describe('public site — every control works where it is shown (D-098)', () => {
  test('cadre: header, footer and cookie banner, on the home page', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once, on a computer');
    test.setTimeout(1_200_000);
    const report = await audit(page, [{ path: '/' }], () => 'header, footer, [data-consent]');
    expect(report, report.join('\n')).toEqual([]);
  });

  for (const [family, targets] of Object.entries(FAMILIES)) {
    test(`${family}: no dead link, no dead button, no error`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'once, on a computer; the phone has its own test');
      test.setTimeout(2_400_000);
      await consentGiven(page);
      const report = await audit(page, targets, contentScope);
      expect(report, report.join('\n')).toEqual([]);
    });
  }

  test('phone: no page wider than the screen, touch targets of 44 px', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone frame');
    test.setTimeout(1_200_000);
    await consentGiven(page);
    await freshIp(page);
    const w = watch(page);
    const report: string[] = [];
    for (const target of Object.values(FAMILIES).flat()) {
      let at = w.problems.length;
      await open(page, target, w);
      // the shared stack restarting (5xx, refused connection): the page is opened again once, after it is back
      if (w.problems.slice(at).some((p) => TRANSIENT.test(p))) {
        w.problems.length = at;
        await page.waitForTimeout(10_000);
        await apiUp(page);
        at = w.problems.length;
        await open(page, target, w);
      }
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (wide > 1) report.push(`${target.path} — page wider than the screen by ${wide} px`);
      const small = await page.locator('main a:visible, main button:visible').evaluateAll((nodes) =>
        nodes
          // a link stretched over its card (::after covering it) is as big as the card; the map's own controls are the map's
          .filter((n) => !n.closest('.maplibregl-map'))
          .map((n) => {
            const after = getComputedStyle(n, '::after');
            const stretched = after.content !== 'none' && after.position === 'absolute' && n.parentElement;
            const r = stretched ? ((n as HTMLElement).offsetParent ?? n).getBoundingClientRect() : n.getBoundingClientRect();
            return { r, name: (n.getAttribute('aria-label') || n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), inline: getComputedStyle(n).display === 'inline' };
          })
          // a link inside a sentence is text (TRV-124: underlined), not a target of its own
          .filter((x) => !x.inline && x.r.width > 0 && (x.r.height < 43.5 || x.r.width < 43.5))
          .map((x) => `${x.name} (${Math.round(x.r.width)}×${Math.round(x.r.height)})`),
      );
      for (const f of [...new Set(small)]) report.push(`${target.path} — small target: ${f}`);
      for (const p of w.problems.slice(at)) report.push(`${target.path} — ${p}`);
    }
    expect(report, report.join('\n')).toEqual([]);
  });
});
