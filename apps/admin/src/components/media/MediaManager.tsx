'use client';
// EA-44 — the « Médias » tab of a programme or of a property (CTL-080 … CTL-084). Drop or choose several files: each
// shows its progress, then « Traitement en cours », then its vignette. For each media: nature, room (required for a 360°
// view), caption, alt text (proposed, MED-023), date taken, « Image d'illustration » (Q-031), « Couverture » (one per
// owner, MOD-203); order by drag and drop (or « Avancer » / « Reculer » from the keyboard). States: « Traitement en
// cours », « Échec » with its reason and « Réessayer » (not after the antivirus refused the file, CTL-082). Delete asks
// first and is refused when a published property would lose its last image (CTL-083). Bulk: nature, illustration, delete.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { MEDIA_KINDS_BY_OWNER, MEDIA_ROOM_LABELS, type AdminMedia, type AdminMediaKind, type MediaBulkResult, type MediaListResponse } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { BulkBar, Button, EmptyState, Icon, Menu, Modal, SkeletonRows, StatusTag, useToast, type MenuItem } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { Surface } from '../shell/Page';
import { Checkbox, SelectInput, TextArea, TextInput, formStyles as f } from '../shell/forms';
import { ConfirmDialog, DialogButtons, FailureBanner, useCall } from '../catalogue/parts';
import { kindFor, uploadMedia, type UploadTarget } from './upload';
import s from './media.module.css';

export interface MediaManagerProps {
  ownerType: 'PROGRAM' | 'PROPERTY';
  ownerId: string;
  /** Name of the programme or title of the property (confirmations, generated alt texts). */
  ownerLabel: string;
  /** `catalogue.write` (CTL-160): without it the grid is read-only. */
  canWrite: boolean;
  /** Called after a change that may move the completeness or the cover of the record (upload ready, delete, cover). */
  onChanged?: () => void;
}

interface Pending {
  key: string;
  name: string;
  progress: number;
  error: string | null;
}

