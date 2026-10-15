'use client';
// FIC-055, DEM-018 — « Signaler une erreur sur cette fiche »: a window — « Qu'est-ce qui est inexact ? » (six choices,
// required), « Précisez » (10 to 1 000 characters, required), « Votre e-mail, si vous souhaitez une réponse » (optional).
// Sent to `POST /public/listing-reports`; no client record. Thanks in place: « Merci. Nous vérifions cette fiche. »
import { useState, type FormEvent } from 'react';
import { LISTING_ERROR_KINDS, listingReportSchema } from '@dp/contracts';
import { Button, Modal } from '@dp/ui';
import { checkSchema, errorMessage, fieldErrors, Banner } from '@/components/auth/kit';
import { SelectField, TextArea, TextField } from '@/components/forms/fields';
import { usePublicForm } from '@/lib/public-form';
import { t } from '@/lib/i18n';
import s from './property.module.css';

export function ReportListing({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('');
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const { submit } = usePublicForm('LISTING_REPORT', { token: false });

  const close = () => {
    setOpen(false);
    setTimeout(() => {
      setDone(false);
      setKind('');
      setComment('');
      setEmail('');
      setErrors({});
      setFailure(null);
    }, 200);
  };

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = { propertyId, kind, comment, email };
    const checked = checkSchema(listingReportSchema, body);
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    setFailure(null);
    setPending(true);
    const r = await submit('/api/v1/public/listing-reports', body);
    setPending(false);
    if (r.ok) return setDone(true);
    const fields = fieldErrors(r.error);
    if (Object.keys(fields).length) return setErrors(fields);
    setFailure(errorMessage(r.error, { offline: r.offline, status: r.status }));
  }

  return (
    <>
      <button type="button" className={s.reportLink} onClick={() => setOpen(true)}>
        {t('ui.property.footer.report')}
      </button>
      <Modal open={open} onClose={close} title={t('ui.property.report.title')} closeLabel={t('ui.common.close')} width={560}>
        {done ? (
          <div className={s.reportDone}>
            <p role="status">{t('ui.property.report.thanks')}</p>
            <Button variant="primary" size="M" onClick={close}>
              {t('ui.common.close')}
            </Button>
          </div>
        ) : (
          <form className={s.reportForm} onSubmit={send} noValidate>
            {failure ? <Banner tone="error">{failure}</Banner> : null}
            <SelectField id="report-kind" label={t('ui.property.report.kind')} value={kind} onChange={(e) => setKind(e.target.value)} error={errors.kind}>
              <option value="" disabled>
                {t('ui.property.report.choose')}
              </option>
              {LISTING_ERROR_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`ui.enum.ListingErrorKind.${k}`)}
                </option>
              ))}
            </SelectField>
            <TextArea id="report-comment" label={t('ui.property.report.comment')} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} counter rows={4} error={errors.comment} />
            <TextField id="report-email" label={t('ui.property.report.email')} optional type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
            <div className={s.reportActions}>
              <Button type="button" variant="secondary" size="M" onClick={close}>
                {t('ui.common.cancel')}
              </Button>
              <Button type="submit" variant="primary" size="M" pending={pending}>
                {t('ui.property.report.submit')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
