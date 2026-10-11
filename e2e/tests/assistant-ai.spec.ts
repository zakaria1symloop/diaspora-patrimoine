// EP-22, mode AI (ASS-050 to ASS-052) against the local stack. Without a provider configured (ENV-040 `AI_PROVIDER`,
// `AI_API_KEY` empty), the setting `features.assistant.mode` = AI must give the guided questionnaire, without an error
// message, and the message route must answer with a `fallback` event only. The setting is switched through the ops
// command (audit `setting.updated`) and restored to its installed value afterwards.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type APIRequestContext } from '@playwright/test';

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/api');
const randomIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

function ops(...args: string[]): string {
  return execFileSync(process.execPath, ['--env-file-if-exists=.env', 'dist/install/ops.js', ...args], { cwd: apiDir, encoding: 'utf8' });
}
function currentMode(): string {
  return /=\s*"(\w+)"/.exec(ops('setting:get', '--key', 'features.assistant.mode'))?.[1] ?? 'GUIDED';
}

/** The API reads its settings with a one-minute cache (PAR-101): wait until it sees the value (a restart of the local API answers 5xx meanwhile). */
async function waitForMode(request: APIRequestContext, mode: string) {
  const read = async () => {
    const res = await request.get('/api/v1/public/settings/public').catch(() => null);
    if (!res?.ok()) return null;
    return ((await res.json()) as Record<string, unknown>)['features.assistant.mode'];
  };
  await expect.poll(read, { timeout: 90_000, intervals: [2_000] }).toBe(mode);
}

let installed = 'GUIDED';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  test.setTimeout(150_000);
  installed = currentMode();
  ops('setting:set', '--key', 'features.assistant.mode', '--value', '"AI"', '--reason', 'e2e assistant-ai: fallback sans fournisseur');
  await waitForMode(request, 'AI');
});

test.afterAll(async ({ request }) => {
  test.setTimeout(150_000);
  ops('setting:set', '--key', 'features.assistant.mode', '--value', JSON.stringify(installed), '--reason', 'e2e assistant-ai: retour à la valeur installée');
  await waitForMode(request, installed);
});

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': randomIp() });
});

test('mode AI without a provider: status GUIDED, the message route answers « fallback » only', async ({ request }) => {
  const status = await request.get('/api/v1/public/assistant/status');
  expect(status.ok()).toBe(true);
  expect(await status.json()).toEqual({ mode: 'GUIDED' });

  const res = await request.post('/api/v1/public/assistant/messages', { data: { message: 'Un T3 à Alger pour moins de 600 € par mois' }, headers: { 'X-Forwarded-For': randomIp() } });
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/event-stream');
  expect(await res.text()).toBe('event: fallback\ndata: {"type":"fallback"}\n\n');

  // validation still answers before any stream (API-020)
  const bad = await request.post('/api/v1/public/assistant/messages', { data: { message: 'x'.repeat(501) }, headers: { 'X-Forwarded-For': randomIp() } });
  expect(bad.status()).toBe(422);
});

test('mode AI without a provider: the page shows the guided questionnaire, without an error message', async ({ page }) => {
  await page.goto('/assistant');
  await expect(page.getByRole('heading', { level: 1, name: 'Assistant de recherche' })).toBeVisible();
  await expect(page.getByText('Bonjour. Cinq questions, et je vous montre les biens qui vous correspondent.')).toBeVisible();
  await expect(page.getByText('Question 1 sur 5')).toBeVisible();
  await expect(page.getByLabel('Dites-nous ce que vous cherchez, avec vos mots')).toHaveCount(0);
  await expect(page.getByText('Écrire avec mes mots')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0); // (Next's route announcer is an alert outside main)
});
