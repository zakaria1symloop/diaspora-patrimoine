# Client space shell — how a page plugs in

The client space (`/espace-client/*`) has its **own frame** (D-091…D-093, ECL-001), not the public site chrome:
side menu + top bar on a computer, five tabs + « Écrire à mon conseiller » on a phone, footer reduced to the legal
line (NAV-021). Package 2.8 owns the frame; other packages only add pages.

## 1. Where a page goes

Put the page under `apps/web/src/app/espace-client/…`. The layout `app/espace-client/layout.tsx` wraps it
automatically (shell, session, toasts, `DiscoveryProvider`). Addresses are the spec's (ECL-001, ECL-030):

| Page | Address | Menu entry |
|---|---|---|
| Mes pièces (EC-20, 2.9) | `/espace-client/dossiers/{référence}/pieces` — a tab of « Mon dossier » | sub-entry « Mes pièces » under « Mon dossier », shown only when the shown dossier `hasDocumentList` |
| Simulations (EC-40) | `/espace-client/simulations` | « Simulations », always |
| Favoris (EC-41) | `/espace-client/favoris` | « Favoris », if `features.favorites` |
| Alertes (EC-42) | `/espace-client/alertes` | « Alertes », if `features.searchAlerts` (saved searches, `SearchAlert` of frequency `NONE`, CAT-093: show them on this page) |

The menu is **one definition**: `menu.ts` (`SPACE_MENU`, `PHONE_TABS`, `MORE_KEYS`). The entries above already exist
and point to these addresses; on a phone, Simulations / Favoris / Alertes are in the « Plus » sheet. To add an entry,
add it to `SPACE_MENU` (and its key to `MORE_KEYS` for the phone). Rule ECL-006: an entry appears only if its page is
delivered and active.

`/espace-client/dossiers/[reference]/layout.tsx` (package 2.8) draws the dossier header and its tabs (Suivi ·
Pièces). Your `pieces/page.tsx` renders inside it, under the tabs: do not repeat the dossier title. The « Pièces »
tab appears when the dossier has a document list (`DossierView.hasDocumentList`, from `GET /client/dossiers/{ref}`).
Helpers: `dossierPath(ref)`, `documentsPath(ref)` in `menu.ts`.

## 2. Reading data server-side (the session)

Private data: never the shared cached `apiGet` (lib/api.ts). Use `spaceGet` from `server.ts`, which forwards the
visitor's cookies and never caches:

```tsx
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';

export default async function Page() {
  const r = await spaceGet<MyType>('/client/simulations');
  if (!r.ok) return r.status === 404 ? notFound() : <SpaceReadFailure result={r} />;
  return <MyList data={r.data} />;
}
```

A `401`/`403` (access token of 15 minutes expired) renders `<SessionRenewal />`: the browser renews the session once,
then re-renders; if it cannot, it goes to `/connexion?suite=…` and comes back (AUTH-023). In the browser, writes go
through `apiCall` of `lib/auth-client.ts` (anti-forgery header, one renewal on 401: pass `retryOnAuth: true`).

The shell state is available in client components with `useSpace()` (`SpaceContext.tsx`): `summary` (names, bell
counter, dossiers, badges), `settings` (contact, `features`, SLA), `refresh()`. After a write that changes a counter
or the menu (a document list appears, a proposal is opened), call `signalSpaceChanged()`. ECL-003: the page and the
counters are read again every 60 s while visible and on each return to the tab — client components keep their state
(initialise form state once from props; do not re-sync it from props on every render).

## 3. Building blocks

**Layout (D-098, D-099).** The space uses the whole width next to the menu: `.screen` has no max-width. Compose each
page in columns (main zone + a side zone that frames it: see the dashboard, « Mes pièces », « Mes intérêts », the
profile), stack them below 1 100–1 280 px, keep long text capped inside its card (`max-width: 70ch`), never on the page.
Under `[data-simple]` (« Affichage simplifié », TRV-122, set on the frame by the « Aa » switch) everything is one
column and nothing moves: add `:global([data-simple]) .yourGrid { grid-template-columns: minmax(0, 1fr); }`.

- `PageHeader` — the visible title of every page (TRV-124): `title`, optional `eyebrow`, `intro`, `actions`, `back`.
- `EmptyState` — the « Vide » state of TRV-080 / TRV-126: `title` (why it is empty), `text` (what will come), `icon`,
  `actions` (the useful action). `compact` inside a block.
- `BlockError` / `SpaceReadFailure` — the « Erreur » state with « Réessayer ».
- `space.module.css` — `block`, `blockHead`, `blockTitle`, `blockLink`, `subTabs`/`subTab`, `tag` (+ `tagInfo`,
  `tagSuccess`, `tagWarning`, `tagNeutral`, `tagNew`), `skeleton*`. The space's primary button is the `tool` variant
  of `@dp/ui` `Button` (DSN-050), size L for the main action of a screen (TRV-124).

**The kit (`kit/`)** — use it instead of drawing a new block:

