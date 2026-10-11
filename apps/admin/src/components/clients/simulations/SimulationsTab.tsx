'use client';
// CRM-046 — the tab « Simulations » of a client record (EA-13): saved simulations, those received by e-mail, the
// projections and those the team made; « Rattacher au dossier » / « Détacher »; « Faire une simulation » (the two
// simulators of EP-11 and EP-12 in the back office, prefilled with the record, saved with `clientId` and `createdById`).
// The headline figure of each comes first; filters by origin with their counts (D-098).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AdminSimulationList, AdminSimulationRow, SimulationHeadline } from '@dp/contracts';
import { type MessageKey } from '@dp/i18n';
import { Banner, Button, EmptyState, Icon, Menu, Modal, Skeleton, StatusTag, useToast, type IconName } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { money, shortDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useShell } from '../../shell/ShellContext';
import { SelectInput, formStyles as f } from '../../shell/forms';
import s from './simulations.module.css';

export interface SimulationsTabProps {
  clientId: string;
  clientName: string | null;
}

const S = (k: string, p?: Record<string, string | number>) => t(`ui.admin-simulations.${k}` as MessageKey, p);

const TYPE_ICON: Record<AdminSimulationRow['type'], IconName> = { ELIGIBILITY: 'check', CREDIT: 'calculator', PROJECTION: 'sparkles' };
const ORIGIN_TONE = { CLIENT: 'success', TEAM: 'info', EMAILED: 'pending', PROJECTION: 'neutral' } as const;

export function headlineText(h: SimulationHeadline | null): string | null {
  if (!h) return null;
  if (h.kind === 'NOT_ELIGIBLE') return S('headline.NOT_ELIGIBLE');
  const amount = `${h.converted ? '≈ ' : ''}${money(h.amount.amount, h.amount.currency)}`;
  if (h.kind === 'MONTHLY') return S('headline.MONTHLY', { montant: amount, duree: S('common.years', { n: Math.round(h.durationMonths / 12) }) });
  return S(`headline.${h.kind}`, { montant: amount });
}

