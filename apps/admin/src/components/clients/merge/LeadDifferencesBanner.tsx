'use client';
// CRM-045, MOD-300 — « Informations différentes dans la dernière demande » and « Mettre à jour la fiche »: the value of the
// record and the value of the request side by side, field by field, and the choice of what to take from the request.
// Renders nothing when the last request says nothing different.
import { useCallback, useEffect, useState } from 'react';
import type { LeadDifferences } from '@dp/contracts';
import type { MessageKey } from '@dp/i18n';
import { Banner, Button, Modal, useToast } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { useShell } from '../../shell/ShellContext';
import { countryName } from '../client-parts';
import s from './merge.module.css';

export interface LeadDifferencesBannerProps {
  clientId: string;
  clientName: string | null;
  /** Called after the record was updated from the request. */
  onChanged?: () => void;
}

const show = (key: string, v: string | null) => (v && key === 'countryOfResidence' ? countryName(v) : (v ?? '—'));

export function LeadDifferencesBanner({ clientId, onChanged }: LeadDifferencesBannerProps) {
  const { can } = useShell();
  const toast = useToast();
  const [data, setData] = useState<LeadDifferences | null>(null);
  const [open, setOpen] = useState(false);
  const [take, setTake] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const load = useCallback(() => {
    void adminCall<LeadDifferences>(`/admin/clients/${clientId}/lead-differences`).then((r) => {
      if (r.ok) setData(r.data);
    });
  }, [clientId]);
  useEffect(() => load(), [load]);
  if (!data?.lead || !data.fields.length) return null;

  const apply = async () => {
    setPending(true);
    const r = await adminCall(`/admin/clients/${clientId}/apply-lead-values`, { body: { leadId: data.lead!.id, fields: take } });
    setPending(false);
    if (!r.ok) return toast({ tone: 'error', text: errorText(r) });
    toast({ text: t('ui.admin-client-merge.diff.done') });
    setOpen(false);
    setTake([]);
    load();
    onChanged?.();
  };

  return (
    <>
      <Banner
        tone="info"
        title={t('ui.admin-client-merge.diff.title')}
        action={can('client.update') ? <Button variant="secondary" size="S" onClick={() => { setTake(data.fields.map((f) => f.key)); setOpen(true); }}>{t('ui.admin-client-merge.diff.update')}</Button> : undefined}
      >
        {t('ui.admin-client-merge.diff.text', { reference: data.lead.reference, n: data.fields.length })}
      </Banner>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('ui.admin-client-merge.diff.update')}
        closeLabel={t('ui.common.close')}
        width={720}
        footer={
          <>
            <Button variant="secondary" size="M" onClick={() => setOpen(false)}>
              {t('ui.common.cancel')}
            </Button>
            <Button variant="tool" size="M" pending={pending} disabled={!take.length} onClick={() => void apply()}>
              {t('ui.admin-client-merge.diff.apply', { n: take.length })}
            </Button>
          </>
        }
      >
        <p className={s.muted}>{t('ui.admin-client-merge.diff.explain', { reference: data.lead.reference })}</p>
        <div className={s.diffTable} role="table">
          <div className={s.diffHead} role="row">
            <span role="columnheader">{t('ui.admin-client-merge.diff.field')}</span>
            <span role="columnheader">{t('ui.admin-client-merge.diff.record')}</span>
            <span role="columnheader">{t('ui.admin-client-merge.diff.lead')}</span>
          </div>
          {data.fields.map((f) => {
            const on = take.includes(f.key);
            return (
              <div key={f.key} className={s.diffRow} role="row">
                <span role="cell" className={s.diffField}>
                  {t(`ui.admin-client-merge.field.${f.key}` as MessageKey)}
                </span>
                <button type="button" role="cell" className={[s.diffValue, !on && s.diffPicked].filter(Boolean).join(' ')} aria-pressed={!on} onClick={() => setTake((x) => x.filter((k) => k !== f.key))}>
                  {show(f.key, f.record)}
                </button>
                <button type="button" role="cell" className={[s.diffValue, on && s.diffPicked].filter(Boolean).join(' ')} aria-pressed={on} onClick={() => setTake((x) => [...new Set([...x, f.key])])}>
                  {show(f.key, f.lead)}
                </button>
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