const IMAGE = new Set(['PHOTO', 'RENDER_3D']);
const kindLabel = (k: string) => t(`ui.enum.MediaKind.${k}` as MessageKey);
const sizeLabel = (n: number | null) => (n === null ? '' : n > 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1e3))} ko`);

export function MediaManager({ ownerType, ownerId, ownerLabel, canWrite, onChanged }: MediaManagerProps) {
  const toast = useToast();
  const [data, setData] = useState<MediaListResponse | null>(null);
  const [failure, setFailure] = useState<Parameters<typeof FailureBanner>[0]['failure']>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploadKind, setUploadKind] = useState<UploadTarget['kind']>('PHOTO');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ kind: 'edit' | 'delete' | 'video' | 'bulk-kind' | 'bulk-delete'; media?: AdminMedia } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const call = useCall();

  const load = useCallback(async () => {
    const r = await adminCall<MediaListResponse>('/admin/media', { query: { ownerType, ownerId } });
    if (r.ok) setData(r.data);
    else if (!r.aborted) setFailure(r);
  }, [ownerType, ownerId]);
  useEffect(() => {
    void load();
  }, [load]);
  // While a media is being processed, its state is read again (CTL-082).
  const processing = data?.data.some((m) => m.processingStatus === 'PENDING') ?? false;
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [processing, load]);

  const changed = () => {
    void load();
    onChanged?.();
  };
  const kinds = MEDIA_KINDS_BY_OWNER[ownerType].filter((k): k is UploadTarget['kind'] => k !== 'VIDEO');
  const writable = canWrite && (data?.canWrite ?? true);

  async function upload(files: FileList | File[]) {
    const list = [...files].slice(0, 100); // SEC-070: one hundred files per batch
    const batch = list.map((file, i) => ({ file, key: `${Date.now()}-${i}-${file.name}` }));
    setPending((p) => [...p, ...batch.map((b) => ({ key: b.key, name: b.file.name, progress: 0, error: null }))]);
    let ok = 0;
    for (const b of batch) {
      const r = await uploadMedia(b.file, { ownerType, ownerId, kind: kindFor(b.file, uploadKind) }, (progress) => setPending((p) => p.map((x) => (x.key === b.key ? { ...x, progress } : x))));
      if (r.ok) {
        ok++;
        setPending((p) => p.filter((x) => x.key !== b.key));
        void load();
      } else {
        setPending((p) => p.map((x) => (x.key === b.key ? { ...x, error: errorText(r) } : x)));
      }
    }
    if (ok) {
      toast({ text: t('ui.admin-media.manager.toast.uploaded', { n: ok }) });
      onChanged?.();
    }
  }

  async function quick(path: string, body: unknown, success: string, method: 'PATCH' | 'POST' = 'PATCH') {
    const r = await call.run(() => adminCall(path, { method, body }), success);
    if (r !== null) changed();
  }

  // ─── Order (CTL-081) ──────────────────────────────────────────────────
  const media = data?.data ?? [];
  async function saveOrder(ids: string[]) {
    setData((d) => (d ? { ...d, data: ids.map((id, i) => ({ ...d.data.find((m) => m.id === id)!, sortOrder: i + 1 })) } : d));
    const r = await call.run(() => adminCall('/admin/media/reorder', { body: { ownerType, ownerId, ids } }), t('ui.admin-media.manager.toast.order'));
    if (r === null) void load();
    else onChanged?.();
  }
  const move = (id: string, delta: -1 | 1) => {
    const ids = media.map((m) => m.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    void saveOrder(ids);
  };
  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = media.map((m) => m.id).filter((x) => x !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setDragId(null);
    void saveOrder(ids);
  };

  const groups = useMemo(
    () => ({ count: media.length, cover: media.find((m) => m.isCover) ?? media.find((m) => IMAGE.has(m.kind) && m.processingStatus === 'READY') ?? null }),
    [media],
  );

  if (failure) return <FailureBanner failure={failure} />;
  if (!data) return <SkeletonRows rows={4} label={t('ui.common.loading')} />;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files.length && writable) void upload(e.dataTransfer.files);
  };

  const tileMenu = (m: AdminMedia, i: number): MenuItem[] => [
    ...(m.url ? [{ key: 'open', label: t('ui.admin-media.manager.open'), icon: 'external-link' as const, onSelect: () => window.open(m.url!, '_blank', 'noopener') }] : []),
    { key: 'edit', label: t('ui.admin-media.manager.edit'), icon: 'edit', onSelect: () => setDialog({ kind: 'edit', media: m }) },
    ...(IMAGE.has(m.kind) && m.processingStatus === 'READY' && !m.isCover ? [{ key: 'cover', label: t('ui.admin-media.manager.makeCover'), icon: 'star' as const, onSelect: () => void quick(`/admin/media/${m.id}`, { isCover: true }, t('ui.admin-media.manager.toast.cover')) }] : []),
    ...(IMAGE.has(m.kind)
      ? [{ key: 'illustration', label: m.isIllustration ? t('ui.admin-media.manager.unmarkIllustration') : t('ui.admin-media.manager.markIllustration'), onSelect: () => void quick(`/admin/media/${m.id}`, { isIllustration: !m.isIllustration }, t('ui.admin-media.manager.toast.saved')) }]
      : []),
    ...(m.canRetry ? [{ key: 'retry', label: t('ui.admin-media.manager.retry'), icon: 'arrow-right' as const, onSelect: () => void quick(`/admin/media/${m.id}/retry`, {}, t('ui.admin-media.manager.toast.retried'), 'POST') }] : []),
    ...(i > 0 ? [{ key: 'up', label: t('ui.admin-media.manager.moveUp'), icon: 'arrow-left' as const, onSelect: () => move(m.id, -1), separated: true }] : []),
    ...(i < media.length - 1 ? [{ key: 'down', label: t('ui.admin-media.manager.moveDown'), icon: 'arrow-right' as const, onSelect: () => move(m.id, 1), separated: i === 0 }] : []),
    { key: 'delete', label: t('ui.admin-media.manager.delete'), icon: 'trash', danger: true, onSelect: () => setDialog({ kind: 'delete', media: m }), separated: true },
  ];

  return (
    <Surface
      title={`${t('ui.admin-media.manager.title')} · ${t('ui.admin-media.manager.count', { n: groups.count })}`}
      actions={
        writable && ownerType !== undefined && MEDIA_KINDS_BY_OWNER[ownerType].includes('VIDEO') ? (
          <Button variant="secondary" size="S" icon="play" onClick={() => setDialog({ kind: 'video' })}>
            {t('ui.admin-media.manager.addVideo')}
          </Button>
        ) : null
      }
    >
      <div className={s.manager}>
        {data.usesProgramPhotos ? (
          <p className={s.notice}>
            <Icon name="info" size={16} />
            {t('ui.admin-media.manager.usesProgram')}
          </p>
        ) : null}
        {!writable ? <p className={s.muted}>{t('ui.admin-media.manager.readOnly')}</p> : null}
        <FailureBanner failure={call.failure} />

        {writable ? (
          <div
            className={s.drop}
            data-over={over ? '1' : undefined}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                setOver(true);
              }
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <Icon name="upload" size={24} />
            <div className={s.dropText}>
              <strong>{t('ui.admin-media.manager.drop')}</strong>
              <span className={s.muted}>
                {t('ui.admin-media.manager.dropHint')}{' '}
                <button type="button" className={s.linkButton} onClick={() => input.current?.click()}>
                  {t('ui.admin-media.manager.choose')}
                </button>
              </span>
              <span className={s.limits}>{t('ui.admin-media.manager.limits')}</span>
            </div>
            <label className={s.kindPick}>
              <span>{t('ui.admin-media.manager.kindForUpload')}</span>
              <select value={uploadKind} onChange={(e) => setUploadKind(e.target.value as UploadTarget['kind'])}>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {kindLabel(k)}
                  </option>
                ))}
              </select>
            </label>
            <input ref={input} type="file" multiple hidden accept={uploadKind === 'BROCHURE' ? 'application/pdf' : uploadKind === 'PLAN' ? 'application/pdf,image/jpeg,image/png' : 'image/*'} onChange={(e) => e.target.files && void upload(e.target.files).then(() => (e.target.value = ''))} />
          </div>
        ) : null}

        {selected.size > 0 ? (
          <BulkBar count={selected.size} countLabel={t('ui.admin-media.manager.selected', { n: selected.size })} clearLabel={t('ui.common.list.unselectAll')} onClear={() => setSelected(new Set())}>
            <Button size="S" variant="secondary" onClick={() => setDialog({ kind: 'bulk-kind' })}>
              {t('ui.admin-media.manager.changeKind')}
            </Button>
            <Button size="S" variant="secondary" onClick={() => void runBulk({ action: 'illustration', isIllustration: true })}>
              {t('ui.admin-media.manager.markIllustration')}
            </Button>
            <Button size="S" variant="danger" icon="trash" onClick={() => setDialog({ kind: 'bulk-delete' })}>
              {t('ui.admin-media.manager.delete')}
            </Button>
          </BulkBar>
        ) : null}

        {media.length === 0 && pending.length === 0 ? (
          <EmptyState icon="camera" title={t('ui.admin-media.manager.empty.title')} text={ownerType === 'PROGRAM' ? `${t('ui.admin-media.manager.empty.text')} ${t('ui.admin-media.manager.empty.textProgram')}` : t('ui.admin-media.manager.empty.text')} compact />
        ) : (
          <>
            {writable && media.length > 1 ? <p className={s.hint}>{t('ui.admin-media.manager.dragHint')}</p> : null}
            <ul className={s.grid}>
              {media.map((m, i) => (
                <li
                  key={m.id}
                  className={s.tile}
                  data-selected={selected.has(m.id) ? '1' : undefined}
                  data-dragging={dragId === m.id ? '1' : undefined}
                  draggable={writable}
                  onDragStart={(e) => {
                    setDragId(m.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => dragId && e.preventDefault()}
                  onDrop={(e) => {
                    if (dragId) {
                      e.preventDefault();
                      e.stopPropagation();
                      dropOn(m.id);
                    }
                  }}
                >
                  <div className={s.visual}>
                    {m.thumb ? (
                      <img src={m.thumb.url} alt={m.alt ?? m.altProposed} loading="lazy" draggable={false} />
                    ) : (
                      <span className={s.placeholder}>
                        <Icon name={m.kind === 'VIDEO' ? 'play' : m.processingStatus === 'FAILED' ? 'status-error' : m.processingStatus === 'PENDING' ? 'spinner' : 'file'} size={32} />
                      </span>
                    )}
                    {writable ? (
                      <span className={s.check}>
                        <input
                          type="checkbox"
                          aria-label={t('ui.admin-media.manager.select', { nom: m.fileName ?? kindLabel(m.kind) })}
                          checked={selected.has(m.id)}
                          onChange={(e) => setSelected((cur) => {
                            const next = new Set(cur);
                            if (e.target.checked) next.add(m.id);
                            else next.delete(m.id);
                            return next;
                          })}
                        />
                      </span>
                    ) : null}
                    {m.isCover || groups.cover?.id === m.id ? (
                      <span className={s.cover}>
                        <Icon name="star" size={16} />
                        {t('ui.admin-media.manager.cover')}
                      </span>
                    ) : null}
                    <span className={s.rank}>{i + 1}</span>
                  </div>
                  <div className={s.meta}>
                    <div className={s.metaTop}>
                      <span className={s.kind}>{kindLabel(m.kind)}</span>
                      {m.processingStatus !== 'READY' ? (
                        <StatusTag tone={m.processingStatus === 'FAILED' ? 'error' : 'pending'}>{t(`ui.admin-media.manager.state.${m.processingStatus}`)}</StatusTag>
                      ) : null}
                      {writable ? <Menu label={t('ui.admin-programs.common.moreActions')} items={tileMenu(m, i)} /> : null}
                    </div>
                    <span className={m.roomLabel ? s.room : `${s.room} ${s.roomMissing}`}>{m.roomLabel ?? (m.kind === 'PHOTO' || m.kind === 'PANO_360' ? t('ui.admin-media.manager.noRoom') : (m.caption ?? m.fileName ?? ''))}</span>
                    <span className={s.flags}>
                      {m.isIllustration ? <StatusTag tone="info">{t('ui.admin-media.manager.illustration')}</StatusTag> : null}
                      {m.small ? (
                        <span className={s.warn} title={t('ui.admin-media.manager.small')}>
                          <Icon name="status-warning" size={16} />
                          {t('ui.admin-media.manager.small')}
                        </span>
                      ) : null}
                    </span>
                    {m.processingStatus === 'FAILED' ? (
                      <span className={s.error}>
                        {m.processingError}
                        {m.canRetry && writable ? (
                          <button type="button" className={s.linkButton} onClick={() => void quick(`/admin/media/${m.id}/retry`, {}, t('ui.admin-media.manager.toast.retried'), 'POST')}>
                            {t('ui.admin-media.manager.retry')}
                          </button>
                        ) : null}
                      </span>
                    ) : (
                      <span className={s.size}>{[m.width && m.height ? `${m.width} × ${m.height}` : null, sizeLabel(m.sizeBytes)].filter(Boolean).join(' · ')}</span>
                    )}
                  </div>
                </li>
              ))}
              {pending.map((p) => (
                <li key={p.key} className={`${s.tile} ${s.uploading}`}>
                  <div className={s.visual}>
                    <span className={s.placeholder}>
                      <Icon name={p.error ? 'status-error' : 'upload'} size={32} />
                    </span>
                    {!p.error ? (
                      <span className={s.progress}>
                        <span style={{ width: `${p.progress}%` }} />
                      </span>
                    ) : null}
                  </div>
                  <div className={s.meta}>
                    <span className={s.kind}>{p.name}</span>
                    {p.error ? (
                      <span className={s.error}>
                        {p.error}
                        <button type="button" className={s.linkButton} onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))}>
                          {t('ui.common.close')}
                        </button>
                      </span>
                    ) : (
                      <span className={s.size}>{p.progress < 100 ? t('ui.admin-media.manager.state.uploading', { p: p.progress }) : t('ui.admin-media.manager.state.PENDING')}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {dialog?.kind === 'edit' && dialog.media ? <EditDialog media={dialog.media} kinds={MEDIA_KINDS_BY_OWNER[ownerType]} onClose={() => setDialog(null)} onDone={() => (setDialog(null), changed())} /> : null}
      {dialog?.kind === 'video' ? <VideoDialog ownerType={ownerType} ownerId={ownerId} onClose={() => setDialog(null)} onDone={() => (setDialog(null), changed())} /> : null}
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title={t('ui.admin-media.manager.dialog.deleteTitle', { nom: dialog?.media?.fileName ?? kindLabel(dialog?.media?.kind ?? 'PHOTO') })}
        text={t('ui.admin-media.manager.dialog.deleteText')}
        submit={t('ui.admin-media.manager.delete')}
        danger
        call={() => adminCall(`/admin/media/${dialog!.media!.id}`, { method: 'DELETE' })}
        success={t('ui.admin-media.manager.toast.deleted')}
        onClose={() => setDialog(null)}
        onDone={() => (setDialog(null), changed())}
      />
      <ConfirmDialog
        open={dialog?.kind === 'bulk-delete'}
        title={t('ui.admin-media.manager.dialog.deleteMany', { n: selected.size })}
        text={t('ui.admin-media.manager.dialog.deleteManyText')}
        submit={t('ui.admin-media.manager.delete')}
        danger
        call={() => adminCall<MediaBulkResult>('/admin/media/bulk', { body: { ids: [...selected], action: 'delete' } })}
        onClose={() => setDialog(null)}
        onDone={(r) => (setDialog(null), bulkDone(r))}
      />
      {dialog?.kind === 'bulk-kind' ? (
        <BulkKindDialog
          n={selected.size}
          kinds={MEDIA_KINDS_BY_OWNER[ownerType].filter((k) => k !== 'VIDEO')}
          onClose={() => setDialog(null)}
          onSubmit={(kind) => (setDialog(null), void runBulk({ action: 'kind', kind }))}
        />
      ) : null}
    </Surface>
  );

  async function runBulk(body: { action: 'kind' | 'illustration'; kind?: AdminMediaKind; isIllustration?: boolean }) {
    const r = await call.run(() => adminCall<MediaBulkResult>('/admin/media/bulk', { body: { ids: [...selected], ...body } }));
    if (r) bulkDone(r);
  }
  function bulkDone(r: MediaBulkResult) {
    setSelected(new Set());
    if (r.done) toast({ text: t('ui.admin-media.manager.toast.bulk', { n: r.done }) });
    if (r.refused.length) {
      const first = r.refused[0]!;
      const reason = hasMessage(`ui.admin-shell.reason.${first.reason}`) ? t(`ui.admin-shell.reason.${first.reason}` as MessageKey, first.params ?? {}) : first.reason;
      toast({ tone: 'error', text: t('ui.admin-media.manager.toast.bulkRefused', { n: r.refused.length, raison: reason }) });
    }
    changed();
  }
}

function EditDialog({ media, kinds, onClose, onDone }: { media: AdminMedia; kinds: AdminMediaKind[]; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ kind: media.kind as string, roomLabel: media.roomLabel ?? '', caption: media.caption ?? '', alt: media.alt ?? '', takenAt: media.takenAt ?? '', isIllustration: media.isIllustration });
  const { pending, failure, errors, run } = useCall();
  const family = (k: string) => (k === 'VIDEO' ? 'video' : media.mimeType === 'application/pdf' ? 'pdf' : k === 'PANO_360' ? 'pano' : 'image');
  const choices = kinds.filter((k) => family(k) === family(media.kind) || (media.mimeType === 'application/pdf' && (k === 'PLAN' || k === 'BROCHURE')));
  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { kind: v.kind, roomLabel: v.roomLabel || null, caption: v.caption || null, alt: v.alt || null, takenAt: v.takenAt || null, ...(IMAGE.has(v.kind) ? { isIllustration: v.isIllustration } : {}) };
    const ok = await run(() => adminCall(`/admin/media/${media.id}`, { method: 'PATCH', body }), t('ui.admin-media.manager.toast.saved'));
    if (ok !== null) onDone();
  }
  return (
    <Modal open onClose={onClose} title={t('ui.admin-media.manager.dialog.editTitle', { nom: media.fileName ?? kindLabel(media.kind) })} closeLabel={t('ui.common.close')} width={720}>
      <form className={f.form} onSubmit={submit} noValidate>
        <div className={s.editHead}>{media.thumb ? <img src={media.thumb.url} alt="" /> : null}</div>
        <FailureBanner failure={failure} />
        <div className={f.row}>
          <SelectInput label={t('ui.admin-media.manager.dialog.kind')} value={v.kind} onChange={(e) => setV((x) => ({ ...x, kind: e.target.value }))} error={errors.kind}>
            {choices.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </SelectInput>
          <SelectInput label={t('ui.admin-media.manager.dialog.room')} optional={v.kind !== 'PANO_360'} value={v.roomLabel} onChange={(e) => setV((x) => ({ ...x, roomLabel: e.target.value }))} error={errors.roomLabel} hint={v.kind === 'PANO_360' ? t('ui.admin-media.manager.dialog.roomRequired') : undefined}>
            <option value="">—</option>
            {MEDIA_ROOM_LABELS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </SelectInput>
          <TextInput label={t('ui.admin-media.manager.dialog.takenAt')} type="date" optional value={v.takenAt} onChange={(e) => setV((x) => ({ ...x, takenAt: e.target.value }))} error={errors.takenAt} />
        </div>
        <TextInput label={t('ui.admin-media.manager.dialog.caption')} optional value={v.caption} onChange={(e) => setV((x) => ({ ...x, caption: e.target.value }))} maxLength={300} error={errors.caption} />
        <TextArea label={t('ui.admin-media.manager.dialog.alt')} optional value={v.alt} onChange={(e) => setV((x) => ({ ...x, alt: e.target.value }))} maxLength={200} rows={2} error={errors.alt} hint={t('ui.admin-media.manager.dialog.altHint', { texte: media.altProposed })} />
        {IMAGE.has(v.kind) ? (
          <>
            <Checkbox label={t('ui.admin-media.manager.dialog.illustration')} checked={v.isIllustration} onChange={(isIllustration) => setV((x) => ({ ...x, isIllustration }))} />
            <p className={s.muted}>{t('ui.admin-media.manager.dialog.illustrationHint')}</p>
          </>
        ) : null}
        <DialogButtons close={onClose} pending={pending} label={t('ui.admin-media.manager.dialog.submit')} />
      </form>
    </Modal>
  );
}

function VideoDialog({ ownerType, ownerId, onClose, onDone }: { ownerType: string; ownerId: string; onClose: () => void; onDone: () => void }) {
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const { pending, failure, errors, run } = useCall();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => adminCall('/admin/media/videos', { body: { ownerType, ownerId, url, caption: caption || null } }), t('ui.admin-media.manager.toast.video'));
    if (ok !== null) onDone();
  }
  return (
    <Modal open onClose={onClose} title={t('ui.admin-media.manager.addVideo')} closeLabel={t('ui.common.close')} width={560}>
      <form className={f.form} onSubmit={submit} noValidate>
        <FailureBanner failure={failure} />
        <TextInput label={t('ui.admin-media.manager.videoUrl')} value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" error={errors.url} hint={t('ui.admin-media.manager.videoHint')} autoFocus />
        <TextInput label={t('ui.admin-media.manager.dialog.caption')} optional value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} error={errors.caption} />
        <DialogButtons close={onClose} pending={pending} label={t('ui.admin-media.manager.videoSubmit')} disabled={!url.trim()} />
      </form>
    </Modal>
  );
}

function BulkKindDialog({ n, kinds, onClose, onSubmit }: { n: number; kinds: AdminMediaKind[]; onClose: () => void; onSubmit: (kind: AdminMediaKind) => void }) {
  const [kind, setKind] = useState<AdminMediaKind>(kinds[0]!);
  return (
    <Modal open onClose={onClose} title={t('ui.admin-media.manager.dialog.kindTitle', { n })} closeLabel={t('ui.common.close')}>
      <form
        className={f.form}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(kind);
        }}
      >
        <SelectInput label={t('ui.admin-media.manager.dialog.kind')} value={kind} onChange={(e) => setKind(e.target.value as AdminMediaKind)}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {kindLabel(k)}
            </option>
          ))}
        </SelectInput>
        <DialogButtons close={onClose} pending={false} label={t('ui.admin-media.manager.dialog.kindSubmit')} />
      </form>
    </Modal>
  );
}

