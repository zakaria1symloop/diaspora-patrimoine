// Visual review helper: screenshots of pages at 1440 and 390 px (DSN-080 reference widths).
// Usage: node shots.mjs <outDir> <path> [<path>…]   e.g. node shots.mjs ./shots / /une-page-inconnue
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [outDir = './shots', ...paths] = process.argv.slice(2);
const base = process.env.WEB_URL ?? 'http://localhost:3000';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const width of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
  for (const path of paths.length ? paths : ['/']) {
    const res = await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2600); // scenes finish drawing (DSN-076: 2 400 ms)
    const name = `${(path === '/' ? 'home' : path.replace(/\W+/g, '-').replace(/^-|-$/g, ''))}-${width}.png`;
    await page.screenshot({ path: join(outDir, name), fullPage: true });
    console.log(`${res?.status()} ${path} → ${name}`);
  }
  await page.close();
}
await browser.close();
