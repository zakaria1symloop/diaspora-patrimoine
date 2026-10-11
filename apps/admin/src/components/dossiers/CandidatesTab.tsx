'use client';
// PIP-030 … PIP-033 — the tab « Biens »: the considered properties as cards made for what the adviser does here (who
// proposed it, where the client stands, what he said, the next gesture), the banner of a choice the client asked for
// with « Confirmer » and « Refuser », the retained property with « Choisir le lot », and « Proposer des biens », a panel
// on the right that leaves the list visible (filters prefilled from the project, suggestions, drafts, the word).
import { useCallback, useEffect, useState } from 'react';
import { DECLINE_REASONS, type CandidateList, type CandidateRow, type CandidateSearch, type CandidateSearchItem, type DossierDetail, type LotOption } from '@dp/contracts';
import { Banner, Button, EmptyState, Icon, Menu, Modal, Skeleton, StatusTag, useToast, type MenuItem, type StatusTone } from '@dp/ui';
import { adminCall, newIdempotencyKey } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { money, shortDate, shortDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { AVAILABILITY_TONE } from '@/lib/tones';
import { AppointmentDialog } from '../agenda/AppointmentDialog';
import { SelectInput, TextArea, formStyles as f } from '../shell/forms';
import { useShell } from '../shell/ShellContext';
import { Buttons, useAction } from './dialogs';
import { abilityItem, allowed, amount, DASH, enumLabel, Photo, shown, whyNot } from './parts';
import s from './dossiers.module.css';

export const CANDIDATE_TONE: Record<string, StatusTone> = {
  PROPOSED: 'info',
  VIEWED: 'info',
  INTERESTED: 'pending',
  VISIT_REQUESTED: 'pending',
  VISIT_PLANNED: 'pending',
  VISITED: 'pending',
  SELECTED: 'success',
  DECLINED: 'inactive',
  UNAVAILABLE: 'neutral',
};

type Win =
  | { kind: 'decline'; c: CandidateRow }
  | { kind: 'declineSelection'; c: CandidateRow }
  | { kind: 'unselect'; c: CandidateRow }
  | { kind: 'select'; c: CandidateRow; confirming: boolean }
  | { kind: 'lot'; c: CandidateRow }
  | { kind: 'note'; c: CandidateRow }
  | null;

export function CandidatesTab({ dossier, webUrl, onChange }: { dossier: DossierDetail; webUrl: string; onChange: () => void; openVisit: () => void }) {
  const toast = useToast();
  const { timeZone } = useShell();
  const [list, setList] = useState<CandidateList | null | 'failed'>(null);
  const [panel, setPanel] = useState(false);
  const [win, setWin] = useState<Win>(null);
  const [visitFor, setVisitFor] = useState<CandidateRow | null>(null);

  const load = useCallback(async () => {
    const r = await adminCall<CandidateList>(`/admin/dossiers/${dossier.id}/candidates`);
    setList(r.ok ? r.data : 'failed');
  }, [dossier.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const changed = () => {
    setWin(null);
    void load();
    onChange();
  };

  async function quick(path: string, body: unknown, success: string, method: 'POST' | 'DELETE' = 'POST') {
    const r = await adminCall(path, { method, body });
    if (r.ok) {
      toast({ text: success });
      changed();
    } else toast({ tone: 'error', text: errorText(r), action: { label: t('ui.common.retry'), run: () => void quick(path, body, success, method) } });
  }

  if (list === null)
    return (
      <div className={s.cards}>
        <Skeleton height="10rem" />
        <Skeleton height="10rem" />
      </div>
    );
  if (list === 'failed') return <Banner tone="error" action={<Button variant="secondary" size="S" onClick={() => void load()}>{t('ui.common.retry')}</Button>}>{t('ui.common.error.block')}</Banner>;

  const base = `/admin/dossiers/${dossier.id}/candidates`;
  const pending = list.data.find((c) => c.selectionRequestedAt);
  const groups: { key: string; items: CandidateRow[] }[] = [
    { key: 'retained', items: list.data.filter((c) => c.retained) },
    { key: 'live', items: list.data.filter((c) => !c.retained && !['DECLINED', 'UNAVAILABLE'].includes(c.status) && !(c.origin === 'ADVISOR_PROPOSAL' && !c.sentAt)) },
    { key: 'drafts', items: list.data.filter((c) => c.origin === 'ADVISOR_PROPOSAL' && !c.sentAt) },
    { key: 'closed', items: list.data.filter((c) => ['DECLINED', 'UNAVAILABLE'].includes(c.status)) },
  ].filter((g) => g.items.length);

  return (
    <div className={s.candidatesTab}>
      <div className={s.tabBar}>
        <p className={s.tabSummary}>{t('ui.admin-dossiers.candidates.summary', { n: list.data.length, attente: list.data.filter((c) => c.status === 'PROPOSED' || c.status === 'VIEWED').filter((c) => c.sentAt).length })}</p>
        {shown(list.canPropose) ? (
          <Button variant="tool" size="M" onClick={() => setPanel(true)} disabled={!allowed(list.canPropose)} title={whyNot(list.canPropose) ?? undefined}>
            <Icon name="plus" size={20} />
            {t('ui.admin-dossiers.candidates.propose')}
          </Button>
        ) : null}
      </div>

      {/* PIP-030 — « {client} souhaite retenir {bien} (lot {lot}) », with Confirmer and Refuser */}
      {pending ? (
        <div className={s.selectionBanner}>
          <Icon name="star" size={24} />
          <div className={s.selectionText}>
            <strong>{pending.preferredLot ? t('ui.admin-dossiers.candidates.wantsLot', { client: list.client.name ?? '', bien: pending.property.title, lot: pending.preferredLot.reference }) : t('ui.admin-dossiers.candidates.wants', { client: list.client.name ?? '', bien: pending.property.title })}</strong>
            {pending.preferredLot && pending.preferredLot.status !== 'AVAILABLE' ? <span className={s.warnText}>{t('ui.admin-dossiers.candidates.lotTaken', { client: list.client.name ?? '' })}</span> : null}
            <span className={s.sub}>{t('ui.admin-dossiers.candidates.askedOn', { date: shortDateTime(pending.selectionRequestedAt!, timeZone) })}</span>
          </div>
          <div className={s.selectionActions}>
            {shown(pending.can.declineSelection) ? (
              <Button variant="secondary" size="S" onClick={() => setWin({ kind: 'declineSelection', c: pending })}>
                {t('ui.admin-dossiers.candidates.refuse')}
              </Button>
            ) : null}
            {shown(pending.can.confirmSelection) ? (
              <Button variant="tool" size="S" disabled={!allowed(pending.can.confirmSelection)} title={whyNot(pending.can.confirmSelection) ?? undefined} onClick={() => setWin({ kind: 'select', c: pending, confirming: true })}>
                {t('ui.admin-dossiers.candidates.confirm')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState icon="home" title={t('ui.admin-dossiers.candidates.emptyTitle')} text={t('ui.admin-dossiers.candidates.emptyText')} actions={allowed(list.canPropose) ? <Button variant="tool" size="M" onClick={() => setPanel(true)}>{t('ui.admin-dossiers.candidates.propose')}</Button> : undefined} />
      ) : (
        groups.map((g) => (
          <section key={g.key} className={s.candGroup}>
            <h3 className={s.groupTitle}>
              {t(`ui.admin-dossiers.candidates.group.${g.key}` as never)} <span className={s.groupCount}>{g.items.length}</span>
            </h3>
            {g.key === 'drafts' ? <p className={s.sub}>{t('ui.admin-dossiers.candidates.draftsHint')}</p> : null}
            <div className={s.cards}>
              {g.items.map((c) => (
                <CandidateCard
                  key={c.id}
                  c={c}
                  dossier={dossier}
                  lots={c.retained ? list.lots : []}
                  timeZone={timeZone}
                  webUrl={webUrl}
                  onAction={(kind) => {
                    if (kind === 'interested') void quick(`${base}/${c.id}/set-status`, { status: 'INTERESTED' }, t('ui.admin-dossiers.toast.interested'));
                    else if (kind === 'deleteDraft') void quick(`${base}/${c.id}`, undefined, t('ui.admin-dossiers.toast.draftDeleted'), 'DELETE');
                    else if (kind === 'visit') setVisitFor(c);
                    else if (kind === 'select') setWin({ kind: 'select', c, confirming: false });
                    else setWin({ kind, c } as Win);
                  }}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <ProposePanel open={panel} dossier={dossier} client={list.client} close={() => setPanel(false)} done={() => (setPanel(false), changed())} />
      <CandidateWindows win={win} base={base} dossier={dossier} lots={list.lots} close={() => setWin(null)} done={changed} />
      <AppointmentDialog open={visitFor !== null} onClose={() => setVisitFor(null)} onDone={() => (setVisitFor(null), changed())} preset={visitFor ? { clientId: dossier.client.id, clientName: dossier.client.name, dossierId: dossier.id, candidateId: visitFor.id, type: 'PROPERTY_VISIT' } : undefined} />
    </div>
  );
}

type CardAction = 'interested' | 'decline' | 'select' | 'unselect' | 'deleteDraft' | 'visit' | 'lot' | 'note';

function CandidateCard({ c, dossier, lots, timeZone, webUrl, onAction }: { c: CandidateRow; dossier: DossierDetail; lots: LotOption[]; timeZone: string; webUrl: string; onAction: (k: CardAction) => void }) {
  const draft = c.origin === 'ADVISOR_PROPOSAL' && !c.sentAt;
  const items: MenuItem[] = [
    ...abilityItem(c.can.setInterested, { key: 'interested', label: t('ui.admin-dossiers.candidates.markInterested'), icon: 'heart', onSelect: () => onAction('interested') }),
    ...abilityItem(c.can.planVisit, { key: 'visit', label: t('ui.admin-dossiers.candidates.planVisit'), icon: 'calendar', onSelect: () => onAction('visit') }),
    ...abilityItem(c.can.decline, { key: 'decline', label: t('ui.admin-dossiers.candidates.decline'), icon: 'close', onSelect: () => onAction('decline') }),
    ...abilityItem(c.can.unselect, { key: 'unselect', label: t('ui.admin-dossiers.candidates.unselect'), icon: 'arrow-left', onSelect: () => onAction('unselect'), separated: true }),
    ...abilityItem(c.can.deleteDraft, { key: 'deleteDraft', label: t('ui.admin-dossiers.candidates.deleteDraft'), icon: 'trash', danger: true, onSelect: () => onAction('deleteDraft') }),
    ...(dossier.can.manageCandidates !== false ? [{ key: 'note', label: t('ui.admin-dossiers.candidates.editNote'), icon: 'edit' as const, onSelect: () => onAction('note'), separated: true }] : []),
    ...(c.property.publicPath ? [{ key: 'public', label: t('ui.admin-dossiers.candidates.publicPage'), icon: 'external-link' as const, href: `${webUrl}${c.property.publicPath}` }] : []),
  ];
  const statusLabel = c.selectionRequestedAt ? t('ui.admin-dossiers.candidates.statusAsked') : draft ? t('ui.admin-dossiers.candidates.statusDraft') : enumLabel('CandidateStatus', c.status);
  return (
    <article className={[s.cand, c.retained && s.candRetained, ['DECLINED', 'UNAVAILABLE'].includes(c.status) && s.candDim].filter(Boolean).join(' ')} data-candidate={c.property.reference}>
      <Photo image={c.property.photo} className={s.candPhoto} />
      <div className={s.candBody}>
        <div className={s.candHead}>
          <div className={s.candTitleBlock}>
            <h4 className={s.candTitle}>{c.property.title}</h4>
            <span className={s.sub}>{[c.property.reference, c.property.city, c.property.promoterName].filter(Boolean).join(' · ')}</span>
          </div>
          <StatusTag tone={c.selectionRequestedAt ? 'warning' : draft ? 'neutral' : (CANDIDATE_TONE[c.status] ?? 'neutral')}>{statusLabel}</StatusTag>
        </div>
        <div className={s.candFacts}>
          <span className={s.candPrice}>{amount(c.property.priceFrom) ?? DASH}</span>
          <StatusTag tone={AVAILABILITY_TONE[c.property.availability] ?? 'neutral'}>{enumLabel('Availability', c.property.availability)}</StatusTag>
          {!c.property.online && c.property.publication === 'PUBLISHED' ? <StatusTag tone="warning">{t('ui.admin-dossiers.candidates.offline')}</StatusTag> : null}
          <span className={s.sub}>{t('ui.admin-dossiers.candidates.lotsLeft', { n: c.property.lotsAvailable })}</span>
        </div>
        <p className={s.candOrigin}>
          {c.origin === 'ADVISOR_PROPOSAL'
            ? c.sentAt
              ? t('ui.admin-dossiers.candidates.proposedBy', { nom: c.proposedBy ?? DASH, date: shortDate(c.sentAt, timeZone) })
              : t('ui.admin-dossiers.candidates.draftBy', { nom: c.proposedBy ?? DASH })
            : t('ui.admin-dossiers.candidates.clientInterest', { date: shortDate(c.createdAt, timeZone) })}
          {c.sentAt ? <span className={s.sub}> · {c.viewedAt ? t('ui.admin-dossiers.candidates.viewed', { date: shortDate(c.viewedAt, timeZone) }) : t('ui.admin-dossiers.candidates.notViewed')}</span> : null}
        </p>
        {c.visitAt ? (
          <p className={s.candLine}>
            <Icon name="calendar" size={16} />
            {t('ui.admin-dossiers.candidates.visitOn', { date: shortDateTime(c.visitAt, timeZone) })}
          </p>
        ) : null}
        {c.clientComment ? <blockquote className={s.quote}>{c.clientComment}</blockquote> : null}
        {c.status === 'DECLINED' && c.declineReason ? (
          <p className={s.candLine}>
            <Icon name="info" size={16} />
            {t('ui.admin-dossiers.candidates.declinedFor', { raison: enumLabel('DeclineReason', c.declineReason) ?? '' })}
            {c.declineNote ? ` — ${c.declineNote}` : ''}
          </p>
        ) : null}
        {c.selectionDeclineNote && !c.selectionRequestedAt && c.status === 'INTERESTED' ? <p className={s.candLine}>{t('ui.admin-dossiers.candidates.choiceRefused', { raison: c.selectionDeclineNote })}</p> : null}
        {c.advisorNote ? (
          <p className={s.internalNote}>
            <Icon name="lock" size={16} />
            {c.advisorNote}
          </p>
        ) : null}
        {c.retained ? (
          <div className={s.lotLine}>
            <span>{dossier.lot ? t('ui.admin-dossiers.candidates.intendedLot', { lot: dossier.lot.reference, prix: money(dossier.lot.price.amount, dossier.lot.price.currency) }) : t('ui.admin-dossiers.candidates.noLot', { n: lots.length })}</span>
            {shown(c.can.chooseLot) ? (
              <Button variant="secondary" size="S" disabled={!allowed(c.can.chooseLot)} title={whyNot(c.can.chooseLot) ?? undefined} onClick={() => onAction('lot')}>
                {t('ui.admin-dossiers.candidates.chooseLot')}
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className={s.candActions}>
          {shown(c.can.select) && !c.selectionRequestedAt ? (
            <Button variant="tool" size="S" disabled={!allowed(c.can.select)} title={whyNot(c.can.select) ?? undefined} onClick={() => onAction('select')}>
              <Icon name="star" size={16} />
              {t('ui.admin-dossiers.candidates.retain')}
            </Button>
          ) : null}
          {items.length ? <Menu label={t('ui.admin-dossiers.candidates.menu', { bien: c.property.title })} items={items} /> : null}
        </div>
      </div>
    </article>
  );
}

// ─── Windows of a considered property ───────────────────────────────────────

function CandidateWindows({ win, base, dossier, lots, close, done }: { win: Win; base: string; dossier: DossierDetail; lots: LotOption[]; close: () => void; done: () => void }) {
  const title = win ? t(`ui.admin-dossiers.candidates.win.${win.kind === 'select' && win.confirming ? 'confirm' : win.kind}` as never, { bien: win.c.property.title }) : '';
  return (
    <Modal open={win !== null} onClose={close} title={title} closeLabel={t('ui.common.close')} width={win?.kind === 'select' || win?.kind === 'lot' ? 560 : 480}>
      {win?.kind === 'decline' ? <DeclineForm c={win.c} base={base} close={close} done={done} /> : null}
      {win?.kind === 'declineSelection' || win?.kind === 'unselect' ? <ReasonForm kind={win.kind} c={win.c} base={base} close={close} done={done} /> : null}
      {win?.kind === 'select' ? <SelectForm c={win.c} confirming={win.confirming} base={base} close={close} done={done} /> : null}
      {win?.kind === 'lot' ? <LotForm dossier={dossier} lots={lots} close={close} done={done} /> : null}
      {win?.kind === 'note' ? <NoteForm c={win.c} base={base} close={close} done={done} /> : null}
    </Modal>
  );
}

function DeclineForm({ c, base, close, done }: { c: CandidateRow; base: string; close: () => void; done: () => void }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const { pending, errors, setErrors, run, banner } = useAction(done, t('ui.admin-dossiers.toast.declined'));
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason) return setErrors({ declineReason: t('ui.validation.REQUIRED') });
        void run(() => adminCall(`${base}/${c.id}/set-status`, { body: { status: 'DECLINED', declineReason: reason, declineNote: note.trim() || null } }));
      }}
    >
      <p>{t('ui.admin-dossiers.candidates.declineText')}</p>
      {c.visitAt ? <Banner tone="warning">{t('ui.admin-dossiers.candidates.declineVisit')}</Banner> : null}
      {banner}
      <SelectInput label={t('ui.admin-dossiers.field.declineReason')} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.declineReason} autoFocus>
        <option value="" disabled>
          {t('ui.admin-dossiers.field.choose')}
        </option>
        {DECLINE_REASONS.map((r) => (
          <option key={r} value={r}>
            {enumLabel('DeclineReason', r)}
          </option>
        ))}
      </SelectInput>
      <TextArea label={t('ui.admin-dossiers.field.precision')} optional value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
      <Buttons close={close} pending={pending} label={t('ui.admin-dossiers.candidates.decline')} />
    </form>
  );
}

function ReasonForm({ kind, c, base, close, done }: { kind: 'declineSelection' | 'unselect'; c: CandidateRow; base: string; close: () => void; done: () => void }) {
  const [reason, setReason] = useState('');
  const { pending, errors, setErrors, run, banner } = useAction(done, t(kind === 'unselect' ? 'ui.admin-dossiers.toast.unselected' : 'ui.admin-dossiers.toast.selectionRefused'));
  const required = kind === 'declineSelection';
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (required && !reason.trim()) return setErrors({ reason: t('ui.validation.REQUIRED') });
        void run(() => adminCall(`${base}/${c.id}/${kind === 'unselect' ? 'unselect' : 'decline-selection'}`, { body: { reason: reason.trim() || null } }));
      }}
    >
      <p>{t(kind === 'unselect' ? 'ui.admin-dossiers.candidates.unselectText' : 'ui.admin-dossiers.candidates.refuseText', { bien: c.property.title })}</p>
      {banner}
      <TextArea label={t(required ? 'ui.admin-dossiers.candidates.refuseReason' : 'ui.admin-dossiers.field.reasonInternal')} optional={!required} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} error={errors.reason} autoFocus />
      <Buttons close={close} pending={pending} label={t(kind === 'unselect' ? 'ui.admin-dossiers.candidates.unselect' : 'ui.admin-dossiers.candidates.refuse')} danger={kind === 'unselect'} />
    </form>
  );
}

/** CYC-071 — retaining a property, with the lot if one is chosen (the client's preferred lot proposed first). */
function SelectForm({ c, confirming, base, close, done }: { c: CandidateRow; confirming: boolean; base: string; close: () => void; done: () => void }) {
  const [lots, setLots] = useState<LotOption[] | null>(null);
  const [lotId, setLotId] = useState(c.preferredLot && c.preferredLot.status === 'AVAILABLE' ? c.preferredLot.id : '');
  const { pending, run, banner } = useAction(done, t(confirming ? 'ui.admin-dossiers.toast.selectionConfirmed' : 'ui.admin-dossiers.toast.selected'));
  useEffect(() => {
    // The lots come from the public catalogue of the property: its available lots.
    void adminCall<{ data: LotOption[] }>(`${base}/${c.id}/lots`).then((r) => setLots(r.ok ? r.data.data : []));
  }, [base, c.id]);
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => adminCall(`${base}/${c.id}/${confirming ? 'confirm-selection' : 'select'}`, { body: { lotId: lotId || null } }));
      }}
    >
      <p>{t('ui.admin-dossiers.candidates.retainText', { bien: c.property.title })}</p>
      {banner}
      <SelectInput label={t('ui.admin-dossiers.candidates.lotOptional')} value={lotId} onChange={(e) => setLotId(e.target.value)} disabled={lots === null} hint={t('ui.admin-dossiers.candidates.lotHint')}>
        <option value="">{t('ui.admin-dossiers.candidates.noLotYet')}</option>
        {(lots ?? []).map((l) => (
          <option key={l.id} value={l.id}>
            {lotLabel(l)}
            {c.preferredLot?.id === l.id ? ` — ${t('ui.admin-dossiers.candidates.preferred')}` : ''}
          </option>
        ))}
      </SelectInput>
      <p className={f.muted}>{t('ui.admin-dossiers.candidates.retainEffects')}</p>
      <Buttons close={close} pending={pending} label={t(confirming ? 'ui.admin-dossiers.candidates.confirm' : 'ui.admin-dossiers.candidates.retain')} />
    </form>
  );
}

const lotLabel = (l: LotOption) => [l.reference, l.floor !== null ? t('ui.admin-dossiers.candidates.floor', { n: l.floor }) : null, `${l.surfaceM2.replace(/\.00$/, '')} m²`, money(l.price.amount, l.price.currency)].filter(Boolean).join(' · ');

/** PIP-033, PIP-050 « Choisir le lot » — viser un lot ne le réserve pas. */
function LotForm({ dossier, lots, close, done }: { dossier: DossierDetail; lots: LotOption[]; close: () => void; done: () => void }) {
  const [lotId, setLotId] = useState(dossier.lot?.id ?? '');
  const { pending, run, banner } = useAction(done, t('ui.common.saved'));
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => adminCall(`/admin/dossiers/${dossier.id}`, { method: 'PATCH', body: { version: dossier.version, lotId: lotId || null } }));
      }}
    >
      {banner}
      <SelectInput label={t('ui.admin-dossiers.candidates.lot')} value={lotId} onChange={(e) => setLotId(e.target.value)} autoFocus>
        <option value="">{t('ui.admin-dossiers.candidates.noLotYet')}</option>
        {dossier.lot && !lots.some((l) => l.id === dossier.lot!.id) ? <option value={dossier.lot.id}>{lotLabel(dossier.lot)}</option> : null}
        {lots.map((l) => (
          <option key={l.id} value={l.id}>
            {lotLabel(l)}
          </option>
        ))}
      </SelectInput>
      <p className={s.locked}>
        <Icon name="info" size={16} />
        {t('ui.admin-dossiers.candidates.lotNotReserved')}
      </p>
      <Buttons close={close} pending={pending} label={t('ui.common.save')} />
    </form>
  );
}

