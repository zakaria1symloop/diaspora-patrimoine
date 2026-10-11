'use client';
// CRM-045, CRM-080, CRM-081 — the banner « Doublon possible avec {nom} » of a client record: « Comparer et fusionner »
// (`client.merge`, to `/clients/{id}/fusion?avec={autre}`) and « Ce n'est pas un doublon » (`client.update`), durable for
// the couple. A twin outside the reader's perimeter has no name and cannot be compared.
import { useState } from 'react';
import Link from 'next/link';
import { Banner, Button, Modal, useToast } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { useShell } from '../../shell/ShellContext';
import s from './merge.module.css';

export interface DuplicateBannerProps {
  clientId: string;
  clientName: string | null;
  /** The possible twins, as the API of the record gives them (`name` null: outside the reader's perimeter). */
  duplicates: { id: string; name: string | null }[];
  /** Called after « Ce n'est pas un doublon »: the record reads itself again. */
  onChanged?: () => void;
}

export function DuplicateBanner({ clientId, clientName, duplicates, onChanged }: DuplicateBannerProps) {
  const { can } = useShell();
  const toast = useToast();
  const [confirm, setConfirm] = useState<{ id: string; name: string | null } | null>(null);
  const [pending, setPending] = useState(false);
  if (!duplicates.length) return null;
  const notDuplicate = async () => {
    if (!confirm) return;
    setPending(true);
    const r = await adminCall(`/admin/clients/${clientId}/not-duplicate`, { body: { otherId: confirm.id } });
    setPending(false);
    if (!r.ok) return toast({ tone: 'error', text: errorText(r) });
    toast({ text: t('ui.admin-client-merge.banner.notDuplicateDone') });
    setConfirm(null);
    onChanged?.();
  };
  return (
    <>
      {duplicates.map((d) => (
        <Banner
          key={d.id}
          tone="warning"
          title={d.name ? t('ui.admin-client-merge.banner.title', { nom: d.name }) : t('ui.admin-client-merge.banner.hidden')}
          action={
            d.name ? (
              <span className={s.bannerActions}>
                {can('client.merge') ? (
                  <Link href={`/clients/${clientId}/fusion?avec=${d.id}`} className={s.bannerLink}>
                    {t('ui.admin-client-merge.banner.compare')}
                  </Link>
                ) : null}
                {can('client.update') ? (
                  <Button variant="secondary" size="S" onClick={() => setConfirm(d)}>
                    {t('ui.admin-client-merge.banner.notDuplicate')}
                  </Button>
                ) : null}
              </span>
            ) : undefined
          }
        >
          {t('ui.admin-client-merge.banner.text')}
        </Banner>
      ))}
      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={t('ui.admin-client-merge.banner.notDuplicateTitle')}
        closeLabel={t('ui.common.close')}
        footer={
          <>
            <Button variant="secondary" size="M" onClick={() => setConfirm(null)}>
              {t('ui.common.cancel')}
            </Button>
            <Button variant="tool" size="M" pending={pending} onClick={() => void notDuplicate()}>
              {t('ui.admin-client-merge.banner.notDuplicate')}
            </Button>
          </>
        }
      >
        <p>{t('ui.admin-client-merge.banner.notDuplicateText', { a: clientName ?? '', b: confirm?.name ?? '' })}</p>
      </Modal>
    </>
  );
}
