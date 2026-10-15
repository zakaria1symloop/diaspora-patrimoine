'use client';
// BO-050, BO-051, BO-055 — the timeline of an object and its internal notes, as ONE component every record reuses:
//
//   <Timeline endpoint={`/admin/leads/${id}/timeline`} entity={{ type: 'LEAD', id }} types={['LEAD', 'EMAIL', 'CALL', 'NOTE']} />
//
//   · most recent first; the twenty latest entries, the previous ones load while scrolling;
//   · each entry: an icon, the author (or « Automatique »), the relative date (exact on hover), a summary, an unfoldable
//     detail; filters by type, in chips. The SERVER filters what the reader may see (ROL-019): no empty line here;
//   · the quick-add bar above: « Note » now; « Appel », « E-mail », « Tâche », « Rendez-vous » join it with their forms
//     (packages 3.2, 3.9) through `quickActions` — a button never leads to a form that is not delivered;
//   · a note: 5 000 characters, « Note interne : le client ne la voit pas. », only its author changes it, anyone who
//     writes may pin it on top; `N` opens the note field (BO-080). A text being typed survives a reload (TRV-115).
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { NOTE_MAX_LENGTH, type AdminTimelineEntry, type AdminTimelinePage, type NoteEntity, type NoteItem, type TimelineType } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Banner, Button, EmptyState, Icon, Menu, Modal, Skeleton, StatusTag, useToast, type IconName, type MenuItem, type StatusTone } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { relativeTime, shortDateTime, staffLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { TextArea, formStyles as f } from '../forms';
import { useShell } from '../ShellContext';
import s from './timeline.module.css';

const ICON: Record<TimelineType, IconName> = {
  EMAIL: 'mail',
  MESSAGE: 'chat',
  CALL: 'phone',
  NOTE: 'edit',
  DOCUMENT: 'file',
  STAGE: 'arrow-right',
  PROPERTY: 'home',
  FINANCING: 'bank',
  ACTIVITY: 'calendar',
  LEAD: 'mail',
  SYSTEM: 'sparkles',
  RECORD: 'sliders',
};

const DELIVERY_TONE: Record<string, StatusTone> = { QUEUED: 'neutral', SENT: 'info', DELIVERED: 'success', OPENED: 'success', CLICKED: 'success', BOUNCED: 'error', COMPLAINED: 'error', FAILED: 'error', CANCELLED: 'inactive', SUPPRESSED: 'inactive' };

export interface TimelineProps {
  /** Route of the timeline (`…/{id}/timeline`, API-100): cursor pagination, `type` filter. */
  endpoint: string;
  /** The object notes hang on (BO-055). */
  entity: { type: NoteEntity; id: string };
  /** The types of entry this object can have: one chip each. */
  types: TimelineType[];
  /** Other buttons of the quick-add bar (BO-051), each already tied to the object. */
  quickActions?: ReactNode;
}

function sentence(entry: AdminTimelineEntry): string {
  if (entry.code === 'email.RECEIVED') return t('ui.admin-shell.timeline.event.emailReceived');
  if (entry.email?.manual) return entry.email.scheduledFor ? t('ui.admin-shell.timeline.event.emailScheduled') : t('ui.admin-shell.timeline.event.emailManual');
  if (entry.code.startsWith('email.')) return t('ui.admin-shell.timeline.event.email');
  if (entry.exchange) {
    const what = t(`ui.admin-shell.timeline.event.exchange.${entry.exchange.channel}` as MessageKey);
    return entry.exchange.channel === 'CALL' ? `${what} · ${t(`ui.enum.Direction.${entry.exchange.direction}` as MessageKey).toLocaleLowerCase('fr')}` : what;
  }
  const key = `ui.admin-shell.timeline.event.${entry.code}`;
  if (hasMessage(key)) {
    const params: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(entry.params)) if (v !== null) params[k] = v;
    if (typeof params.kind === 'string' && hasMessage(`ui.enum.LeadKind.${params.kind}`)) params.nature = t(`ui.enum.LeadKind.${params.kind}` as MessageKey).toLocaleLowerCase('fr');
    if (typeof params.source === 'string' && hasMessage(`ui.enum.LeadSource.${params.source}`)) params.origine = t(`ui.enum.LeadSource.${params.source}` as MessageKey);
    return t(key as MessageKey, params);
  }
  return t(`ui.admin-shell.timeline.type.${entry.type}`);
}