| Piece | What for |
|---|---|
| `Encouragement` | The message of a page (ECL-015 and the rule of each page): `tone` progress · done · calm · attention, `icon`, `title`, `text`, optional `progress` and `actions`, `medal` (pass `<Celebration moment="…" objectId="…" />` of `@dp/ui` on a real achievement, DSN-073). Its texts are listed for the client in Q-077: add yours there. |
| `Progress`, `StepDots` | A bar that fills (`transform`, motion.slow) with its legend; a journey in n marks. |
| `StatTile` / `StatTiles`, `Figures` | Figure tiles that lead to their page; label/value pairs (a pair without value is left out, TRV-025) with an optional footnote (TRV-023). |
| `useListState`, `FilterChips`, `SearchBox`, `SortSelect`, `Toolbar`, `ResultLine`, `NoMatch`, `matches` | Smart lists (TRV-101/103/104): state in the address (`push` for a filter or a sort), chips with counters, search after 2 characters and 300 ms, ignoring case and accents. A list bounded by a spec limit is filtered in the page (TRV-100 as amended); a list that grows (the timeline) asks the server. |
| `SidePanel` | Secondary work in a panel on the right that leaves the page visible (D-098): deposit, viewer, a simulation's result. Not modal; moves the content aside on a computer, full screen on a phone. Keep the centred `Modal` for short confirmations. |
| `PageSkeleton` | The skeleton of a route's `loading.tsx`, in the shape of the page: `dashboard`, `cards`, `rows`, `split`, `form`. |
| `PhotoNote` | FIC-012 — « Image d'illustration » / « Image 3D non contractuelle » on a photo. |
| `kit.module.css` | `enter` (entrance, 30 ms apart for the six first, `--i` = index), `linkCard` + `go` (a whole card that is a link, with its round arrow), `quiet` / `quietDanger` (secondary actions: text with icon, 44 px), `sectionHead`/`sectionTitle`/`sectionCount`, `footnote`. |

**Cards.** Never drop a public-site component in the space: draw the card for what the person does on the page (the
favourite says what changed since it was added; a property envisaged says where it stands on the way to « Bien
retenu »; a simulation leads with its result). One main action (`tool`), the others visibly secondary (`secondary`
or `quiet`); when the card leads somewhere, its photo and title lead there too; focus visible, 44 px targets.

**Checked by** `e2e/tests/client-space-controls.spec.ts` (every link and button of every page, filled and empty:
dead controls, console errors, 4xx/5xx, targets) and `e2e/space-full-shots.mjs` (screens at 1 440, 1 920 and 390 px,
filled and empty, with a client built through the real flows: `e2e/tests/helpers/space-data.ts`).

- Short messages: `showToast()` of `lib/discovery.ts` (8 s, TRV-081) — the shell displays them above the phone tabs.
- « Écrire à mon conseiller » / « En parler à mon conseiller »: `writeToAdvisorHref({ from, property, date, dossier })`
  in `advisor-link.ts` → `/espace-client/messages?…`, which opens the MSG-021 form with the prefilled start of message
  (e.g. `writeToAdvisorHref({ from: 'SIMULATION', date: '2026-10-09' })` → « Au sujet de ma simulation du 9 octobre
  2026 : »). Origins: `CLIENT_MESSAGE_ORIGINS` in `@dp/contracts`. Never put free text in the address.
- « Comparer » in the space: the favourites page reads and writes the site's set (`useCompare`, `dp_compare`) and has
  its own bar leading to `/comparer?biens=…` — the public tray lives in the site chrome, not in the space.
- Texts: the shell's keys live in `ui.client.*` (`packages/i18n/messages/fr/client.json`); use your own namespace.
  To add keys without rewriting a file: `PYTHONUTF8=1 python packages/i18n/scripts/merge-messages.py <ns> patch.json`.
- Metadata: the layout sets `robots: noindex` and the title template « … – Mon espace »; export `metadata = { title }`.
- Browser code: `newUuid()`, `sha256Hex()`, `copyText()` of `@dp/ui`, never `crypto.*` or `navigator.clipboard`.

## 4. Addresses, API, notifications

- **Lower case addresses** (NAV-002): the proxy 301-redirects any upper case path, so a dossier page is
  `/espace-client/dossiers/dos-2026-00012/pieces`. Build links with `dossierPath()` / `documentsPath()` (they
  lower-case); the API accepts the reference in either case.
- Routes of package 2.8 (all `@ClientAccess()`, scoped to the caller's record, someone else's object → 404):
  `GET /client/space` (shell summary: names, `timeZone`, bell counter, dossiers with `hasDocumentList`, badges) ·
  `GET /client/dashboard` (with `overview`: the counts of « Vos repères »; the dossier's `documents` figures) · `GET /client/dossiers` · `GET /client/dossiers/{ref}` (`DossierView`, with `id`) ·
  `GET /client/dossiers/{ref}/timeline?before=&family=` (counters per family in `meta.counts`) · `GET /client/interests` · `GET /client/proposals` ·
  `POST /client/candidates/{id}/view` · `GET /client/advisor-contact` · `POST /client/leads` (MSG-021, header
  `Idempotency-Key` required) · `GET /client/notifications` · `POST /client/notifications/read` (`{ids}` or
  `{entityType, entityId}`) · `POST /client/notifications/read-all` · `GET /client/me/profile` · `PATCH /client/me`
  (one profile section) · `POST /client/me/email/confirm-valid` · `GET|POST /client/me/consents` (the « Actualités »
  switch and the WITHDRAWAL of the transmission agreement; giving it stays your DOS-040 route) ·
  `GET|POST|PATCH|DELETE /client/contacts`.
- **Notifications**: create them with `notifyClient()` (`apps/api/src/client-tools/client-notify.ts`); the bell and
  « Dernières nouvelles » read them. Give a dossier notification `entityType: 'Dossier'` and the dossier id: opening any
  tab of the dossier marks it read (NOT-032, `<MarkRead>` in the dossier layout). The icon follows the link
  (`/pieces` → document, `/financement` → bank, …).
- **Timeline** (ECL-031): a fact the client may read is a `ClientTimelineEntry` written in the transaction of the
  gesture — `writeClientTimeline()` in `apps/api/src/client-space/timeline.ts` (kinds of `ClientTimelineKind`; the web
  composes the sentence from `ui.client.dossier.timeline.{KIND}` and the frozen `params`).
