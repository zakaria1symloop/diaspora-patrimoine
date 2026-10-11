# Back-office shell — how a module plugs in

`apps/admin` is the back office (BO-001: its own host, port 3001 locally, never indexed). Packages 1.8 and 3.1 own the
**frame** and the **templates**; a Lot 3 module (requests processing, clients, dossiers, catalogue, tasks…) only adds
its pages, its components, its texts and its API module. Specs: `Specs/04-back-office/01-socle.md`.

Rules that apply to every screen (owner's rules, `CLAUDE.md`): the work zone uses the **full width**; a list is the
list template, a record is the record template — never a hand-made table; every control shown works; nothing leads to
a function that is not delivered; filters are an **inline bar** (never a centred window); one fixed-height top bar.

## 1. Where things go

| What | Where |
|---|---|
| Page of a module | `apps/admin/src/app/(shell)/<adresse>/page.tsx` — the layout `(shell)/layout.tsx` wraps it (frame, session, toasts) |
| Components of a module | `apps/admin/src/components/<module>/` (CSS modules next to them) |
| Texts | `packages/i18n/messages/fr/admin-<module>.json` → keys `ui.admin-<module>.…` (then `pnpm --filter @dp/i18n build`). Never French in a component. Shared words: `ui.common.*`, enumerations: `ui.enum.{Enum}.{VALUE}`, shell: `ui.admin-shell.*` |
| Wire contracts | `packages/contracts/src/admin-<module>.ts`, one `export *` line appended to `index.ts` |
| API | `apps/api/src/<module>-admin/` (or your module), routes under `/admin/*` with `@RequirePermission('…')` |
| Pages outside the frame | `app/(door)/…` — sign-in, invitation, forgotten password (EA-00). You should not need it |

Addresses are the ones of `menu.ts` (they are already used by the e-mails and the notifications of the API,
`apps/api/src/automation/staff-links.ts`): `/demandes`, `/demandes/{référence}`, `/clients`, `/clients/{id}`,
`/dossiers`, `/dossiers/pipeline`, `/dossiers/{référence}`, `/taches`, `/agenda`, `/catalogue/programmes`,
`/catalogue/biens`, `/promoteurs`, `/banques`, `/soumissions`, `/cafes`, `/equipe`, `/parametres`, `/journal`,
`/diagnostic`… Lower case, no trailing slash; a reference is lower-cased in the address and accepted in either case by
the API.

## 2. The menu, « + Créer », the global search — one definition: `menu.ts`

- **Menu** (`ADMIN_MENU`): every entry of BO-011 is already declared with its group, its address, its icon and its
  permission (ROL-023). It appears when the role holds the permission **and** `delivered: true`. To deliver your
  screen: flip `delivered` to `true`. A counter: add a key to `AdminBadges` (`packages/contracts/src/admin-shell.ts`),
  fill it in `ShellService.shell()` (`apps/api/src/back-office/shell.service.ts`), set `badge` on the entry.
- **« + Créer »** (`CREATE_ACTIONS`, BO-012): flip `delivered` on your action (and check its `href`). The button of
  the top bar appears as soon as one action is delivered for the role.
- **Global search** (`OBJECT_PATHS`, BO-030): add your type with the address of its record, the address of its list
  (« Voir tous les résultats » adds `?q=`) and its icon. The API (`GET /admin/search`) already searches the nine types
  with permissions, perimeter and masking; a type is shown — and a notification becomes a link — only once it is here.
- **Landing page**: `landingPath()` = first delivered entry of the role (BO-011). The dashboard (EA-01) becomes it by
  being the first entry.

## 3. Reading data on the server — `server.ts`

Private data: cookies forwarded, **never cached**.

```tsx
import { Forbidden } from '@/components/shell/Page';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet, hasPermission } from '@/components/shell/server';

export default async function Page({ params }: { params: Promise<{ reference: string }> }) {
  if (!(await hasPermission('dossier.read'))) return <Forbidden />;          // BO-015 (403)
  const { reference } = await params;
  const r = await adminGet<DossierDetail>(`/admin/dossiers/${reference}`);
  if (!r.ok) return <ReadFailure result={r} />;   // 401 → renewal in the browser · 403 · 404 · error + « Détails »
  return <DossierView dossier={r.data} />;
}
```

`getShell()` gives the summary of the frame (`AdminShell`: user, role, permissions, badges, calendar) — read once per
request.

## 4. Calling the API from the browser — `lib/admin-client.ts`

```ts
const r = await adminCall<Lead>(`/admin/leads/${id}/take`, { method: 'POST' });       // a write: anti-forgery header added
const r = await adminCall<LeadList>('/admin/leads', { query: { page: 2 }, signal });  // a read
if (!r.ok) setError(errorText(r));        // lib/errors.ts — TRV-110 sentence of the code or of its reason
```

`adminCall` never throws and already does, for every screen: session renewal on 401 and **sign-in again in place**
then replay (TRV-083); the window « Confirmez votre mot de passe » on `403 REAUTH_REQUIRED` then replay (BO-005 — put
`@RequireRecentPassword()` on the route, nothing to do in the screen); three silent retries of a **read** on a cut
(TRV-115); `idempotencyKey: newIdempotencyKey()` for a form that creates (TRV-091). A reason of `CONFLICT_STATE` gets
its sentence by adding `ui.admin-shell.reason.{REASON}` (or `ui.error.reason.*`). Field errors of a 422:
`fieldErrors(r.error)`; the same zod schema checked before sending: `checkSchema(schema, values)`.

After a write that changes a counter of the frame: `signalShellChanged()` (`ShellContext.tsx`).

## 5. Permissions — hide what the role cannot do (the API still checks)

- Server page: `hasPermission('x.read')` → `<Forbidden />`.
- Client component: `const { can, shell, timeZone } = useShell();` then `can('lead.process')`, or
  `<IfCan permission="lead.assign">…</IfCan>`.
- BO-047: an action **forbidden by the role is absent**; an action **impossible in the current state** is greyed and
  says why — `MenuItem.disabledReason`. Better still: let the API say what the caller may do on each object (see
  `TeamMember.can` in `admin-team.ts`) and render from it.
- Perimeter (ROL-018), SUPPORT masking (ROL-015) and sensitive fields (ROL-019) are applied **by the API**:
  `StaffViews.of(auth)` and `leadScope` / `dossierScope` / `clientScope`, `maskName` / `maskEmail` / `maskPhone`
  (`apps/api/src/back-office/staff-view.ts`). The screen shows « Réservé » / « Contenu masqué » for what did not come.

## 6. The list template — `list/ListPage.tsx` (BO-035, BO-040, DSN-053, DSN-054, TRV-100…108)

One client component per list; the server page only checks the permission. Example: `components/leads/LeadsList.tsx`,
`components/team/TeamList.tsx`.

```tsx
<ListPage<Row, Response>
  listKey="dossiers"                    // storage key and SavedView.listKey (lower case, hyphens)
  endpoint="/admin/dossiers"            // GET; answers { data, meta: { page, pageSize, total, totalPages }, …your facets }
  header={{ title, crumbs, actions }}   // PageHeader props; main action = <Button variant="tool" size="M">
  columns={[{ key, header, cell, sortable, fixed, hiddenByDefault, help, text }]}
  rowId={(r) => r.id} rowLabel={(r) => r.reference} rowHref={(r) => `/dossiers/${r.reference.toLowerCase()}`}
  defaultSort={{ key: 'createdAt', dir: 'desc' }}
  defaultView="mine"
  originViews={(r) => [{ key: 'mine', label, count: r?.views.mine, query: { view: 'mine' } }]}
  filters={(r) => [{ key: 'stage', label, kind: 'options', options: [{ value, label, count }] }, { key: 'created', label, kind: 'date', toQuery }]}
  searchPlaceholder={t('…')}
  empty={{ title, text, actions }}
  rowActions={(row, reload) => <Menu … />}                     // « ⋯ » of a row
  bulkActions={(ids, clear, reload) => <Button …/>}            // with it the selection column appears (BO-035)
/>
```

What the template does by itself: state in the address (`view`, `q`, `sort`, `page`, `pageSize`, one parameter per
filter) with history; the API receives `sort=key|-key`, `page`, `pageSize`, `q` (from 2 characters, 300 ms), each filter
as `key=a,b` (a date filter as `{key}From` / `{key}To`, or your `toQuery`) and the `query` of the origin view; one
request at a time (abort); reload dimmed under a progress bar; skeleton, empty, « aucun résultat pour ces filtres »,
error with « Réessayer » and « Détails »; the range above and under the table, page size 25/50/100, numbered
pagination; « Colonnes » (shown, order — remembered); memory per user in `localStorage` (`dp_list_{listKey}_{user}`,
never the search); « Filtres de votre dernière visite »; return to the list where it was left, row highlighted
(TRV-108); refresh every 60 s with « n nouveaux éléments · Afficher »; saved views in tabs (save, update, rename,
share with `view.share`, default view, delete) through `/admin/saved-views`.

What the API of a list must do (TRV-100, API-010…012): page, sort, filter and count **on the server**; refuse an
unknown parameter (400); stable sort (id as second criterion); counts of each filter value **without** that filter
(facets) and of each origin view. Copy `LeadsAdminService.list`.

The pieces (`DataTable`, `FilterBar`, `TableFooter`, `Pagination`, `BulkBar`, `SearchSuggest`, `StatusTag`, `Banner`,
`ErrorSummary`, `FieldMessage`, `ErrorDetails`, `HelpTip`, `Modal`, `Menu`, `EmptyState`, `Skeleton`, `ToastProvider` /
`useToast`) live in `@dp/ui` and hold no text: reuse them, do not rebuild them.

## 7. The record template — `detail/DetailPage.tsx` (BO-045…BO-048)

```tsx
<DetailPage
  crumbs={[{ label: group }, { label: listTitle, href: '/dossiers' }, { label: reference }]}
  title={…} meta={<>reference, <StatusTag/>…</>}
  actions={<><Button variant="tool" size="M">Action principale</Button><Menu label="Autres actions" items={…} /></>}
  tabs={[{ key: 'apercu', label }, { key: 'pieces', label, count }]} activeTab={searchParams.onglet} basePath={`/dossiers/${ref}`}
  aside={<Surface title="Informations clés"><Facts items={…} /></Surface>}
>
  <DetailColumns columns={2}>…<Surface title>…</Surface>…</DetailColumns>
  <Timeline endpoint={`/admin/dossiers/${id}/timeline`} entity={{ type: 'DOSSIER', id }} types={[…]} quickActions={…} />
</DetailPage>
```

- `Page.tsx`: `PageHeader`, `Surface` (white card, border only), `Facts` (label / value, « — » when missing),
  `Forbidden`, `NotFoundState`.
- Editing by section (BO-046): « Modifier » → « Enregistrer » · « Annuler »; `useUnsavedGuard(dirty)` (`forms.tsx`)
  gives the question of TRV-093 on leaving; send `version` and show `ui.common.conflict.*` on `409 CONFLICT_VERSION`.
- Form pieces: `forms.tsx` (`TextInput`, `SelectInput`, `TextArea` with counter, `PasswordInput`, `CodeInput`,
  `Checkbox`, `formStyles.form|row|actions`); several errors → `<ErrorSummary>` + message under each field (TRV-114).
- Confirmations: `<Modal>` naming the object (TRV-095); success: `useToast()({ text })` — 5 s (TRV-081); an error of a
  quick action: `toast({ tone: 'error', text, action: { label: 'Réessayer', run } })`, it stays until closed.
- On opening a record, mark its notifications read (NOT-032):
  `adminCall('/admin/notifications/read', { body: { entityType: 'Dossier', entityId } })` then `signalShellChanged()`.
  Entity names: `STAFF_NOTIFICATION_ENTITIES` (`admin-shell.ts`).

## 8. Timeline and notes — `timeline/Timeline.tsx` (BO-050, BO-051, BO-055)

The component is complete (filters by type, loading on scroll, note form with draft, pin / edit / delete, `N` key).
Notes work for every `NoteEntity` through `/admin/notes` (visibility of the object checked by
`NotesTimelineService.assertVisible`). For the timeline of **your** object, add a method beside `leadTimeline`
(`apps/api/src/back-office/notes-timeline.service.ts`) and its route `…/{id}/timeline`: same entry shape
(`AdminTimelineEntry`: `type`, `code`, `params`, `author`, `at`, `detail`), each source read only when the reader holds
its permission (ROL-019). A new sentence: `ui.admin-shell.timeline.event.{code}`. The other buttons of the quick-add
bar (« Appel », « E-mail », « Tâche », « Rendez-vous ») are passed in `quickActions` once their forms exist.

## 9. Notifications of the team

Write them from your outbox group with `StaffNotifier` (`apps/api/src/automation/README.md`, § 5); the bell and the
page `/notifications` read them (`/admin/notifications`). Give `entityType` / `entityId` and a link built by
`staffLink()`; the link becomes clickable when its address is delivered in `menu.ts`.

## 10. What the frame already carries — do not redo it

Session (silent renewal, warning two minutes before the idle close, sign-in again in place — BO-004), password
confirmation (BO-005), permanent banners (BO-014: environment, shifted clock, exceptional access, maintenance, masked
data), connection lost / back (TRV-082), brief messages, the help window and its shortcuts (BO-080, BO-081 — add a
shortcut to `SHORTCUTS` in `TopBar.tsx`), the unsaved-changes question, the 403 / 404 / error states, the change of
screen (fade, 8 px — DSN-072), the register « Outil » of the design system (`@dp/ui/styles/tool.css`: 14 px text,
radius 8, 44 px rows, buttons S 36 / M 46).

## 11. Tests and screenshots

- API rules: `apps/api/test/back-office.test.ts` (each route's declared permission is asserted there: add yours).
- Journeys: `e2e/tests/admin-*.spec.ts` with `helpers/admin.ts` — `signInDirection(page)` signs in the local Direction
  test account (set up through the real invitation page; password and second-factor key in the git-ignored
  `.local/e2e-admin.json`), `adminPost(page, request, path, body)` for a direct write. Addresses are absolute
  (`ADMIN = http://localhost:3001`): the Playwright config keeps `baseURL :3000` for the site.
- Screenshots to look at: `ADMIN_SHOTS=<dossier> npx playwright test tests/admin-shots.spec.ts --project=desktop`
  (1440 px, and 390 px for the frame).
