'use client';
// EC-20 — « Mes pièces » (DOS-001 … DOS-006, DOS-016, DOS-040). D-098: the page uses the whole width — the list on the
// left, and beside it (above it on a phone, in the order of DOS-001) what frames it: where the dossier stands, said as
// an encouragement with its bar, « Qui emprunte ? », the transmission consent. The filter has four choices with their
// counters — À fournir · En vérification · Validées · Toutes — kept in the address (`pieces=`, TRV-101), and a search
// when the list is long; the list is bounded (one dossier's pieces): filtered here. « Déposer » and « Voir » open in a
// panel on the right that leaves the list visible (D-098), full screen on a phone (DOS-010).
// In order: the completeness bar (not on a closed dossier),
// « Qui emprunte ? » (« Qui achète ? » without financing), the transmission consent block until it is given, a banner when
// a situation the list depends on is missing; then the list grouped by person (when there are several) and by category,
// with the filter « À fournir ({n}) » · « Toutes » (« À fournir » by default when something remains), and « Fournies par
// nos soins » apart. While a deposit is in its security check the line is read again every 3 s (CYC-140). Opening the
// page marks the dossier's notifications read (NOT-032).
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DOCUMENT_CATEGORIES,
  type ClientDocument,
  type ClientDocumentsView,
  type ClientDossierParty,
} from '@dp/contracts';
import { Button, ButtonInner, Celebration, Icon, buttonClass, type IconName } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import { CheckboxField } from '@/components/forms/fields';
import { EmptyState } from '@/components/client-space/EmptyState';
import { signalSpaceChanged, useOptionalSpace } from '@/components/client-space/SpaceContext';
import { writeToAdvisorHref } from '@/components/client-space/advisor-link';
import { Encouragement } from '@/components/client-space/kit/Encouragement';
import { FilterChips, matches, NoMatch, SearchBox, Toolbar, useListState } from '@/components/client-space/kit/ListControls';
import { SidePanel } from '@/components/client-space/kit/SidePanel';
import k from '@/components/client-space/kit/kit.module.css';
import { isPast, longDate, shortDate } from '@/components/client-tools/format';
import { DepositPanel, type DepositIntent } from './DepositPanel';
import { FileViewer } from './FileViewer';
import space from '@/components/client-space/space.module.css';
import s from './documents.module.css';

type Filter = 'TODO' | 'REVIEW' | 'DONE' | 'ALL';
const FILTER_PARAM: Record<Filter, string> = { TODO: 'a-fournir', REVIEW: 'verification', DONE: 'validees', ALL: 'toutes' };
const PARAM_FILTER: Record<string, Filter> = { 'a-fournir': 'TODO', verification: 'REVIEW', validees: 'DONE', toutes: 'ALL' };

/** The icon that says, before the words, where a line stands (always with its label — DSN-015). */
const STATE_ICON: Record<ClientDocument['state'], IconName> = {
  SCANNING: 'shield',
  PENDING: 'upload',
  RECEIVED: 'clock',
  VALIDATED: 'check',
  VALIDATED_RENEWAL_PENDING: 'check',
  VALIDATED_TO_RENEW: 'clock',
  REJECTED: 'warning',
  EXPIRED: 'warning',
  WAIVED: 'minus',
};
const inReview = (d: ClientDocument) => d.state === 'RECEIVED' || d.state === 'SCANNING' || d.state === 'VALIDATED_RENEWAL_PENDING';
const isDone = (d: ClientDocument) => d.state === 'VALIDATED' || d.state === 'WAIVED';

const TONE: Record<ClientDocument['state'], string> = {
  SCANNING: space.tagInfo!,
  PENDING: space.tagWarning!,
  RECEIVED: space.tagInfo!,
  VALIDATED: space.tagSuccess!,
  VALIDATED_RENEWAL_PENDING: space.tagSuccess!,
  VALIDATED_TO_RENEW: space.tagWarning!,
  REJECTED: space.tagWarning!,
  EXPIRED: space.tagWarning!,
  WAIVED: space.tagNeutral!,
};

