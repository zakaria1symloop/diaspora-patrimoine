// Public-site review helper: like shots.mjs, but waits for the API (it restarts while others work) and retries a 5xx.
// Usage: node public-shots.mjs <outDir> [--w=1440|390] <path> …   ·   a path may carry "#name" to name the file
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const outDir = args.shift() ?? './shots';
const only = args.find((a) => a.startsWith('--w='))?.slice(4);
const paths = args.filter((a) => !a.startsWith('--'));
const base = process.env.WEB_URL ?? 'http://localhost:3000';
const api = process.env.API_URL ?? 'http://localhost:4000/api/v1/public/health';
mkdirSync(outDir, { recursive: true });

async function apiUp() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(api)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
}
const browser = await chromium.launch();
for (const width of only ? [Number(only)] : [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
  // SIMPLE=1: « Affichage simplifié » on (TRV-122) · consent already given, so that the banner does not cover the page
  if (process.env.SIMPLE) await page.addInitScript(() => localStorage.setItem('dp_simple_mode', '1'));
  await page.context().addCookies([{ name: 'dp_consent', value: 'none', url: base }]);
  for (const raw of paths.length ? paths : ['/']) {
    const [path, label] = raw.split('#');
    let status = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      await apiUp();
      try {
        const res = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 90000 });
        status = res?.status() ?? 0;
      } catch { status = 0; }
      if (status && status < 500) break;
      await new Promise((r) => setTimeout(r, 4000));
    }
    // walk down the page so that lazy images and on-scroll entrances happen, then back to the top
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      window.scrollTo(0, 0);
    }).catch(() => undefined);
    await page.waitForTimeout(2600);
    const name = `${label ?? (path === '/' ? 'home' : path.replace(/\W+/g, '-').replace(/^-|-$/g, ''))}-${width}.png`;
    await page.screenshot({ path: join(outDir, name), fullPage: true });
    console.log(`${status} ${path} → ${name}`);
  }
  await page.close();
}
await browser.close();
