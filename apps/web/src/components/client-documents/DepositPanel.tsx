'use client';
// EC-21 — « Déposer » (DOS-010 … DOS-014): three ways to add files (choose several, drag and drop on a computer, take
// photos on a phone — up to 30), the advice line, « Vos {n} photos seront réunies en un seul document. » before sending.
// Each file is checked in the browser (format, size, empty), fingerprinted (SHA-256), announced, sent with its own
// progress bar and confirmed as soon as it is chosen (API-080), without touching the piece; « Envoyer {n} fichiers »
// creates the version in the order shown (API-081). A failed file has « Réessayer », the others are kept; leaving
// during a send asks first. « Modifier » offers the three gestes of DOS-014; a renewal is « Tout remplacer » only.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { DEPOSIT_MAX_IMAGES, type ClientDocument, type CompletedUpload, type AnnounceUploadResponse, type VersionMode } from '@dp/contracts';
import { Button, Icon, Celebration } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { newIdempotencyKey } from '@/lib/public-call';
import { t } from '@/lib/i18n';
import { CheckboxField } from '@/components/forms/fields';
import { sizeLabel } from '@/components/client-tools/format';
import s from './documents.module.css';
import { sha256Hex as sha256OfBytes } from '@dp/ui';

export type DepositIntent = 'DEPOSIT' | 'EDIT' | 'RENEW';

interface Pending {
  key: string;
  file: File;
  isImage: boolean;
  preview: string | null;
  state: 'hashing' | 'sending' | 'checking' | 'ready' | 'failed' | 'invalid';
  progress: number;
  uploadId: string | null;
  error: string | null;
}

const MIME_OF_EXT: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heic' };

