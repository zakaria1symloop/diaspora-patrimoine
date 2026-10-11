'use client';
// PIP-060 « Historique » — the journal of the stages (from, to, date, author, reason, time spent in the stage left,
// pauses excluded — CAL-063), then the rows of the audit journal about the dossier for a role that holds `audit.read`.
import { useEffect, useState } from 'react';
import type { DossierDetail, DossierHistory } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Banner, Icon, Skeleton, StatusTag } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { businessDuration, shortDateTime, staffLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Surface } from '../shell/Page';
import { useShell } from '../shell/ShellContext';
import { DASH, enumLabel } from './parts';
import s from './dossiers.module.css';

export function HistoryTab({ dossier }: { dossier: DossierDetail }) {
  const { timeZone, shell } = useShell();
  const [h, setH] = useState<DossierHistory | null | 'failed'>(null);
  useEffect(() => {
    void adminCall<DossierHistory>(`/admin/dossiers/${dossier.id}/history`).then((r) => setH(r.ok ? r.data : 'failed'));
  }, [dossier.id, dossier.version]);
  if (h === null) return <Skeleton height="12rem" />;
  if (h === 'failed') return <Banner tone="error">{t('ui.common.error.block')}</Banner>;
  const reason = (code: string | null) => (code ? (enumLabel('HoldReason', code) !== code ? enumLabel('HoldReason', code) : enumLabel('LostReason', code)) : null);
  return (
    <div className={s.history}>
      <Surface title={t('ui.admin-dossiers.history.stages')} flush>
        <table className={s.histTable}>
          <thead>
            <tr>
              <th>{t('ui.admin-dossiers.history.when')}</th>
              <th>{t('ui.admin-dossiers.history.change')}</th>
              <th>{t('ui.admin-dossiers.history.reason')}</th>
              <th>{t('ui.admin-dossiers.history.spent')}</th>
              <th>{t('ui.admin-dossiers.history.author')}</th>
            </tr>
          </thead>
          <tbody>
            {h.stages.map((r) => {
              const status = r.fromStatus !== r.toStatus ? enumLabel('DossierStatus', r.toStatus) : null;
              return (
                <tr key={r.id}>
                  <td className={s.nowrap}>{shortDateTime(r.at, timeZone)}</td>
                  <td>
                    <span className={s.histChange}>
                      {r.fromStage ? <span>{enumLabel('DossierStage', r.fromStage)}</span> : <span className={s.muted}>{t('ui.admin-dossiers.history.opened')}</span>}
                      <Icon name="arrow-right" size={16} />
                      <strong>{enumLabel('DossierStage', r.toStage)}</strong>
                      {status ? <StatusTag tone="neutral">{status}</StatusTag> : null}
                      {r.isBackward ? <StatusTag tone="warning">{t('ui.admin-dossiers.history.backward')}</StatusTag> : null}
                    </span>
                  </td>
                  <td>{[reason(r.reasonCode), r.reasonText].filter(Boolean).join(' — ') || DASH}</td>
                  <td className={s.nowrap}>{r.businessMinutesInPreviousStage === null ? DASH : businessDuration(r.businessMinutesInPreviousStage, shell.calendar.workdayMinutes)}</td>
                  <td>{r.author.kind === 'SYSTEM' ? t('ui.common.automatic') : staffLabel(r.author.name)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Surface>
      {h.audit ? (
        <Surface title={t('ui.admin-dossiers.history.audit')} flush>
          <table className={s.histTable}>
            <thead>
              <tr>
                <th>{t('ui.admin-dossiers.history.when')}</th>
                <th>{t('ui.admin-dossiers.history.action')}</th>
                <th>{t('ui.admin-dossiers.history.fields')}</th>
                <th>{t('ui.admin-dossiers.history.author')}</th>
              </tr>
            </thead>
            <tbody>
              {h.audit.map((a) => (
                <tr key={a.id}>
                  <td className={s.nowrap}>{shortDateTime(a.at, timeZone)}</td>
                  <td>
                    {hasMessage(`ui.admin-dossiers.audit.${a.action}`) ? t(`ui.admin-dossiers.audit.${a.action}` as MessageKey) : <code className={s.code}>{a.action}</code>}
                  </td>
                  <td className={s.sub}>{a.fields.join(', ') || DASH}</td>
                  <td>{a.author.kind === 'SYSTEM' ? t('ui.common.automatic') : staffLabel(a.author.name)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      ) : null}
    </div>
  );
}
