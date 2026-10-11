// Back office — what a role sees and may do (ROL-011, ROL-013, ROL-015, ROL-023, SEC-030, SEC-032): an adviser reads
// the team without managing it; a role change closes the sessions at once; the SUPPORT role reads the requests with
// personal data and free text masked BY THE SERVER, and cannot search on a name.
// One persistent second staff account (`conseiller.test@example.test`), invited once through the real « Inviter »
// window and kept in `.local/e2e-admin.json`; its role is put back at the end.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { ADMIN, adminPost, completeInvitation, readState, signIn, signInDirection } from './helpers/admin.js';

const AGENT_EMAIL = 'conseiller.test@example.test';

interface Member {
  id: string;
  email: string;
  role: string;
  status: string;
  twoFactorEnabled: boolean | null;
}

async function member(direction: Page): Promise<Member | null> {
  const r = await direction.request.get(`${ADMIN}/api/v1/admin/users?q=${encodeURIComponent(AGENT_EMAIL)}`);
  return ((await r.json()) as { data: Member[] }).data.find((m) => m.email === AGENT_EMAIL) ?? null;
}

/** The adviser account, ACTIVE with the role asked; signs it in on a fresh context and returns its page. */
async function agentPage(browser: Browser, direction: Page, role: 'AGENT' | 'SUPPORT'): Promise<Page> {
  let m = await member(direction);
  if (!m) {
    const r = await adminPost(direction, direction.request, '/admin/users/invite', { firstName: 'Sofiane', lastName: 'Conseiller', email: AGENT_EMAIL, role, jobTitle: 'Conseiller' });
    expect(r.status()).toBe(201);
    m = (await member(direction))!;
  }
  if (m.status === 'SUSPENDED') expect((await adminPost(direction, direction.request, `/admin/users/${m.id}/reactivate`)).status()).toBe(200);
  if (m.role !== role) expect((await adminPost(direction, direction.request, `/admin/users/${m.id}/change-role`, { role })).status()).toBe(200);
  const page = await (await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 900 } })).newPage();
  const known = readState(AGENT_EMAIL);
  if (m.status === 'INVITED' || !known) {
    if (m.status !== 'INVITED') throw new Error(`${AGENT_EMAIL} exists but these tests do not know its password: remove it from the team or restore .local/e2e-admin.json`);
    if (known) expect((await adminPost(direction, direction.request, `/admin/users/${m.id}/resend-invitation`)).status()).toBe(200);
    await completeInvitation(page, AGENT_EMAIL);
  } else {
    expect(await signIn(page, known)).toBe(true);
  }
  return page;
}