/** What « À fournir » means: something the client has to do on this line. */
const toProvide = (d: ClientDocument) => d.providedBy === 'CLIENT' && (d.actions.deposit || d.actions.renew) && d.state !== 'SCANNING';

export function DocumentsBoard({ initial }: { initial: ClientDocumentsView }) {
  const [view, setView] = useState(initial);
  const space_ = useOptionalSpace();
  const tz = space_?.settings.calendarTimeZone ?? 'Europe/Paris';
  const reference = view.dossier.reference;
  const todo = view.documents.filter(toProvide);
  // DOS-002 — « À fournir » by default while something remains, « Toutes » otherwise; a choice goes to the address.
  const list = useListState();
  const filter: Filter = PARAM_FILTER[list.get('pieces')] ?? (todo.length ? 'TODO' : 'ALL');
  const setFilter = (f: Filter) => list.set({ pieces: FILTER_PARAM[f] }, { push: true });
  const q = list.get('q');
  const [deposit, setDeposit] = useState<{ doc: ClientDocument; intent: DepositIntent } | null>(null);
  const [viewing, setViewing] = useState<{ doc: ClientDocument; renewal: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const r = await apiCall<ClientDocumentsView>(`/client/dossiers/${encodeURIComponent(reference)}/documents`, { retryOnAuth: true });
    if (r.ok) setView(r.data);
  }, [reference]);

  // NOT-032 — showing the dossier's screen marks its notifications read.
  useEffect(() => {
    void apiCall('/client/notifications/read', { body: { entityType: 'Dossier', entityId: view.dossier.id }, retryOnAuth: true }).then((r) => r.ok && signalSpaceChanged());
  }, [view.dossier.id]);

  // CYC-140 — a security check in progress: read again every 3 s until it ends.
  const scanning = view.documents.some((d) => d.state === 'SCANNING');
  useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(() => void reload(), 3000);
    return () => clearInterval(timer);
  }, [scanning, reload]);

  const parties = view.parties;
  const several = parties.length > 1;
  const cash = !view.dossier.financingRequested;
  const personLabel = (p: ClientDossierParty) =>
    p.role === 'PRIMARY'
      ? t('ui.documents.people.you')
      : p.role === 'GUARANTOR'
        ? t('ui.documents.people.guarantor', { prenom: p.firstName ?? '' })
        : t(cash ? 'ui.documents.people.coBuyer' : 'ui.documents.people.coBorrower', { prenom: p.firstName ?? '' });

  const shown = view.documents.filter(
    (d) => (filter === 'TODO' ? toProvide(d) : filter === 'REVIEW' ? inReview(d) : filter === 'DONE' ? isDone(d) : true) && matches([d.label, t(`ui.enum.DocumentCategory.${d.category}`)], q),
  );
  const reviewCount = view.documents.filter(inReview).length;
  const doneCount = view.documents.filter(isDone).length;
  const mine = shown.filter((d) => d.providedBy === 'CLIENT');
  const ours = shown.filter((d) => d.providedBy !== 'CLIENT');
  const groups = useMemo(() => {
    const out: { key: string; title: string | null; docs: ClientDocument[] }[] = [];
    if (several) {
      for (const p of parties) out.push({ key: p.id, title: personLabel(p), docs: mine.filter((d) => d.partyId === p.id) });
      out.push({ key: 'common', title: t('ui.documents.people.common'), docs: mine.filter((d) => !d.partyId || !parties.some((p) => p.id === d.partyId)) });
    } else out.push({ key: 'all', title: null, docs: mine });
    return out.filter((g) => g.docs.length);
  }, [mine, parties, several]); // eslint-disable-line react-hooks/exhaustive-deps

  const missing = parties.filter((p) => p.missingSituation);
  const purged = view.dossier.filesPurgedAt;

  const onDeposited = (doc: ClientDocument) => {
    setView((v) => ({ ...v, documents: v.documents.map((d) => (d.id === doc.id ? doc : d)) }));
  };

  const partyFor = (doc: ClientDocument) => {
    const p = parties.find((x) => x.id === doc.partyId);
    return p && p.role !== 'PRIMARY' && !p.authorizationGiven ? { partyId: p.id, firstName: p.firstName ?? '' } : null;
  };

  // ECL-015 / DOS-001 — where the dossier stands, said as an encouragement, with the bar and its figures.
  const pct = view.dossier.completenessPct;
  const progress = {
    value: pct,
    label: t('ui.documents.page.completeness', { n: pct }),
    legend: t('ui.documents.page.completenessDetail', { x: view.dossier.satisfiedCount, y: view.dossier.requiredCount }),
    legendEnd: <strong>{t('ui.documents.page.completeness', { n: pct })}</strong>,
  };
  const required = todo.filter((d) => d.isRequired && d.state !== 'VALIDATED_TO_RENEW').length;
  const complete = view.dossier.requiredCount > 0 && view.dossier.satisfiedCount >= view.dossier.requiredCount;
  const standing = view.dossier.readOnly ? (
    <p className={s.notice}>{t('ui.documents.page.readOnly')}</p>
  ) : !view.documents.length ? null : complete ? (
    <Encouragement tone="done" icon="status-success" medal={<Celebration moment="dossier_complete" objectId={reference} />} title={t('ui.documents.encourage.complete.title')} text={t('ui.documents.encourage.complete.text')} progress={{ ...progress, tone: 'green' }} />
  ) : required > 0 ? (
    <Encouragement tone="progress" icon="upload" title={t('ui.documents.encourage.left.title', { n: required })} text={t('ui.documents.encourage.left.text')} progress={progress} />
  ) : (
    <Encouragement tone="calm" icon="clock" title={t('ui.documents.encourage.checking.title')} text={t('ui.documents.encourage.checking.text')} progress={progress} />
  );

  return (
    <div className={s.board}>
      <div className={s.side}>
      {standing}

      {parties.length ? (
        <section className={space.block} aria-labelledby="qui">
          <div className={space.blockHead}>
            <h2 id="qui" className={space.blockTitle}>
              {t(cash ? 'ui.documents.people.titleCash' : 'ui.documents.people.title')}
            </h2>
          </div>
          <ul className={s.people}>
            {parties.map((p) => (
              <li key={p.id} className={s.person}>
                <span className={s.personIcon} aria-hidden="true">
                  <Icon name="user" size={20} />
                </span>
                <span className={s.personName}>{personLabel(p)}</span>
                {p.restricted ? <span className={s.hint}>{t('ui.documents.people.frozen', { prenom: p.firstName ?? '' })}</span> : null}
                {p.role === 'PRIMARY' && !view.dossier.readOnly ? (
                  <Link href="/espace-client/profil#situation" className={k.quiet}>
                    <Icon name="edit" size={20} />
                    {t('ui.documents.people.edit')}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          {!view.dossier.readOnly ? (
            <p className={s.peopleLater}>
              <span>{t('ui.documents.people.later')}</span>
              <Link href={writeToAdvisorHref({ from: 'DOCUMENTS', dossier: reference })} className={k.quiet}>
                <Icon name="chat" size={20} />
                {t('ui.common.writeToAdvisor')}
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {!view.dossier.readOnly ? <ConsentBlock reference={reference} consent={view.consent} tz={tz} onGiven={(c) => setView((v) => ({ ...v, consent: c }))} /> : null}

      {missing.map((p) => (
        <p key={p.id} className={s.banner} role="note">
          <Icon name="status-warning" size={20} />
          <span>{p.role === 'PRIMARY' ? t('ui.documents.page.missingSituationYou') : t('ui.documents.page.missingSituation', { prenom: p.firstName ?? '' })}</span>
          <Link href={p.role === 'PRIMARY' ? '/espace-client/profil#situation' : writeToAdvisorHref({ dossier: reference })} className={buttonClass('tool', 'S')}>
            <ButtonInner size="S">{t('ui.documents.page.missingSituationCta')}</ButtonInner>
          </Link>
        </p>
      ))}
      </div>

      <div className={s.main}>
      {purged ? (
        <EmptyState icon="folder" title={t('ui.documents.page.purged', { date: longDate(purged, tz) })} />
      ) : !view.documents.length ? (
        <EmptyState icon="file" title={t('ui.documents.page.noList')} text={t('ui.documents.page.noListText')} />
      ) : (
        <>
          <Toolbar end={view.documents.length > 8 ? <SearchBox label={t('ui.documents.page.search')} value={q} onChange={(v) => list.set({ q: v })} /> : undefined}>
            <FilterChips
              label={t('ui.documents.page.filterLabel')}
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: 'TODO', label: t('ui.documents.page.filterTodo'), count: todo.length },
                { value: 'REVIEW', label: t('ui.documents.page.filterReview'), count: reviewCount },
                { value: 'DONE', label: t('ui.documents.page.filterDone'), count: doneCount },
                { value: 'ALL', label: t('ui.documents.page.filterAll'), count: view.documents.length },
              ].filter((o) => o.value === 'TODO' || o.value === 'ALL' || o.count > 0 || o.value === filter)}
            />
          </Toolbar>

          {filter === 'TODO' && !todo.length && !q ? (
            <EmptyState compact icon="status-success" title={t('ui.documents.page.emptyToProvide')} text={t('ui.documents.page.emptyToProvideText')} />
          ) : shown.length === 0 ? (
            <NoMatch onClear={() => list.set({ pieces: 'toutes', q: null }, { push: true })} />
          ) : null}

          {groups.map((g) => (
            <section key={g.key} className={s.group} aria-label={g.title ?? t('ui.documents.page.title')}>
              {g.title ? <h2 className={s.groupTitle}>{g.title}</h2> : null}
              {DOCUMENT_CATEGORIES.map((cat) => {
                const docs = g.docs.filter((d) => d.category === cat);
                if (!docs.length) return null;
                return (
                  <div key={cat} className={s.category}>
                    <h3 className={s.categoryTitle}>
                      {t(`ui.enum.DocumentCategory.${cat}`)}
                      <span className={s.categoryCount}>{docs.length}</span>
                    </h3>
                    <ul className={s.lines}>
                      {docs.map((d, i) => (
                        <DocumentLine
                          key={d.id}
                          index={i}
                          doc={d}
                          tz={tz}
                          onDeposit={(intent) => setDeposit({ doc: d, intent })}
                          onView={(renewal) => setViewing({ doc: d, renewal })}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </section>
          ))}

          {ours.length ? (
            <section className={s.group} aria-labelledby="nos-soins">
              <h2 id="nos-soins" className={s.groupTitle}>
                {t('ui.documents.people.byUs')}
              </h2>
              <ul className={s.lines}>
                {ours.map((d) => (
                  <DocumentLine key={d.id} index={0} doc={d} tz={tz} onDeposit={() => undefined} onView={(renewal) => setViewing({ doc: d, renewal })} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      </div>

      <SidePanel
        open={Boolean(deposit)}
        onClose={() => {
          if (busy && !window.confirm(t('ui.documents.deposit.leaveWarning'))) return;
          setDeposit(null);
          void reload();
          signalSpaceChanged();
        }}
        eyebrow={deposit ? t(deposit.intent === 'EDIT' ? 'ui.documents.deposit.eyebrowEdit' : deposit.intent === 'RENEW' ? 'ui.documents.deposit.eyebrowRenew' : 'ui.documents.deposit.eyebrow') : undefined}
        title={deposit?.doc.label ?? ''}
      >
        {deposit ? (
          <DepositPanel
            key={`${deposit.doc.id}-${deposit.intent}`}
            reference={reference}
            doc={deposit.doc}
            intent={deposit.intent}
            maxFileSizeMb={view.limits.maxFileSizeMb}
            partyConsent={partyFor(deposit.doc)}
            first={!view.documents.some((d) => d.providedBy === 'CLIENT' && d.current)}
            onBusy={setBusy}
            onDone={(doc) => {
              onDeposited(doc);
              showToast({ message: t('ui.documents.state.SCANNING'), tone: 'info' });
            }}
          />
        ) : null}
      </SidePanel>

      <SidePanel open={Boolean(viewing)} onClose={() => setViewing(null)} eyebrow={t('ui.documents.viewer.eyebrow')} title={viewing?.doc.label ?? ''} width={720}>
        {viewing ? (
          <FileViewer
            key={`${viewing.doc.id}-${viewing.renewal}`}
            reference={reference}
            documentId={viewing.doc.id}
            label={viewing.doc.label}
            files={(viewing.renewal ? viewing.doc.renewal?.files : viewing.doc.current?.files) ?? []}
          />
        ) : null}
      </SidePanel>
    </div>
  );
}

function ConsentBlock({
  reference,
  consent,
  tz,
  onGiven,
}: {
  reference: string;
  consent: ClientDocumentsView['consent'];
  tz: string;
  onGiven: (c: ClientDocumentsView['consent']) => void;
}) {
  const id = useId();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (consent.given) {
    return (
      <p className={s.consentGiven}>
        <Icon name="status-success" size={20} />
        <span>
          {consent.recordedBy
            ? t('ui.documents.consent.recorded', { conseiller: consent.recordedBy, date: longDate(consent.givenAt!, tz) })
            : t('ui.documents.consent.given', { date: longDate(consent.givenAt!, tz) })}
        </span>
        <Link href="/espace-client/profil/confidentialite" className={k.quiet}>
          {t('ui.documents.consent.withdraw')}
        </Link>
      </p>
    );
  }
  const save = async () => {
    if (!checked) return setError(t('ui.documents.consent.required'));
    setPending(true);
    const r = await apiCall<ClientDocumentsView['consent']>(`/client/dossiers/${encodeURIComponent(reference)}/consent`, { body: { accepted: true }, retryOnAuth: true });
    setPending(false);
    if (!r.ok) return setError(t('ui.documents.deposit.errors.generic'));
    showToast({ message: t('ui.documents.consent.saved'), tone: 'success' });
    onGiven(r.data);
  };
  return (
    <section className={[space.block, s.consent].join(' ')} aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className={space.blockTitle}>
        {t('ui.documents.consent.title')}
      </h2>
      <p className={s.consentText}>{t('ui.documents.consent.text')}</p>
      <CheckboxField
        id={`${id}-c`}
        checked={checked}
        onChange={(v) => {
          setChecked(v);
          setError(null);
        }}
        error={error}
        label={t('ui.documents.consent.checkbox')}
      />
      <div>
        <Button variant="tool" size="M" onClick={() => void save()} pending={pending}>
          {t('ui.documents.consent.save')}
        </Button>
      </div>
    </section>
  );
}

function DocumentLine({ doc, tz, index, onDeposit, onView }: { doc: ClientDocument; tz: string; index: number; onDeposit: (intent: DepositIntent) => void; onView: (renewal: boolean) => void }) {
  const [help, setHelp] = useState(false);
  const helpId = useId();
  const ours = doc.providedBy !== 'CLIENT' && doc.state === 'PENDING';
  const state =
    doc.state === 'VALIDATED_TO_RENEW'
      ? t('ui.documents.state.VALIDATED_TO_RENEW', { date: longDate(doc.validUntil ?? doc.statusChangedAt, tz) })
      : ours
        ? t('ui.documents.state.PENDING_OURS')
        : t(`ui.documents.state.${doc.state}`);
  const files = doc.current?.files ?? [];
  const reason = (r: { reason: string; note: string | null }) => [t(`ui.enum.RejectionReason.${r.reason}` as never), r.note].filter(Boolean).join(' — ');
  const depositLabel =
    doc.state === 'REJECTED' ? t('ui.documents.action.depositAgain') : doc.state === 'EXPIRED' ? t('ui.documents.action.depositNew') : t('ui.documents.action.deposit');
  return (
    <li className={[s.line, k.enter, doc.state === 'WAIVED' && s.lineFaded].filter(Boolean).join(' ')} style={{ ['--i' as string]: index }} data-document={doc.state}>
      <span className={[s.lineIcon, s[`icon_${ours ? 'OURS' : doc.state}`]].filter(Boolean).join(' ')} aria-hidden="true">
        <Icon name={ours ? 'clock' : STATE_ICON[doc.state]} size={20} />
      </span>
      <div className={s.lineMain}>
        <p className={s.lineLabel}>
          {doc.label}
          {!doc.isRequired ? <span className={s.optional}> · {t('ui.documents.line.optional')}</span> : null}
          {doc.description ? (
            <button type="button" className={s.helpButton} aria-expanded={help} aria-controls={helpId} onClick={() => setHelp((h) => !h)} aria-label={t('ui.documents.line.helpOpen', { libelle: doc.label })}>
              <Icon name="info" size={20} />
            </button>
          ) : null}
        </p>
        {help && doc.description ? (
          <p id={helpId} className={s.lineHelp}>
            {doc.description}
          </p>
        ) : null}
        <p className={s.lineStatus}>
          <span className={[space.tag, ours ? space.tagNeutral : TONE[doc.state]].join(' ')}>{state}</span>
          {doc.state === 'PENDING' && doc.dueAt && !ours ? (
            <span className={isPast(doc.dueAt) ? s.duePast : s.due}>{t('ui.documents.line.due', { date: shortDate(doc.dueAt, tz) })}</span>
          ) : null}
        </p>
        {doc.state === 'RECEIVED' && doc.current ? (
          <p className={s.lineDetail}>
            {t('ui.documents.line.receivedOn', { date: longDate(doc.current.uploadedAt, tz), n: files.length })}
            {doc.current.viaMessage ? ` · ${t('ui.documents.line.viaMessage')}` : ''}
          </p>
        ) : null}
        {(doc.state === 'VALIDATED' || doc.state === 'VALIDATED_RENEWAL_PENDING') && doc.validUntil ? (
          <p className={s.lineDetail}>{t('ui.documents.line.validUntil', { date: longDate(doc.validUntil, tz) })}</p>
        ) : null}
        {doc.state === 'VALIDATED_RENEWAL_PENDING' && doc.renewal ? (
          <p className={s.lineDetail}>{t('ui.documents.line.renewalDeposited', { date: longDate(doc.renewal.uploadedAt, tz) })}</p>
        ) : null}
        {doc.state === 'VALIDATED_TO_RENEW' ? (
          <p className={s.lineDetail}>
            {t('ui.documents.line.toRenewText')}
            {doc.renewalRejection ? ` ${t('ui.documents.line.renewalRejected', { motif: reason(doc.renewalRejection) })}` : ''}
          </p>
        ) : null}
        {doc.state === 'REJECTED' && doc.rejection ? <p className={s.lineReason}>{reason(doc.rejection)}</p> : null}
        {doc.state === 'EXPIRED' && doc.statusChangedAt ? <p className={s.lineDetail}>{t('ui.documents.line.expiredText', { date: longDate(doc.statusChangedAt, tz) })}</p> : null}
        {doc.lastOutcome ? (
          <p className={s.lineReason} role="status">
            <Icon name="status-warning" size={16} /> {t(`ui.documents.outcome.${doc.lastOutcome.kind}`)}
          </p>
        ) : null}
        {files.some((f) => f.assembledFromImages) ? (
          <p className={s.hint}>{t('ui.documents.line.photos', { n: files.find((f) => f.assembledFromImages)!.assembledFromImages! })}</p>
        ) : null}
      </div>
      <div className={s.lineActions}>
        {doc.actions.deposit ? (
          <Button variant="tool" size="M" icon="upload" onClick={() => onDeposit('DEPOSIT')}>
            {depositLabel}
          </Button>
        ) : null}
        {doc.actions.renew ? (
          <Button variant="tool" size="M" icon="upload" onClick={() => onDeposit('RENEW')}>
            {doc.renewal ? t('ui.documents.action.replaceRenewal') : t('ui.documents.action.renew')}
          </Button>
        ) : null}
        {doc.actions.view ? (
          <Button variant={doc.actions.deposit || doc.actions.renew ? 'tertiary' : 'secondary'} size="M" icon="eye" onClick={() => onView(false)}>
            {t('ui.documents.action.view')}
          </Button>
        ) : null}
        {doc.renewal?.files.length ? (
          <Button variant="tertiary" size="M" icon="eye" onClick={() => onView(true)}>
            {t('ui.documents.action.viewNew')}
          </Button>
        ) : null}
        {doc.actions.edit ? (
          <Button variant="tertiary" size="M" icon="edit" onClick={() => onDeposit('EDIT')}>
            {t('ui.documents.action.edit')}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