export function Timeline({ endpoint, entity, types, quickActions }: TimelineProps) {
  const { can, timeZone } = useShell();
  const toast = useToast();
  const [entries, setEntries] = useState<AdminTimelineEntry[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<TimelineType[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [writing, setWriting] = useState(false);
  const [editing, setEditing] = useState<AdminTimelineEntry | null>(null);
  const [deleting, setDeleting] = useState<AdminTimelineEntry | null>(null);
  const [exchangeEdit, setExchangeEdit] = useState<AdminTimelineEntry | null>(null);
  const [exchangeDelete, setExchangeDelete] = useState<AdminTimelineEntry | null>(null);
  const [emailCancel, setEmailCancel] = useState<AdminTimelineEntry | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const canWrite = can('note.manage');
  const filterKey = filter.join(',');

  const load = useCallback(
    async (before: string | null) => {
      const r = await adminCall<AdminTimelinePage>(endpoint, { query: { before, type: filterKey || undefined } });
      if (!r.ok) {
        if (!r.aborted) setFailed(errorText(r));
        return;
      }
      setFailed(null);
      setEntries((current) => (before && current ? [...current, ...r.data.data.filter((e) => !current.some((c) => c.id === e.id))] : r.data.data));
      setCursor(r.data.meta.nextCursor);
    },
    [endpoint, filterKey],
  );

  useEffect(() => {
    setEntries(null);
    void load(null);
  }, [load]);

  // The previous entries load while scrolling.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor) return;
    const observer = new IntersectionObserver((hits) => {
      if (hits.some((h) => h.isIntersecting) && !loadingMore) {
        setLoadingMore(true);
        void load(cursor).finally(() => setLoadingMore(false));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, load, loadingMore]);

  // BO-080 — on a record, `N` opens a note.
  useEffect(() => {
    if (!canWrite) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey || !el || el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      setWriting(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canWrite]);

  const pin = async (entry: AdminTimelineEntry) => {
    const pinned = !entry.pinned;
    setEntries((list) => list?.map((e) => (e.id === entry.id ? { ...e, pinned } : e)) ?? null); // TRV-116: shown ahead
    const r = await adminCall<NoteItem>(`/admin/notes/${entry.note!.id}/pin`, { body: { pinned } });
    if (!r.ok) {
      setEntries((list) => list?.map((e) => (e.id === entry.id ? { ...e, pinned: !pinned } : e)) ?? null);
      toast({ tone: 'error', text: errorText(r), action: { label: t('ui.common.retry'), run: () => void pin(entry) } });
    }
  };

  const remove = async () => {
    if (!deleting?.note) return;
    const r = await adminCall(`/admin/notes/${deleting.note.id}`, { method: 'DELETE' });
    if (r.ok) {
      setEntries((list) => list?.filter((e) => e.id !== deleting.id) ?? null);
      toast({ text: t('ui.admin-shell.notes.deleted') });
      setDeleting(null);
    } else toast({ tone: 'error', text: errorText(r) });
  };

  const now = Date.now();
  // pinned notes first, then the thread
  const ordered = entries ? [...entries.filter((e) => e.pinned), ...entries.filter((e) => !e.pinned)] : null;

  return (
    <section className={s.timeline} aria-label={t('ui.admin-shell.timeline.title')}>
      <header className={s.head}>
        <h2 className={s.title}>{t('ui.admin-shell.timeline.title')}</h2>
        {canWrite || quickActions ? (
          <div className={s.quick} role="group" aria-label={t('ui.admin-shell.timeline.quickAdd')}>
            {canWrite ? (
              <Button variant="secondary" size="S" icon="edit" onClick={() => setWriting(true)}>
                {t('ui.admin-shell.timeline.addNote')}
              </Button>
            ) : null}
            {quickActions}
          </div>
        ) : null}
      </header>

      {writing ? (
        <NoteForm
          entity={entity}
          onClose={() => setWriting(false)}
          onSaved={() => {
            setWriting(false);
            toast({ text: t('ui.admin-shell.notes.saved') });
            void load(null);
          }}
        />
      ) : null}

      {types.length > 1 ? (
        <div className={s.filters} role="group" aria-label={t('ui.admin-shell.timeline.filter')}>
          {types.map((type) => {
            const on = filter.includes(type);
            return (
              <button key={type} type="button" className={[s.chip, on && s.chipOn].filter(Boolean).join(' ')} aria-pressed={on} onClick={() => setFilter((v) => (on ? v.filter((x) => x !== type) : [...v, type]))}>
                <Icon name={ICON[type]} size={16} />
                {t(`ui.admin-shell.timeline.type.${type}`)}
              </button>
            );
          })}
        </div>
      ) : null}

      {failed && !entries ? (
        <Banner tone="error" action={<Button variant="secondary" size="S" onClick={() => void load(null)}>{t('ui.common.retry')}</Button>}>
          <p>{t('ui.common.error.block')}</p>
          <p>{failed}</p>
        </Banner>
      ) : ordered === null ? (
        <div className={s.loading} role="status" aria-label={t('ui.common.loading')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={s.loadingRow}>
              <Skeleton width="2rem" height="2rem" radius="50%" />
              <Skeleton width={`${50 - i * 10}%`} />
            </div>
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <EmptyState compact icon="clock" title={filter.length ? t('ui.common.empty.filtered') : t('ui.admin-shell.timeline.empty')} text={filter.length ? undefined : t('ui.admin-shell.timeline.emptyText')} />
      ) : (
        <ol className={s.list}>
          {ordered.map((entry) => {
            const author = entry.author.kind === 'SYSTEM' ? t('ui.common.automatic') : entry.author.kind === 'CLIENT' ? t('ui.admin-shell.timeline.byClient') : staffLabel(entry.author.name);
            const state = entry.code.startsWith('email.') ? entry.code.slice(6) : null;
            const actions: MenuItem[] = [];
            if (entry.note && canWrite) actions.push({ key: 'pin', label: entry.pinned ? t('ui.admin-shell.notes.unpin') : t('ui.admin-shell.notes.pin'), icon: 'star', onSelect: () => void pin(entry) });
            if (entry.note?.canEdit) actions.push({ key: 'edit', label: t('ui.common.edit'), icon: 'edit', onSelect: () => setEditing(entry) });
            if (entry.note?.canDelete) actions.push({ key: 'delete', label: t('ui.common.delete'), icon: 'trash', danger: true, onSelect: () => setDeleting(entry) });
            // MOD-400 — a report is corrected or deleted by its author within 24 hours
            if (entry.exchange?.canEdit) actions.push({ key: 'xedit', label: t('ui.admin-shell.timeline.exchangeEdit'), icon: 'edit', onSelect: () => setExchangeEdit(entry) });
            if (entry.exchange?.canDelete) actions.push({ key: 'xdelete', label: t('ui.common.delete'), icon: 'trash', danger: true, onSelect: () => setExchangeDelete(entry) });
            // COM-020 — a scheduled e-mail is cancelled while it has not left
            if (entry.email?.canCancel) actions.push({ key: 'cancel', label: t('ui.admin-shell.timeline.emailCancel'), icon: 'close', danger: true, onSelect: () => setEmailCancel(entry) });
            return (
              <li key={entry.id} className={[s.entry, entry.pinned && s.pinned].filter(Boolean).join(' ')}>
                <span className={`${s.icon} ${s[`icon-${entry.type}`] ?? ''}`} aria-hidden="true">
                  <Icon name={ICON[entry.type]} size={16} />
                </span>
                <div className={s.content}>
                  <p className={s.line}>
                    <span className={s.summary}>{sentence(entry)}</span>
                    {state && hasMessage(`ui.enum.DeliveryState.${state}`) ? <StatusTag tone={DELIVERY_TONE[state] ?? 'neutral'}>{t(`ui.enum.DeliveryState.${state}` as MessageKey)}</StatusTag> : null}
                    {entry.pinned ? <StatusTag tone="pending" icon="star">{t('ui.admin-shell.notes.pinned')}</StatusTag> : null}
                    {entry.exchange?.outcome ? <StatusTag tone={entry.exchange.outcome === 'REACHED' ? 'success' : entry.exchange.outcome === 'WRONG_NUMBER' ? 'error' : 'warning'}>{t(`ui.enum.CallOutcome.${entry.exchange.outcome}` as MessageKey)}</StatusTag> : null}
                    {entry.exchange?.durationMinutes ? <span className={s.meta}>{t('ui.admin-shell.timeline.minutes', { n: entry.exchange.durationMinutes })}</span> : null}
                    {entry.email?.scheduledFor ? <span className={s.meta}>{t('ui.admin-shell.timeline.scheduledFor', { date: shortDateTime(entry.email.scheduledFor, timeZone) })}</span> : null}
                  </p>
                  <p className={s.by}>
                    {author}
                    {' · '}
                    <time dateTime={entry.at} title={shortDateTime(entry.at, timeZone)}>
                      {relativeTime(entry.at, now, timeZone)}
                    </time>
                    {entry.note?.editedAt ? ` · ${t('ui.admin-shell.notes.edited')}` : ''}
                  </p>
                  {entry.email?.attachments.length ? <MailFiles emailId={entry.email.id} files={entry.email.attachments} /> : null}
                  {entry.detail ? (
                    entry.type === 'NOTE' ? (
                      <p className={s.noteBody}>{entry.detail}</p>
                    ) : (
                      <details className={s.detail}>
                        <summary>{t('ui.admin-shell.timeline.detail')}</summary>
                        <p>{entry.detail}</p>
                      </details>
                    )
                  ) : null}
                </div>
                {actions.length ? <Menu label={t('ui.admin-shell.notes.actions')} items={actions} /> : null}
              </li>
            );
          })}
        </ol>
      )}
      {cursor ? (
        <div ref={sentinel} className={s.more} role="status">
          {loadingMore ? t('ui.common.loading') : ''}
        </div>
      ) : null}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={t('ui.admin-shell.notes.editTitle')} closeLabel={t('ui.common.close')} width={560}>
        {editing ? (
          <NoteForm
            entity={entity}
            note={{ id: editing.note!.id, body: editing.detail ?? '' }}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              toast({ text: t('ui.common.saved') });
              void load(null);
            }}
            bare
          />
        ) : null}
      </Modal>
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('ui.admin-shell.notes.deleteTitle')}
        closeLabel={t('ui.common.close')}
        footer={
          <>
            <Button variant="secondary" size="M" onClick={() => setDeleting(null)}>
              {t('ui.common.cancel')}
            </Button>
            <Button variant="danger" size="M" onClick={() => void remove()}>
              {t('ui.common.delete')}
            </Button>
          </>
        }
      >
        <p>{t('ui.admin-shell.notes.deleteConfirm', { auteur: staffLabel(deleting?.author.name) })}</p>
      </Modal>
      <ExchangeEditModal entry={exchangeEdit} close={() => setExchangeEdit(null)} saved={() => { setExchangeEdit(null); toast({ text: t('ui.common.saved') }); void load(null); }} />
      <ConfirmModal
        open={exchangeDelete !== null}
        title={t('ui.admin-shell.timeline.exchangeDeleteTitle')}
        text={t('ui.admin-shell.timeline.exchangeDeleteText')}
        submit={t('ui.common.delete')}
        close={() => setExchangeDelete(null)}
        run={() => adminCall(`/admin/communications/${exchangeDelete!.exchange!.id}`, { method: 'DELETE' })}
        done={() => { setExchangeDelete(null); toast({ text: t('ui.admin-shell.timeline.exchangeDeleted') }); void load(null); }}
      />
      <ConfirmModal
        open={emailCancel !== null}
        title={t('ui.admin-shell.timeline.emailCancelTitle')}
        text={t('ui.admin-shell.timeline.emailCancelText')}
        submit={t('ui.admin-shell.timeline.emailCancel')}
        close={() => setEmailCancel(null)}
        run={() => adminCall(`/admin/emails/${emailCancel!.email!.id}/cancel`, { method: 'POST' })}
        done={() => { setEmailCancel(null); toast({ text: t('ui.admin-shell.timeline.emailCancelled') }); void load(null); }}
      />
    </section>
  );
}

function ConfirmModal({ open, title, text, submit, close, run, done }: { open: boolean; title: string; text: string; submit: string; close: () => void; run: () => Promise<{ ok: boolean }>; done: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      closeLabel={t('ui.common.close')}
      footer={
        <>
          <Button variant="secondary" size="M" onClick={close}>
            {t('ui.common.cancel')}
          </Button>
          <Button
            variant="danger"
            size="M"
            pending={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              const r = await run();
              setPending(false);
              if (r.ok) done();
              else setError(errorText(r as never));
            }}
          >
            {submit}
          </Button>
        </>
      }
    >
      <p>{text}</p>
      {error ? <Banner tone="error">{error}</Banner> : null}
    </Modal>
  );
}

const OUTCOMES = ['REACHED', 'NO_ANSWER', 'VOICEMAIL', 'WRONG_NUMBER'] as const;

/** MOD-400 — the author corrects his report: outcome, moment, text. The first contact is recomputed by the API. */
function ExchangeEditModal({ entry, close, saved }: { entry: AdminTimelineEntry | null; close: () => void; saved: () => void }) {
  const [outcome, setOutcome] = useState<string>('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!entry?.exchange) return;
    setOutcome(entry.exchange.outcome ?? '');
    setBody(entry.detail ?? '');
    setError(null);
  }, [entry]);
  const x = entry?.exchange;
  return (
    <Modal open={entry !== null} onClose={close} title={t('ui.admin-shell.timeline.exchangeEdit')} closeLabel={t('ui.common.close')} width={560}>
      {x ? (
        <form
          className={f.form}
          noValidate
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            setPending(true);
            const r = await adminCall(`/admin/communications/${x.id}`, { method: 'PATCH', body: { direction: x.direction, callOutcome: x.channel === 'CALL' ? outcome : null, occurredAt: entry!.at, durationMinutes: x.durationMinutes, body } });
            setPending(false);
            if (r.ok) saved();
            else setError(errorText(r));
          }}
        >
          {error ? <Banner tone="error">{error}</Banner> : null}
          {x.channel === 'CALL' ? (
            <div className={s.filters} role="radiogroup" aria-label={t('ui.admin-shell.timeline.outcome')}>
              {OUTCOMES.map((o) => (
                <button key={o} type="button" role="radio" aria-checked={outcome === o} className={[s.chip, outcome === o && s.chipOn].filter(Boolean).join(' ')} onClick={() => setOutcome(o)}>
                  {t(`ui.enum.CallOutcome.${o}` as MessageKey)}
                </button>
              ))}
            </div>
          ) : null}
          <TextArea label={t('ui.admin-shell.timeline.report')} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={5} />
          <div className={`${f.actions} ${f.actionsEnd}`}>
            <Button variant="secondary" size="M" onClick={close}>
              {t('ui.common.cancel')}
            </Button>
            <Button type="submit" variant="tool" size="M" pending={pending}>
              {t('ui.common.save')}
            </Button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}

function NoteForm({ entity, note, onClose, onSaved, bare }: { entity: { type: NoteEntity; id: string }; note?: { id: string; body: string }; onClose: () => void; onSaved: () => void; bare?: boolean }) {
  const draftKey = `dp_note_draft_${entity.type}_${entity.id}`;
  const [body, setBody] = useState(note?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // TRV-115 — a long text being typed is kept in the session storage until it is sent.
  useEffect(() => {
    if (note) return;
    try {
      const draft = sessionStorage.getItem(draftKey);
      if (draft) setBody(draft);
    } catch {
      /* storage unavailable */
    }
  }, [draftKey, note]);
  useEffect(() => {
    if (note) return;
    try {
      if (body) sessionStorage.setItem(draftKey, body);
      else sessionStorage.removeItem(draftKey);
    } catch {
      /* storage unavailable */
    }
  }, [body, draftKey, note]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return setError(t('ui.validation.REQUIRED'));
    setPending(true);
    setError(null);
    setBanner(null);
    const r = note ? await adminCall<NoteItem>(`/admin/notes/${note.id}`, { method: 'PATCH', body: { body } }) : await adminCall<NoteItem>('/admin/notes', { body: { entityType: entity.type, entityId: entity.id, body } });
    setPending(false);
    if (!r.ok) return setBanner(errorText(r));
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      /* storage unavailable */
    }
    onSaved();
  }

  return (
    <form className={bare ? f.form : `${f.form} ${s.noteForm}`} onSubmit={submit} noValidate>
      {banner ? <Banner tone="error">{banner}</Banner> : null}
      <TextArea
        label={note ? t('ui.admin-shell.notes.label') : t('ui.admin-shell.notes.newLabel')}
        hint={t('ui.admin-shell.notes.internal')}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={NOTE_MAX_LENGTH}
        rows={4}
        error={error}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !bare) {
            e.stopPropagation();
            onClose();
          }
        }}
      />
      <div className={`${f.actions} ${f.actionsEnd}`}>
        <Button variant="secondary" size="S" onClick={onClose}>
          {t('ui.common.cancel')}
        </Button>
        <Button type="submit" variant="tool" size="S" pending={pending}>
          {t('ui.common.save')}
        </Button>
      </div>
    </form>
  );
}

/** COM-020, COM-030 — the files of an e-mail; each opens by a link of 5 minutes (MED-030), never a lasting address. */
function MailFiles({ emailId, files }: { emailId: string; files: { uploadId: string; name: string; sizeBytes: number }[] }) {
  const toast = useToast();
  async function open(uploadId: string) {
    const r = await adminCall<{ url: string }>(`/admin/communications/${emailId}/attachments/${uploadId}`);
    if (!r.ok) return toast({ tone: 'error', text: errorText(r) });
    window.open(r.data.url, '_blank', 'noopener');
  }
  return (
    <ul className={s.mailFiles}>
      {files.map((file) => (
        <li key={file.uploadId}>
          <Button variant="tertiary" size="S" icon="paperclip" onClick={() => void open(file.uploadId)} aria-label={t('ui.admin-exchanges.files.open', { nom: file.name })}>
            {file.name}
          </Button>
        </li>
      ))}
    </ul>
  );
}