test.describe('back office — roles', () => {
  test.skip(({ isMobile }) => isMobile, 'the back office is designed for 1280 px and more (TRV-130)');

  test('an adviser reads without managing; a role change closes his sessions; SUPPORT reads masked data', async ({ page, browser }) => {
    test.setTimeout(300_000);
    await signInDirection(page);

    // ─── AGENT ───
    const agent = await agentPage(browser, page, 'AGENT');
    const nav = agent.getByRole('navigation', { name: 'Menu principal' });
    await expect(nav.getByRole('link', { name: /Demandes/ })).toBeVisible();
    // CRM-003 — default view of an adviser: « À prendre en charge »
    await agent.goto(`${ADMIN}/demandes`);
    await expect(agent.getByRole('tab', { name: /À prendre en charge/ })).toHaveAttribute('aria-selected', 'true');
    // ROL-023 — the team is read (`user.read`) without its buttons of action
    await agent.goto(`${ADMIN}/equipe`);
    await expect(agent.getByRole('heading', { name: 'Équipe', level: 1 })).toBeVisible();
    await expect(agent.getByRole('row').filter({ hasText: 'direction.test@example.test' })).toBeVisible();
    await expect(agent.getByRole('button', { name: 'Inviter' })).toHaveCount(0);
    await expect(agent.getByRole('button', { name: /^Actions sur le compte/ })).toHaveCount(0);
    // ROL-020 — and the API refuses what the screen hides
    const refused = await adminPost(agent, agent.request, '/admin/users/invite', { firstName: 'X', lastName: 'Y', email: 'x.y@example.test', role: 'VIEWER' });
    expect(refused.status()).toBe(403);
    const m = (await member(page))!;
    expect((await adminPost(agent, agent.request, `/admin/users/${m.id}/reset-two-factor`, { reason: 'test' })).status()).toBe(403);

    // ─── ROL-013 — a role change takes effect at once: the open session is closed ───
    expect((await adminPost(page, page.request, `/admin/users/${m.id}/change-role`, { role: 'SUPPORT' })).status()).toBe(200);
    expect((await agent.request.get(`${ADMIN}/api/v1/admin/me/shell`)).status()).toBe(401);
    await agent.goto(`${ADMIN}/equipe`);
    await expect(agent).toHaveURL(/\/connexion/, { timeout: 30_000 });

    // ─── SUPPORT (ROL-015, SEC-032) ───
    expect(await signIn(agent, readState(AGENT_EMAIL)!)).toBe(true);
    await expect(agent.getByText('Données personnelles masquées.')).toBeVisible();
    const list = await agent.request.get(`${ADMIN}/api/v1/admin/leads?view=all&kind=CONTACT_MESSAGE`);
    expect(list.status()).toBe(200);
    const rows = ((await list.json()) as { data: { reference: string; clientName: string | null }[] }).data;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) if (r.clientName) expect(r.clientName).toMatch(/^(\S•••••)( \S•••••)*$/);
    const detail = (await (await agent.request.get(`${ADMIN}/api/v1/admin/leads/${rows[0]!.reference}`)).json()) as { sent: { masked: boolean; message: string | null; person: { email: string | null; phone: string | null; firstName: string | null } } };
    expect(detail.sent.masked).toBe(true);
    expect(detail.sent.message).toBeNull(); // free text never leaves the API
    expect(detail.sent.person.firstName).toBeNull();
    if (detail.sent.person.email) expect(detail.sent.person.email).toMatch(/^.•••@•••\.[a-z]+$/);
    // a search on a name returns nothing; the reference still finds
    const direct = (await (await page.request.get(`${ADMIN}/api/v1/admin/leads/${rows[0]!.reference}`)).json()) as { sent: { person: { lastName: string | null } } };
    const lastName = direct.sent.person.lastName;
    if (lastName) {
      const byName = (await (await agent.request.get(`${ADMIN}/api/v1/admin/search?q=${encodeURIComponent(lastName)}&types=LEAD,CLIENT`)).json()) as { groups: unknown[] };
      expect(byName.groups).toEqual([]);
    }
    const byRef = (await (await agent.request.get(`${ADMIN}/api/v1/admin/search?q=${rows[0]!.reference}&types=LEAD`)).json()) as { groups: { hits: { exact: boolean }[] }[] };
    expect(byRef.groups[0]?.hits[0]?.exact).toBe(true);
    // never the content of a note (`note.read` is not held by SUPPORT)
    expect((await agent.request.get(`${ADMIN}/api/v1/admin/notes?entityType=LEAD&entityId=00000000-0000-4000-8000-000000000000`)).status()).toBe(403);
    // on the screen: « Contenu masqué », and no note button
    await agent.goto(`${ADMIN}/demandes/${rows[0]!.reference.toLowerCase()}`);
    await expect(agent.getByText('Contenu masqué').first()).toBeVisible({ timeout: 30_000 });
    await expect(agent.getByRole('group', { name: 'Ajout rapide' })).toHaveCount(0);

    // the account goes back to its role
    expect((await adminPost(page, page.request, `/admin/users/${m.id}/change-role`, { role: 'AGENT' })).status()).toBe(200);
    await agent.context().close();
  });
});
