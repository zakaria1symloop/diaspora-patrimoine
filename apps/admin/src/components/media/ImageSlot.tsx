'use client';
// One image of a record that is not a gallery: the logo or the cover of a promoter, the logo of an « autre
// partenaire » (CTL-003 « Page publique », CTL-170). Uploads through API-080 (`/admin/media/uploads`), shows the
// progress then the image, lets the user replace or remove it; the new image replaces the previous one once READY.
import { useRef, useState } from 'react';
import type { AdminImageRef } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { ConfirmDialog } from '../catalogue/parts';
import { uploadMedia } from './upload';
import s from './media.module.css';

export interface ImageSlotProps {
  ownerType: 'PROMOTER' | 'PARTNER';
  ownerId: string;
  /** `LOGO` (PNG, SVG, WebP — 2 Mo) or `PHOTO` (the cover). */
  kind: 'LOGO' | 'PHOTO';
  label: string;
  hint?: string;
  /** The image in place, as the record's API gave it. */
  image: AdminImageRef | null;
  canWrite: boolean;
  /** Called once the new image is READY and attached to its owner (or removed): the record reloads. */
  onChanged: () => void;
}

export function ImageSlot({ ownerType, ownerId, kind, label, hint, image, canWrite, onChanged }: ImageSlotProps) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  async function send(file: File) {
    setError(null);
    setProgress(0);
    const r = await uploadMedia(file, { ownerType, ownerId, kind }, setProgress);
    setProgress(null);
    if (r.ok) onChanged();
    else setError(errorText(r));
  }
  return (
    <div className={s.slot}>
      <div className={`${s.slotVisual} ${kind === 'LOGO' ? s.slotLogo : s.slotCover}`}>
        {progress !== null ? (
          <>
            <Icon name="spinner" size={24} />
            <span className={s.progress}>
              <span style={{ width: `${progress}%` }} />
            </span>
          </>
        ) : image ? (
          <img src={image.url} alt={image.alt ?? label} />
        ) : (
          <Icon name={kind === 'LOGO' ? 'badge' : 'camera'} size={32} />
        )}
      </div>
      <div className={s.slotText}>
        <strong>{label}</strong>
        <span className={s.hint}>{progress !== null ? (progress < 100 ? t('ui.admin-media.slot.uploading', { p: progress }) : t('ui.admin-media.slot.processing')) : (hint ?? (kind === 'LOGO' ? t('ui.admin-media.manager.limitsLogo') : ''))}</span>
        {error ? <span className={s.error}>{error}</span> : null}
        {canWrite ? (
          <span className={s.slotActions}>
            <Button variant="secondary" size="S" icon="upload" onClick={() => input.current?.click()} pending={progress !== null}>
              {image ? t('ui.admin-media.slot.replace') : t('ui.admin-media.slot.choose')}
            </Button>
            {image ? (
              <Button variant="tertiary" size="S" icon="trash" onClick={() => setRemoving(true)}>
                {t('ui.admin-media.slot.remove')}
              </Button>
            ) : null}
          </span>
        ) : null}
      </div>
      <input ref={input} type="file" hidden accept={kind === 'LOGO' ? 'image/png,image/svg+xml,image/webp' : 'image/jpeg,image/png,image/webp,image/heic'} onChange={(e) => e.target.files?.[0] && void send(e.target.files[0]).then(() => (e.target.value = ''))} />
      <ConfirmDialog
        open={removing}
        title={t('ui.admin-media.slot.removeTitle', { nom: label })}
        text={t('ui.admin-media.slot.removeText')}
        submit={t('ui.admin-media.slot.remove')}
        danger
        call={() => adminCall(`/admin/media/${image!.id}`, { method: 'DELETE' })}
        onClose={() => setRemoving(false)}
        onDone={() => (setRemoving(false), onChanged())}
      />
    </div>
  );
}
