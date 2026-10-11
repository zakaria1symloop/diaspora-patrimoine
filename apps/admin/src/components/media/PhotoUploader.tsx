'use client';
// CTL-145 — « photos » of a point of progress: a button that sends one or several photos through API-080 (ownerType
// PROGRAM_UPDATE) and says how far it is.
import { useRef, useState } from 'react';
import { Icon, useToast } from '@dp/ui';
import { errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { uploadMedia } from './upload';
import s from './media.module.css';

export function PhotoUploader({ ownerType, ownerId, label, onDone }: { ownerType: 'PROGRAM_UPDATE'; ownerId: string; label: string; onDone: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<number | null>(null);
  async function send(files: FileList) {
    const list = [...files].slice(0, 100);
    setBusy(list.length);
    let ok = 0;
    for (const file of list) {
      const r = await uploadMedia(file, { ownerType, ownerId, kind: 'PHOTO' }, () => undefined);
      if (r.ok) ok++;
      else toast({ tone: 'error', text: t('ui.admin-media.manager.uploadFailed', { nom: file.name, raison: errorText(r) }) });
    }
    setBusy(null);
    if (ok) toast({ text: t('ui.admin-media.manager.toast.uploaded', { n: ok }) });
    onDone();
  }
  return (
    <>
      <button type="button" className={s.addPhoto} onClick={() => input.current?.click()} disabled={busy !== null} aria-busy={busy !== null}>
        <Icon name={busy !== null ? 'spinner' : 'camera'} size={20} />
        <span>{busy !== null ? t('ui.admin-media.photos.uploading', { n: busy }) : label}</span>
      </button>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files?.length && void send(e.target.files).then(() => (e.target.value = ''))} />
    </>
  );
}