function NoteForm({ c, base, close, done }: { c: CandidateRow; base: string; close: () => void; done: () => void }) {
  const [note, setNote] = useState(c.advisorNote ?? '');
  const { pending, run, banner } = useAction(done, t('ui.common.saved'));
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => adminCall(`${base}/${c.id}`, { method: 'PATCH', body: { advisorNote: note.trim() || null } }));
      }}
    >
      {banner}
      <TextArea label={t('ui.admin-dossiers.candidates.note')} hint={t('ui.admin-dossiers.candidates.noteHint')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={4} autoFocus />
      <Buttons close={close} pending={pending} label={t('ui.common.save')} />
    </form>
  );
}

// ─── « Proposer des biens » (PIP-031, PIP-032) ──────────────────────────────

function ProposePanel({ open, dossier, client, close, done }: { open: boolean; dossier: DossierDetail; client: CandidateList['client']; close: () => void; done: () => void }) {
  const toast = useToast();
  const [result, setResult] = useState<CandidateSearch | null | 'failed'>(null);
  const [q, setQ] = useState('');
  const [criteria, setCriteria] = useState<{ regionId: string; type: string[]; minRooms: string; maxPrice: string } | null>(null);
  const [page, setPage] = useState(1);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<'send' | 'save' | null>(null);
  const [key, setKey] = useState(newIdempotencyKey);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const query: Record<string, string | number | undefined> = { page, q: q.trim() || undefined };
    if (criteria) Object.assign(query, { explicit: '1', regionId: criteria.regionId || undefined, type: criteria.type.join(',') || undefined, minRooms: criteria.minRooms || undefined, maxPrice: criteria.maxPrice || undefined });
    const timer = setTimeout(() => {
      void adminCall<CandidateSearch>(`/admin/dossiers/${dossier.id}/candidates/search`, { query, signal: ctrl.signal }).then((r) => {
        if (r.ok) {
          setResult(r.data);
          if (!criteria) setCriteria({ regionId: r.data.criteria.regionId ?? '', type: r.data.criteria.type, minRooms: r.data.criteria.minRooms ? String(r.data.criteria.minRooms) : '', maxPrice: r.data.criteria.maxPrice ? String(Math.round(r.data.criteria.maxPrice)) : '' });
        } else if (!r.aborted) setResult('failed');
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, dossier.id, q, criteria, page]);

  useEffect(() => {
    if (!open) {
      setTicked(new Set());
      setCriteria(null);
      setPage(1);
      setQ('');
    }
  }, [open]);

  const toggle = (id: string) => setTicked((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const data = result && result !== 'failed' ? result : null;
  const drafts = data?.drafts ?? [];
  const leaving = ticked.size + drafts.length;

  async function submit(send: boolean) {
    setPending(send ? 'send' : 'save');
    const r = await adminCall<{ added: number; sent: number; clientHasEmail: boolean }>(`/admin/dossiers/${dossier.id}/candidates/propose`, { body: { propertyIds: [...ticked], message: message.trim() || null, send }, idempotencyKey: key });
    setPending(null);
    if (!r.ok) return toast({ tone: 'error', text: errorText(r) });
    toast({ text: send ? (r.data.clientHasEmail ? t('ui.admin-dossiers.toast.proposed', { n: r.data.sent }) : t('ui.admin-dossiers.toast.proposedNoEmail', { n: r.data.sent })) : t('ui.admin-dossiers.toast.drafted', { n: r.data.added }) });
    setMessage('');
    setKey(newIdempotencyKey());
    done();
  }

  const typesAll = ['APARTMENT', 'STUDIO', 'DUPLEX', 'VILLA', 'LAND', 'COMMERCIAL'];
  return (
    <div className={[s.sidePanel, open && s.sidePanelOpen].filter(Boolean).join(' ')} role="dialog" aria-modal="false" aria-label={t('ui.admin-dossiers.propose.title')} aria-hidden={!open} hidden={!open}>
      <header className={s.panelHead}>
        <div>
          <h2 className={s.panelTitle}>{t('ui.admin-dossiers.propose.title')}</h2>
          <p className={s.sub}>{t('ui.admin-dossiers.propose.for', { client: client.name ?? '' })}</p>
        </div>
        <Button variant="secondary" size="S" onClick={close} aria-label={t('ui.common.close')}>
          <Icon name="close" size={16} />
        </Button>
      </header>
      <div className={s.panelBody}>
        <div className={s.panelFilters}>
          <label className={s.searchField}>
            <Icon name="search" size={20} />
            <input value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder={t('ui.admin-dossiers.propose.search')} aria-label={t('ui.admin-dossiers.propose.search')} />
          </label>
          {criteria && data ? (
            <div className={s.filterGrid}>
              <SelectInput label={t('ui.admin-dossiers.propose.region')} value={criteria.regionId} onChange={(e) => (setCriteria({ ...criteria, regionId: e.target.value }), setPage(1))}>
                <option value="">{t('ui.admin-dossiers.propose.all')}</option>
                {data.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectInput>
              <SelectInput label={t('ui.admin-dossiers.propose.rooms')} value={criteria.minRooms} onChange={(e) => (setCriteria({ ...criteria, minRooms: e.target.value }), setPage(1))}>
                <option value="">{t('ui.admin-dossiers.propose.all')}</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {t('ui.admin-dossiers.propose.roomsMin', { n })}
                  </option>
                ))}
              </SelectInput>
              <label className={s.priceField}>
                <span className={s.fieldLabel}>{t('ui.admin-dossiers.propose.maxPrice', { devise: data.criteria.currency })}</span>
                <input inputMode="numeric" value={criteria.maxPrice} onChange={(e) => (setCriteria({ ...criteria, maxPrice: e.target.value.replace(/\D/g, '') }), setPage(1))} />
              </label>
              <div className={s.typeChips} role="group" aria-label={t('ui.admin-dossiers.propose.types')}>
                {typesAll.map((ty) => (
                  <button key={ty} type="button" aria-pressed={criteria.type.includes(ty)} className={[s.chip, criteria.type.includes(ty) && s.chipOn].filter(Boolean).join(' ')} onClick={() => (setCriteria({ ...criteria, type: criteria.type.includes(ty) ? criteria.type.filter((x) => x !== ty) : [...criteria.type, ty] }), setPage(1))}>
                    {enumLabel('PropertyType', ty)}
                  </button>
                ))}
              </div>
              <p className={s.sub}>{t('ui.admin-dossiers.propose.prefilled')}</p>
            </div>
          ) : null}
        </div>
        {result === null ? <Skeleton height="8rem" /> : null}
        {result === 'failed' ? <Banner tone="error">{t('ui.common.error.block')}</Banner> : null}
        {data && data.suggestions.length ? (
          <section>
            <h3 className={s.groupTitle}>
              <Icon name="sparkles" size={16} />
              {t('ui.admin-dossiers.propose.suggested')}
            </h3>
            <ul className={s.resultList}>
              {data.suggestions.map((p) => (
                <ResultRow key={`s-${p.id}`} p={p} ticked={ticked.has(p.id)} toggle={toggle} />
              ))}
            </ul>
          </section>
        ) : null}
        {data ? (
          <section>
            <h3 className={s.groupTitle}>{t('ui.admin-dossiers.propose.results', { n: data.meta.total })}</h3>
            {data.data.length ? (
              <ul className={s.resultList}>
                {data.data.map((p) => (
                  <ResultRow key={p.id} p={p} ticked={ticked.has(p.id)} toggle={toggle} />
                ))}
              </ul>
            ) : (
              <p className={s.empty}>{t('ui.admin-dossiers.propose.none')}</p>
            )}
            {data.meta.totalPages > 1 ? (
              <div className={s.pager}>
                <Button variant="secondary" size="S" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  {t('ui.admin-dossiers.propose.previous')}
                </Button>
                <span className={s.sub}>{t('ui.admin-dossiers.propose.page', { page, total: data.meta.totalPages })}</span>
                <Button variant="secondary" size="S" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>
                  {t('ui.admin-dossiers.propose.next')}
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
      <footer className={s.panelFoot}>
        {drafts.length ? <p className={s.sub}>{t('ui.admin-dossiers.propose.draftsLeave', { n: drafts.length, liste: drafts.map((x) => x.reference).join(', ') })}</p> : null}
        <TextArea label={t('ui.admin-dossiers.propose.message')} optional hint={t('ui.admin-dossiers.propose.messageHint')} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={2} />
        {!client.hasEmail ? <p className={s.warnText}>{t('ui.admin-dossiers.propose.noEmail')}</p> : null}
        <div className={s.panelButtons}>
          <Button variant="secondary" size="M" disabled={ticked.size === 0} pending={pending === 'save'} onClick={() => void submit(false)}>
            {t('ui.admin-dossiers.propose.save')}
          </Button>
          <Button variant="tool" size="M" disabled={leaving === 0} pending={pending === 'send'} onClick={() => void submit(true)}>
            {t('ui.admin-dossiers.propose.send', { n: leaving })}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function ResultRow({ p, ticked, toggle }: { p: CandidateSearchItem; ticked: boolean; toggle: (id: string) => void }) {
  const already = p.already !== null;
  return (
    <li className={[s.result, ticked && s.resultOn, already && s.resultAlready].filter(Boolean).join(' ')}>
      <label className={s.resultLabel}>
        <input type="checkbox" checked={ticked} disabled={already} onChange={() => toggle(p.id)} />
        <Photo image={p.photo} className={s.resultPhoto} />
        <span className={s.resultText}>
          <strong>{p.title}</strong>
          <span className={s.sub}>{[p.reference, p.city, p.rooms ? t('ui.admin-dossiers.propose.roomsN', { n: p.rooms }) : null].filter(Boolean).join(' · ')}</span>
          <span className={s.resultPrice}>{amount(p.priceFrom) ?? DASH}</span>
        </span>
        {already ? <StatusTag tone="neutral">{t('ui.admin-dossiers.propose.already', { statut: enumLabel('CandidateStatus', p.already) ?? '' })}</StatusTag> : null}
      </label>
    </li>
  );
}

