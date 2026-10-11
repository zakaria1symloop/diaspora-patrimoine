'use client';
// DOS-005, MED-030, MED-031 — « Voir »: the files of the current version (and of a renewal waiting for its check), shown
// in the page. Each opening asks the API for a signed address of 5 minutes (traced), opened at once, never kept:
// `inline` for the viewer (the browser's PDF reader, with Range requests), `attachment` for « Télécharger ».
import { useEffect, useState } from 'react';
import type { ClientDocumentFile, SignedFileUrl } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import s from './documents.module.css';

export function FileViewer({ reference, documentId, files, label }: { reference: string; documentId: string; files: ClientDocumentFile[]; label: string }) {
  const readable = files.filter((f) => f.readable);
  const [index, setIndex] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const file = readable[index];
  const base = `/client/dossiers/${encodeURIComponent(reference)}/documents/${documentId}/files`;

  useEffect(() => {
    if (!file) return;
    let alive = true;
    setUrl(null);
    setError(false);
    void apiCall<SignedFileUrl>(`${base}/${file.id}?disposition=inline`, { retryOnAuth: true }).then((r) => {
      if (!alive) return;
      if (r.ok) setUrl(r.data.url);
      else setError(true);
    });
    return () => {
      alive = false;
    };
  }, [base, file]);

  const download = async () => {
    if (!file) return;
    const r = await apiCall<SignedFileUrl>(`${base}/${file.id}?disposition=attachment`, { retryOnAuth: true });
    if (r.ok) window.location.assign(r.data.url);
    else setError(true);
  };

  if (!file) return <p className={s.hint}>{t('ui.documents.viewer.error')}</p>;
  return (
    <div className={s.viewer}>
      <div className={s.viewerBar}>
        {readable.length > 1 ? (
          <div className={s.viewerNav}>
            <button type="button" className={s.iconButton} onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} aria-label={t('ui.documents.viewer.previous')}>
              <Icon name="chevron-left" size={20} />
            </button>
            <span>{t('ui.documents.viewer.file', { i: index + 1, n: readable.length })}</span>
            <button type="button" className={s.iconButton} onClick={() => setIndex((i) => Math.min(readable.length - 1, i + 1))} disabled={index === readable.length - 1} aria-label={t('ui.documents.viewer.next')}>
              <Icon name="chevron-right" size={20} />
            </button>
          </div>
        ) : (
          <span className={s.viewerName}>{file.fileName}</span>
        )}
        <Button variant="secondary" size="S" icon="download" onClick={() => void download()}>
          {t('ui.documents.viewer.download')}
        </Button>
      </div>
      {error ? (
        <p className={s.formError} role="alert">
          <Icon name="status-error" size={16} />
          {t('ui.documents.viewer.error')}
        </p>
      ) : url ? (
        file.mimeType === 'application/pdf' ? (
          <iframe className={s.viewerFrame} src={url} title={`${label} — ${file.fileName}`} />
        ) : (
          <img className={s.viewerImage} src={url} alt={`${label} — ${file.fileName}`} />
        )
      ) : (
        <p className={s.viewerLoading} role="status">
          <Icon name="spinner" size={20} />
          {t('ui.documents.viewer.loading')}
        </p>
      )}
    </div>
  );
}