function readCookie(name: string): string {
  for (const part of document.cookie.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

/** The browser's type, or one deduced from the extension (HEIC is often announced empty). */
function typeOf(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const declared = file.type.toLowerCase();
  if (declared === 'image/jpg') return 'image/jpeg';
  if (declared === 'image/heif') return 'image/heic';
  return declared || MIME_OF_EXT[ext] || 'application/octet-stream';
}

async function sha256(file: File): Promise<string> {
  return sha256OfBytes(await file.arrayBuffer());
}

function errorOf(code: string | undefined, reason: string | null | undefined, params: Record<string, unknown> | null | undefined, doc: ClientDocument, maxMb: number): string {
  if (code === 'FILE_TOO_LARGE') return t('ui.documents.deposit.errors.size', { mo: maxMb });
  if (code === 'UNSUPPORTED_FILE_TYPE') return t('ui.documents.deposit.errors.format', { liste: doc.acceptedFormats.map((f) => f.toUpperCase()).join(', ') });
  if (reason === 'TOO_MANY_FILES') return t('ui.documents.deposit.errors.count', { n: Number(params?.n ?? doc.maxFiles) });
  if (reason === 'TOO_MANY_IMAGES') return t('ui.documents.deposit.errors.images');
  if (reason && ['DOCUMENT_SCANNING', 'DOCUMENT_LOCKED', 'UPLOAD_NOT_RECEIVED', 'PARTY_RESTRICTED'].includes(reason)) return t(`ui.error.reason.${reason}` as never, params as never);
  return t('ui.documents.deposit.errors.generic');
}

export function DepositPanel({
  reference,
  doc,
  intent,
  maxFileSizeMb,
  partyConsent,
  onDone,
  onBusy,
  first,
}: {
  reference: string;
  doc: ClientDocument;
  intent: DepositIntent;
  maxFileSizeMb: number;
  /** DOS-032 — the first deposit for another person asks the authorisation once. */
  partyConsent: { partyId: string; firstName: string } | null;
  onDone: (doc: ClientDocument) => void;
  onBusy: (busy: boolean) => void;
  /** DSN-073 — the first piece the client deposits on this dossier is a moment that counts. */
  first?: boolean;
}) {
  const uid = useId();
  const current = intent === 'EDIT' ? (doc.current?.files ?? []) : [];
  const [mode, setMode] = useState<VersionMode>(intent === 'EDIT' ? 'ADD' : 'REPLACE_ALL');
  const [kept, setKept] = useState<string[]>(current.map((f) => f.id));
  const [items, setItems] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const chooser = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const key = useRef('');
  const allowed = useMemo(() => new Set(doc.acceptedFormats.flatMap((f) => (f === 'jpg' ? ['image/jpeg'] : f === 'heic' ? ['image/heic'] : [MIME_OF_EXT[f] ?? '']))), [doc.acceptedFormats]);
  const base = `/client/dossiers/${encodeURIComponent(reference)}/documents/${doc.id}`;

  const busy = items.some((i) => i.state === 'hashing' || i.state === 'sending' || i.state === 'checking') || sending;
  useEffect(() => onBusy(busy), [busy, onBusy]);
  // DOS-012 — « Un envoi est en cours. Quitter quand même ? »
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = t('ui.documents.deposit.leaveWarning');
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);
  useEffect(() => () => items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (k: string, p: Partial<Pending>) => setItems((list) => list.map((i) => (i.key === k ? { ...i, ...p } : i)));

  /** API-080, one file: fingerprint, announce, send (progress), confirm. */
  const upload = useCallback(
    async (item: Pending) => {
      patch(item.key, { state: 'hashing', error: null, progress: 0 });
      try {
        const hash = await sha256(item.file);
        const announce = await apiCall<AnnounceUploadResponse>(`${base}/uploads`, {
          body: { files: [{ fileName: item.file.name.slice(0, 255) || 'document', contentType: typeOf(item.file), size: item.file.size, sha256: hash }], isRenewal: intent === 'RENEW' },
          retryOnAuth: true,
        });
        if (!announce.ok) return patch(item.key, { state: announce.status === 413 || announce.status === 415 ? 'invalid' : 'failed', error: errorOf(announce.error?.code, announce.error?.reason, announce.error?.params, doc, maxFileSizeMb) });
        const u = announce.data.uploads[0]!;
        patch(item.key, { state: 'sending' });
        const sent = await new Promise<boolean>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', u.uploadUrl);
          xhr.setRequestHeader('Content-Type', 'application/octet-stream');
          xhr.setRequestHeader('X-CSRF-Token', readCookie('dp_web_csrf') || readCookie('__Host-dp_web_csrf'));
          xhr.upload.onprogress = (e) => e.lengthComputable && patch(item.key, { progress: Math.round((e.loaded / e.total) * 100) });
          xhr.onload = () => resolve(xhr.status === 204);
          xhr.onerror = () => resolve(false);
          xhr.send(item.file);
        });
        if (!sent) return patch(item.key, { state: 'failed', error: t('ui.documents.deposit.errors.network') });
        patch(item.key, { state: 'checking', progress: 100 });
        const done = await apiCall<CompletedUpload>(`${base}/uploads/${u.id}/complete`, { body: {}, retryOnAuth: true });
        if (!done.ok) {
          const field = done.error?.details?.find((d) => d.field === 'file')?.code;
          const msg = field ? t(`ui.validation.${field}` as never) : errorOf(done.error?.code, done.error?.reason, done.error?.params, doc, maxFileSizeMb);
          return patch(item.key, { state: field || done.status === 415 ? 'invalid' : 'failed', error: msg });
        }
        patch(item.key, { state: 'ready', uploadId: u.id });
      } catch {
        patch(item.key, { state: 'failed', error: t('ui.documents.deposit.errors.network') });
      }
    },
    [base, doc, intent, maxFileSizeMb],
  );

  /** DOS-011 — checks in the browser first; a refused file does not stop the others. */
  const add = (files: FileList | File[]) => {
    setError(null);
    const list = [...files];
    const imagesNow = items.filter((i) => i.isImage && i.state !== 'invalid').length;
    const next: Pending[] = [];
    for (const [n, file] of list.entries()) {
      const type = typeOf(file);
      const isImage = type.startsWith('image/');
      let invalid: string | null = null;
      if (!allowed.has(type)) invalid = t('ui.documents.deposit.errors.format', { liste: doc.acceptedFormats.map((f) => f.toUpperCase()).join(', ') });
      else if (file.size === 0) invalid = t('ui.documents.deposit.errors.empty');
      else if (file.size > maxFileSizeMb * 1024 * 1024) invalid = t('ui.documents.deposit.errors.size', { mo: maxFileSizeMb });
      else if (isImage && imagesNow + next.filter((x) => x.isImage).length >= DEPOSIT_MAX_IMAGES) invalid = t('ui.documents.deposit.errors.images');
      next.push({
        key: `${Date.now()}-${n}-${file.name}`,
        file,
        isImage,
        preview: isImage && !invalid && type !== 'image/heic' ? URL.createObjectURL(file) : null,
        state: invalid ? 'invalid' : 'hashing',
        progress: 0,
        uploadId: null,
        error: invalid,
      });
    }
    setItems((l) => [...l, ...next]);
    for (const item of next) if (item.state !== 'invalid') void upload(item);
  };

  const move = (k: string, dir: -1 | 1) =>
    setItems((list) => {
      const i = list.findIndex((x) => x.key === k);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });
  const drop = (k: string) =>
    setItems((list) => {
      const it = list.find((x) => x.key === k);
      if (it?.preview) URL.revokeObjectURL(it.preview);
      return list.filter((x) => x.key !== k);
    });

  const ready = items.filter((i) => i.state === 'ready');
  const readyImages = ready.filter((i) => i.isImage).length;
  const keptIds = mode === 'REPLACE_ALL' ? [] : kept;
  const fileCount = keptIds.length + ready.filter((i) => !i.isImage).length + (readyImages ? 1 : 0);
  const tooMany = fileCount > doc.maxFiles;
  const canSubmit =
    !busy &&
    !tooMany &&
    (mode === 'REMOVE' ? keptIds.length >= 1 && keptIds.length < current.length : ready.length > 0) &&
    !items.some((i) => i.state === 'failed');

  const submit = async () => {
    setError(null);
    if (partyConsent && !consent) return setConsentError(t('ui.documents.consent.required'));
    setSending(true);
    if (partyConsent) {
      const r = await apiCall(`/client/dossiers/${encodeURIComponent(reference)}/parties/${partyConsent.partyId}/authorization`, { body: { accepted: true }, retryOnAuth: true });
      if (!r.ok) {
        setSending(false);
        return setError(t('ui.documents.deposit.errors.generic'));
      }
    }
    if (!key.current) key.current = newIdempotencyKey();
    const r = await apiCall<ClientDocument>(`${base}/versions`, {
      body: { mode, keptFileIds: keptIds, uploadIds: mode === 'REMOVE' ? [] : ready.map((i) => i.uploadId!), isRenewal: intent === 'RENEW' },
      extraHeaders: { 'Idempotency-Key': key.current },
      retryOnAuth: true,
    });
    setSending(false);
    if (!r.ok) {
      if (r.status > 0 && r.status < 500) key.current = '';
      return setError(errorOf(r.error?.code, r.error?.reason, r.error?.params, doc, maxFileSizeMb));
    }
    setDone(true);
    onDone(r.data);
  };

  if (done) {
    return (
      <div className={s.doneBox} role="status">
        {first ? (
          <Celebration moment="first_document" objectId={reference} />
        ) : (
          <span className={s.doneIcon} aria-hidden="true">
            <Icon name="status-success" size={32} />
          </span>
        )}
        {first ? <p className={s.doneTitle}>{t('ui.documents.deposit.doneFirst')}</p> : null}
        <p>{t('ui.documents.deposit.done')}</p>
      </div>
    );
  }

  const showAdd = mode !== 'REMOVE';
  return (
    <div className={s.panel}>
      {doc.description ? <p className={s.panelHelp}>{doc.description}</p> : null}
      <p className={s.tip}>
        <Icon name="bulb" size={20} />
        {t('ui.documents.deposit.tip')}
      </p>

      {intent === 'EDIT' ? (
        <fieldset className={s.modes}>
          <legend className="visually-hidden">{t('ui.documents.action.edit')}</legend>
          {(['ADD', 'REMOVE', 'REPLACE_ALL'] as const).map((m) => (
            <label key={m} className={[s.mode, mode === m && s.modeOn].filter(Boolean).join(' ')}>
              <input type="radio" name={`${uid}-mode`} checked={mode === m} onChange={() => setMode(m)} disabled={m === 'REMOVE' && current.length < 2} />
              {t(m === 'ADD' ? 'ui.documents.deposit.modeAdd' : m === 'REMOVE' ? 'ui.documents.deposit.modeRemove' : 'ui.documents.deposit.modeReplace')}
            </label>
          ))}
        </fieldset>
      ) : null}

      {intent === 'EDIT' && mode !== 'REPLACE_ALL' ? (
        <div className={s.currentFiles}>
          <p className={s.subhead}>{t('ui.documents.deposit.current')}</p>
          <ul className={s.fileList}>
            {current.map((f) => {
              const on = kept.includes(f.id);
              return (
                <li key={f.id} className={[s.fileRow, !on && s.fileRowOff].filter(Boolean).join(' ')}>
                  <Icon name="file" size={20} />
                  <span className={s.fileName}>{f.fileName}</span>
                  {mode === 'REMOVE' ? (
                    <Button
                      variant="tertiary"
                      size="S"
                      onClick={() => setKept((k) => (on ? k.filter((x) => x !== f.id) : [...k, f.id]))}
                      disabled={on && kept.length <= 1}
                    >
                      {on ? t('ui.documents.deposit.removeCurrent') : t('ui.documents.deposit.keep')}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {mode === 'REMOVE' && kept.length <= 1 ? <p className={s.hint}>{t('ui.documents.deposit.lastCannotGo')}</p> : null}
        </div>
      ) : null}

      {showAdd ? (
        <>
          <div
            className={[s.dropzone, dragOver && s.dropzoneOn].filter(Boolean).join(' ')}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length) add(e.dataTransfer.files);
            }}
          >
            <div className={s.dropButtons}>
              <Button variant="tool" size="M" icon="upload" onClick={() => chooser.current?.click()}>
                {t('ui.documents.deposit.choose')}
              </Button>
              <Button variant="secondary" size="M" icon="camera" onClick={() => camera.current?.click()} className={s.cameraButton}>
                {t('ui.documents.deposit.photo')}
              </Button>
            </div>
            <p className={s.dropText}>{t('ui.documents.deposit.drop')}</p>
            <p className={s.hint}>
              {t('ui.documents.deposit.formats', { liste: doc.acceptedFormats.map((f) => f.toUpperCase()).join(', '), mo: maxFileSizeMb, n: doc.maxFiles })}
            </p>
            <input
              ref={chooser}
              type="file"
              multiple
              accept={doc.acceptedFormats.map((f) => `.${f}`).join(',')}
              className="visually-hidden"
              tabIndex={-1}
              aria-label={t('ui.documents.deposit.choose')}
              onChange={(e) => {
                if (e.target.files?.length) add(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={camera}
              type="file"
              accept="image/*"
              capture="environment"
              className="visually-hidden"
              tabIndex={-1}
              aria-label={t('ui.documents.deposit.photo')}
              onChange={(e) => {
                if (e.target.files?.length) add(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {items.length ? (
            <div>
              <p className={s.subhead}>{t('ui.documents.deposit.newFiles')}</p>
              <ol className={s.fileList}>
                {items.map((i, n) => (
                  <li key={i.key} className={[s.fileRow, i.state === 'invalid' || i.state === 'failed' ? s.fileRowError : ''].join(' ')}>
                    {i.preview ? <img src={i.preview} alt="" className={s.thumb} /> : <Icon name="file" size={20} />}
                    <span className={s.fileMain}>
                      <span className={s.fileName}>{i.file.name}</span>
                      <span className={s.fileMeta}>
                        {sizeLabel(i.file.size)} ·{' '}
                        {i.state === 'sending'
                          ? t('ui.documents.deposit.sending', { pct: i.progress })
                          : i.state === 'hashing' || i.state === 'checking'
                            ? t('ui.documents.deposit.checking')
                            : i.state === 'ready'
                              ? t('ui.documents.deposit.ready')
                              : t('ui.documents.deposit.failed')}
                      </span>
                      {i.state === 'sending' || i.state === 'checking' ? (
                        <span className={s.progress} role="progressbar" aria-valuenow={i.progress} aria-valuemin={0} aria-valuemax={100} aria-label={i.file.name}>
                          <span style={{ width: `${i.progress}%` }} />
                        </span>
                      ) : null}
                      {i.error ? (
                        <span className={s.fileError} role="alert">
                          <Icon name="status-error" size={16} />
                          {i.error}
                        </span>
                      ) : null}
                    </span>
                    <span className={s.fileTools}>
                      {i.state === 'failed' ? (
                        <Button variant="tertiary" size="S" onClick={() => void upload(i)}>
                          {t('ui.documents.deposit.retry')}
                        </Button>
                      ) : null}
                      <button type="button" className={s.iconButton} onClick={() => move(i.key, -1)} disabled={n === 0} aria-label={`${t('ui.documents.deposit.moveUp')} : ${i.file.name}`}>
                        <Icon name="chevron-up" size={20} />
                      </button>
                      <button type="button" className={s.iconButton} onClick={() => move(i.key, 1)} disabled={n === items.length - 1} aria-label={`${t('ui.documents.deposit.moveDown')} : ${i.file.name}`}>
                        <Icon name="chevron-down" size={20} />
                      </button>
                      <button type="button" className={s.iconButton} onClick={() => drop(i.key)} aria-label={`${t('ui.documents.deposit.remove')} : ${i.file.name}`}>
                        <Icon name="trash" size={20} />
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
              {readyImages > 1 ? (
                <p className={s.joined}>
                  <Icon name="info" size={20} />
                  {t('ui.documents.deposit.joined', { n: readyImages })}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {tooMany ? (
        <p className={s.formError} role="alert">
          <Icon name="status-error" size={16} />
          {t('ui.documents.deposit.errors.count', { n: doc.maxFiles })}
        </p>
      ) : null}

      {partyConsent ? (
        <CheckboxField
          id={`${uid}-party`}
          checked={consent}
          onChange={(v) => {
            setConsent(v);
            setConsentError(null);
          }}
          error={consentError}
          label={t('ui.documents.deposit.partyConsent', { prenom: partyConsent.firstName })}
        />
      ) : null}

      {error ? (
        <p className={s.formError} role="alert">
          <Icon name="status-error" size={16} />
          {error}
        </p>
      ) : null}

      <div className={s.panelActions}>
        <Button variant="tool" size="L" onClick={() => void submit()} disabled={!canSubmit} pending={sending}>
          {mode === 'REMOVE' ? t('ui.documents.deposit.submitRemove') : t('ui.documents.deposit.submit', { n: fileCount || ready.length })}
        </Button>
      </div>
    </div>
  );
}