export function SimulationsTab({ clientId }: SimulationsTabProps) {
  const { timeZone } = useShell();
  const toast = useToast();
  const [data, setData] = useState<AdminSimulationList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AdminSimulationRow['origin'] | 'ALL'>('ALL');
  const [attaching, setAttaching] = useState<AdminSimulationRow | null>(null);

  const load = useCallback(() => {
    void adminCall<AdminSimulationList>(`/admin/clients/${clientId}/simulations`).then((r) => {
      if (r.ok) setData(r.data);
      else setError(errorText(r));
    });
  }, [clientId]);
  useEffect(() => load(), [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of data?.data ?? []) c[r.origin] = (c[r.origin] ?? 0) + 1;
    return c;
  }, [data]);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Skeleton width="100%" height="12rem" />;

  const rows = filter === 'ALL' ? data.data : data.data.filter((r) => r.origin === filter);

  const detach = async (r: AdminSimulationRow) => {
    const res = await adminCall(`/admin/simulations/${r.id}/detach`, { method: 'POST', body: {} });
    if (!res.ok) return toast({ text: errorText(res), tone: 'error' });
    toast({ text: S('tab.detachDone') });
    load();
  };

  const makers = data.can.create ? (
    <div className={s.makers}>
      {(['eligibilite', 'credit'] as const).map((type) => (
        <Link key={type} href={`/clients/${clientId}/simulations/nouvelle?type=${type}`} className={s.maker}>
          <span className={s.makerIcon} aria-hidden="true">
            <Icon name={type === 'credit' ? 'calculator' : 'check'} size={24} />
          </span>
          <span className={s.makerText}>
            <strong>
              {S('tab.make')} · {S(type === 'credit' ? 'tab.credit' : 'tab.eligibility')}
            </strong>
            <span>{S(type === 'credit' ? 'tab.creditText' : 'tab.eligibilityText')}</span>
          </span>
          <Icon name="chevron-right" size={16} />
        </Link>
      ))}
    </div>
  ) : null;

  if (!data.data.length) {
    return (
      <div className={s.tab}>
        <EmptyState icon="calculator" title={S('tab.emptyTitle')} text={S('tab.emptyText')} />
        {makers}
      </div>
    );
  }

  return (
    <div className={s.tab}>
      {makers}
      <div className={s.filters} role="group" aria-label={S('tab.count', { n: data.data.length })}>
        {(['ALL', 'CLIENT', 'TEAM', 'EMAILED', 'PROJECTION'] as const)
          .filter((o) => o === 'ALL' || counts[o])
          .map((o) => (
            <button key={o} type="button" aria-pressed={filter === o} className={[s.chip, filter === o && s.chipOn].filter(Boolean).join(' ')} onClick={() => setFilter(o)}>
              {o === 'ALL' ? S('tab.filterAll') : S(`origin.${o}`)}
              <span className={s.chipCount}>{o === 'ALL' ? data.data.length : counts[o]}</span>
            </button>
          ))}
      </div>
      <ul className={s.list}>
        {rows.map((r) => {
          const items = [
            ...(data.can.attach && data.dossiers.length && r.type !== 'PROJECTION' ? [{ key: 'attach', label: S('tab.attach'), icon: 'folder' as const, onSelect: () => setAttaching(r) }] : []),
            ...(data.can.attach && r.dossier ? [{ key: 'detach', label: S('tab.detach'), icon: 'close' as const, onSelect: () => void detach(r) }] : []),
          ];
          return (
            <li key={r.id} className={s.row}>
              <span className={s.rowIcon} aria-hidden="true">
                <Icon name={TYPE_ICON[r.type]} size={20} />
              </span>
              <div className={s.rowMain}>
                <p className={s.rowFigure}>{headlineText(r.headline) ?? t(`ui.enum.SimulationType.${r.type}` as MessageKey)}</p>
                <p className={s.rowTitle}>
                  <span>{r.label ?? S('tab.untitled', { date: shortDate(r.createdAt, timeZone) })}</span>
                  <span className={s.muted}>· {t(`ui.enum.SimulationType.${r.type}` as MessageKey)}</span>
                  {r.property ? <span className={s.muted}>· {S('tab.property', { reference: r.property.reference })}</span> : null}
                </p>
                <p className={s.rowTags}>
                  <StatusTag tone={ORIGIN_TONE[r.origin]}>{S(`origin.${r.origin}`)}</StatusTag>
                  {r.origin === 'TEAM' ? <span className={s.muted}>{r.createdByName ? S('tab.by', { nom: r.createdByName }) : S('tab.byTeam')}</span> : null}
                  {r.dossier ? (
                    <Link href={`/dossiers/${r.dossier.reference.toLowerCase()}`} className={s.dossierLink}>
                      <Icon name="folder" size={16} />
                      {S('tab.attachedTo', { reference: r.dossier.reference })}
                    </Link>
                  ) : null}
                </p>
              </div>
              <span className={s.rowDate}>{shortDate(r.createdAt, timeZone)}</span>
              {items.length ? <Menu label={t('ui.admin-clients.action.more')} items={items} /> : <span />}
            </li>
          );
        })}
      </ul>
      <AttachDialog row={attaching} dossiers={data.dossiers} close={() => setAttaching(null)} done={(ref) => {
        setAttaching(null);
        toast({ text: S('tab.attachDone', { reference: ref }) });
        load();
      }} />
    </div>
  );
}

function AttachDialog({ row, dossiers, close, done }: { row: AdminSimulationRow | null; dossiers: AdminSimulationList['dossiers']; close: () => void; done: (reference: string) => void }) {
  const [dossierId, setDossierId] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    setDossierId(dossiers.find((d) => d.id !== row?.dossier?.id)?.id ?? '');
    setFailure(null);
  }, [row, dossiers]);
  const submit = async () => {
    if (!row || !dossierId) return;
    setPending(true);
    const r = await adminCall(`/admin/simulations/${row.id}/attach`, { method: 'POST', body: { dossierId } });
    setPending(false);
    if (!r.ok) return setFailure(errorText(r));
    done(dossiers.find((d) => d.id === dossierId)?.reference ?? '');
  };
  return (
    <Modal open={row !== null} onClose={close} title={S('tab.attachTitle')} closeLabel={t('ui.common.close')}>
      <div className={f.form}>
        <p className={f.muted}>{S('tab.attachText')}</p>
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <SelectInput label={S('tab.dossier')} value={dossierId} onChange={(e) => setDossierId(e.target.value)}>
          {dossiers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.reference}
              {d.label ? ` · ${d.label}` : ''}
            </option>
          ))}
        </SelectInput>
        <div className={`${f.actions} ${f.actionsEnd}`}>
          <Button variant="secondary" size="M" onClick={close}>
            {t('ui.common.cancel')}
          </Button>
          <Button variant="tool" size="M" pending={pending} disabled={!dossierId} onClick={() => void submit()}>
            {S('tab.attach')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

