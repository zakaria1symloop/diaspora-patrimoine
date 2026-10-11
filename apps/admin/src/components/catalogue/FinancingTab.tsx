'use client';
// CTL-130 — the « Financement » tab of a programme or of a property: one line per ACTIVE bank (« Accepte de financer »
// · « Refuse » · « Non renseigné »), a note, the date of the check; the line of a property wins over its programme's
// (MOD-240), which is shown as « Hérité du programme ». The public tag « Éligible au financement » follows. The record
// shows the tab only when an active bank exists (`reference.banks`).
import { useCallback, useEffect, useState } from 'react';
import type { EligibilityRow, EligibilityView } from '@dp/contracts';
import { Button, DataTable, Icon, SkeletonRows, StatusTag } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { DASH, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Surface } from '../shell/Page';
import { catalogueStyles as s, FailureBanner, tableLabels, useCall } from './parts';

export interface FinancingTabProps {
  scope: { programId: string } | { propertyId: string };
  /** `catalogue.eligibility.manage`. */
  canManage: boolean;
  onChanged?: () => void;
}

const stateKey = (v: boolean | null) => (v === true ? 'accepted' : v === false ? 'refused' : 'unknown');

export function FinancingTab({ scope, canManage, onChanged }: FinancingTabProps) {
  const base = 'programId' in scope ? `/admin/programs/${scope.programId}/eligibility` : `/admin/properties/${scope.propertyId}/eligibility`;
  const [data, setData] = useState<EligibilityView | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ accepted: string; note: string; checkedAt: string }>({ accepted: '', note: '', checkedAt: '' });
  const { pending, failure, run } = useCall();
  const load = useCallback(() => adminCall<EligibilityView>(base).then((r) => r.ok && setData(r.data)), [base]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!data) return <SkeletonRows rows={3} label={t('ui.common.loading')} />;

  async function save(row: EligibilityRow) {
    const accepted = draft.accepted === 'yes' ? true : draft.accepted === 'no' ? false : null;
    const ok = await run(() => adminCall(`${base}/${row.bankId}`, { method: 'PUT', body: { accepted, note: draft.note || null, ...(draft.checkedAt ? { checkedAt: draft.checkedAt } : {}) } }), t('ui.admin-programs.financing.toast'));
    if (ok !== null) {
      setEditing(null);
      await load();
      onChanged?.();
    }
  }
  const tone = (v: boolean | null) => (v === true ? 'success' : v === false ? 'error' : 'neutral');

  return (
    <Surface title={t('ui.admin-programs.financing.title')}>
      <div className={s.sectionBody}>
        <p className={s.muted}>{t('ui.admin-programs.financing.intro')}</p>
        <p className={s.notice}>
          <Icon name={data.eligible ? 'status-success' : 'info'} size={16} />
          {data.eligible ? t('ui.admin-programs.financing.eligible') : t('ui.admin-programs.financing.notEligible')}
        </p>
        <FailureBanner failure={failure} />
        <DataTable<EligibilityRow>
          rows={data.rows}
          rowId={(r) => r.bankId}
          rowLabel={(r) => r.bankName}
          labels={tableLabels(t('ui.admin-programs.financing.title'))}
          columns={[
            { key: 'bank', header: t('ui.admin-programs.financing.column.bank'), cell: (r) => <strong>{r.bankName}</strong> },
            {
              key: 'state',
              header: t('ui.admin-programs.financing.column.state'),
              cell: (r) =>
                editing === r.bankId ? (
                  <select className={s.cellInput} value={draft.accepted} onChange={(e) => setDraft((d) => ({ ...d, accepted: e.target.value }))} aria-label={t('ui.admin-programs.financing.column.state')}>
                    <option value="yes">{t('ui.admin-programs.financing.state.accepted')}</option>
                    <option value="no">{t('ui.admin-programs.financing.state.refused')}</option>
                    <option value="">{t('ui.admin-programs.financing.state.unknown')}</option>
                  </select>
                ) : (
                  <span className={s.nameText}>
                    <StatusTag tone={tone(r.accepted)}>{t(`ui.admin-programs.financing.state.${stateKey(r.accepted)}`)}</StatusTag>
                    {r.accepted === null && r.inherited ? <span className={s.sub}>{t('ui.admin-programs.financing.inherited', { etat: t(`ui.admin-programs.financing.state.${stateKey(r.inherited.accepted)}`) })}</span> : null}
                  </span>
                ),
            },
            {
              key: 'note',
              header: t('ui.admin-programs.financing.column.note'),
              cell: (r) =>
                editing === r.bankId ? (
                  <input className={s.cellInput} value={draft.note} maxLength={500} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} aria-label={t('ui.admin-programs.financing.column.note')} />
                ) : (
                  <span className={s.sub}>{r.note ?? DASH}</span>
                ),
            },
            {
              key: 'checkedAt',
              header: t('ui.admin-programs.financing.column.checkedAt'),
              cell: (r) =>
                editing === r.bankId ? (
                  <input type="date" className={s.cellInput} value={draft.checkedAt} onChange={(e) => setDraft((d) => ({ ...d, checkedAt: e.target.value }))} aria-label={t('ui.admin-programs.financing.column.checkedAt')} />
                ) : (
                  <span className={s.nameText}>
                    <span className={s.num}>{shortDay(r.checkedAt)}</span>
                    {r.checkedBy ? <span className={s.sub}>{r.checkedBy}</span> : null}
                  </span>
                ),
            },
          ]}
          rowActions={
            canManage
              ? (r) =>
                  editing === r.bankId ? (
                    <span className={s.toolbar}>
                      <Button size="S" variant="tool" pending={pending} onClick={() => void save(r)}>
                        {t('ui.admin-programs.financing.save')}
                      </Button>
                      <Button size="S" variant="tertiary" onClick={() => setEditing(null)}>
                        {t('ui.common.cancel')}
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="S"
                      variant="tertiary"
                      icon="edit"
                      onClick={() => {
                        setDraft({ accepted: r.accepted === true ? 'yes' : r.accepted === false ? 'no' : '', note: r.note ?? '', checkedAt: r.checkedAt ?? new Date().toISOString().slice(0, 10) });
                        setEditing(r.bankId);
                      }}
                    >
                      {t('ui.admin-programs.financing.edit')}
                    </Button>
                  )
              : undefined
          }
        />
      </div>
    </Surface>
  );
}
