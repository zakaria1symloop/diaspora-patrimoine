'use client';
// COM-020 « Pièces jointes » and COM-030 « fichiers éventuels » — files from the computer (never a file of a dossier,
// NOT-008), MED-010: PDF, JPG, PNG, DOCX, XLSX; 10 MB in all; five at most. Each file goes through API-080 as soon as it
// is chosen (announce → send with its progress → check: real type, antivirus — MED-011, MED-021) and shows its own line:
// its name and size, its progress, then « Prêt », or the reason it was refused with « Retirer ». The window sends only
// the files that are ready; `onBusy` holds its button while one is still on its way.
import { useEffect, useRef, useState } from 'react';
import { EMAIL_ATTACHMENT_FORMATS, EMAIL_ATTACHMENTS_MAX, EMAIL_ATTACHMENTS_MAX_BYTES, type EmailAttachment } from '@dp/contracts';
import { Button, Icon, sha256Hex } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import s from './exchanges.module.css';

type Line = { key: string; name: string; size: number; progress: number | null; ready: EmailAttachment | null; error: string | null };

const ACCEPT = EMAIL_ATTACHMENT_FORMATS.map((f) => (f === 'jpg' ? '.jpg,.jpeg' : `.${f}`)).join(',');
const MAX_MB = Math.round(EMAIL_ATTACHMENTS_MAX_BYTES / 1_000_000);
const sizeLabel = (bytes: number) => (bytes >= 1_000_000 ? t('ui.admin-exchanges.files.mb', { n: (bytes / 1_000_000).toFixed(1).replace('.', ',') }) : t('ui.admin-exchanges.files.kb', { n: Math.max(1, Math.round(bytes / 1000)) }));
const formatOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]?.replace('jpeg', 'jpg') ?? '';

export function AttachmentPicker({ base, onChange, onBusy }: { base: 'emails' | 'communications'; onChange: (files: EmailAttachment[]) => void; onBusy: (busy: boolean) => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    onChange(lines.flatMap((l) => (l.ready ? [l.ready] : [])));
    onBusy(lines.some((l) => l.progress !== null));
  }, [lines, onChange, onBusy]);

  const patch = (key: string, next: Partial<Line>) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...next } : l)));

  async function upload(key: string, file: File) {
    const sha256 = await sha256Hex(await file.arrayBuffer());
    const announced = await adminCall<{ id: string; uploadUrl: string }>(`/admin/${base}/uploads`, { body: { fileName: file.name, contentType: file.type || 'application/octet-stream', size: file.size, sha256 } });
    if (!announced.ok) return patch(key, { progress: null, error: errorText(announced) });
    const sent = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', announced.data.uploadUrl);
      xhr.withCredentials = true;
      xhr.setRequestHeader('content-type', 'application/octet-stream');
      xhr.setRequestHeader('X-CSRF-Token', document.cookie.match(/(?:^|; )dp_admin_csrf=([^;]*)/)?.[1] ?? '');
      xhr.upload.onprogress = (ev) => ev.lengthComputable && patch(key, { progress: Math.round((ev.loaded / ev.total) * 100) });
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(file);
    });
    if (!sent) return patch(key, { progress: null, error: errorText({ status: 0, offline: true }) });
    const checked = await adminCall<EmailAttachment>(`/admin/${base}/uploads/${announced.data.id}/complete`, { method: 'POST' });
    if (!checked.ok) return patch(key, { progress: null, error: errorText(checked) });
    patch(key, { progress: null, ready: checked.data });
  }

  function choose(files: FileList | null) {
    if (!files?.length) return;
    const kept = lines.filter((l) => !l.error);
    let total = kept.reduce((sum, l) => sum + l.size, 0);
    const added: Line[] = [];
    for (const file of Array.from(files)) {
      const key = `f${++seq.current}`;
      let error: string | null = null;
      if (kept.length + added.filter((l) => !l.error).length >= EMAIL_ATTACHMENTS_MAX) error = t('ui.admin-exchanges.files.tooMany', { n: EMAIL_ATTACHMENTS_MAX });
      else if (!(EMAIL_ATTACHMENT_FORMATS as readonly string[]).includes(formatOf(file.name))) error = t('ui.admin-exchanges.files.format');
      else if (total + file.size > EMAIL_ATTACHMENTS_MAX_BYTES) error = t('ui.admin-exchanges.files.tooBig', { n: MAX_MB });
      if (!error) total += file.size;
      added.push({ key, name: file.name, size: file.size, progress: error ? null : 0, ready: null, error });
      if (!error) void upload(key, file);
    }
    setLines([...lines, ...added]);
    if (input.current) input.current.value = '';
  }

  const full = lines.filter((l) => !l.error).length >= EMAIL_ATTACHMENTS_MAX;
  return (
    <div className={s.files}>
      <div className={s.filesHead}>
        <span className={s.filesLabel}>{t('ui.admin-exchanges.files.label')}</span>
        <span className={s.filesHint}>{t('ui.admin-exchanges.files.hint', { n: EMAIL_ATTACHMENTS_MAX, mb: MAX_MB })}</span>
      </div>
      {lines.length ? (
        <ul className={s.fileList}>
          {lines.map((l) => (
            <li key={l.key} className={[s.file, l.error && s.fileError].filter(Boolean).join(' ')} data-file={l.error ? 'error' : l.ready ? 'ready' : 'uploading'}>
              <Icon name={l.error ? 'warning' : l.ready ? 'check' : 'paperclip'} size={16} />
              <span className={s.fileName}>{l.name}</span>
              <span className={s.fileMeta}>{l.error ?? (l.ready ? t('ui.admin-exchanges.files.ready', { taille: sizeLabel(l.size) }) : t('ui.admin-exchanges.files.progress', { n: l.progress ?? 0 }))}</span>
              {l.progress === null ? (
                <Button variant="tertiary" size="S" onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))} aria-label={t('ui.admin-exchanges.files.removeNamed', { nom: l.name })}>
                  {t('ui.admin-exchanges.files.remove')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!full ? (
        <label className={s.fileAdd}>
          <input ref={input} type="file" multiple accept={ACCEPT} onChange={(e) => choose(e.target.files)} className={s.fileInput} />
          <Icon name="plus" size={16} />
          {t('ui.admin-exchanges.files.add')}
        </label>
      ) : null}
    </div>
  );
}
