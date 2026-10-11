'use client';
// CTL-005 — « Relation »: on top, « Ce que nous attendons de lui » (ACP-015, ACP-020: each line with its deadline,
// since how many days it waits, and « Saisir la réponse » leading to where the gesture is entered — a link only when
// that screen is delivered); then the figures of the period (90 days by default, kept in the address): proposed,
// interests, visits held, options in progress, reservations confirmed, sales (and off-platform sales on their own line),
// dossiers closed and their reasons; then the open dossiers on its properties and the options and reservations.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PromoterExpectations, PromoterRelation as Relation } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { DataTable, Icon, SkeletonRows, StatusTag } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { DASH, shortDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Surface } from '../shell/Page';
import { isDeliveredPath } from '../shell/menu';
import { useShell } from '../shell/ShellContext';
import { catalogueStyles as s, tableLabels } from '../catalogue/parts';
import st from './promoters.module.css';

const DAY = 86_400_000;
const PERIODS = [30, 90, 365] as const;
const enumOr = (name: string, v: string | null) => (v && hasMessage(`ui.enum.${name}.${v}`) ? t(`ui.enum.${name}.${v}` as MessageKey) : (v ?? DASH));

export function Expectations({ promoterId }: { promoterId: string }) {
  const { timeZone } = useShell();
  const [data, setData] = useState<PromoterExpectations | null>(null);
  useEffect(() => {
    void adminCall<PromoterExpectations>(`/admin/promoters/${promoterId}/expectations`).then((r) => r.ok && setData(r.data));
  }, [promoterId]);
  const now = Date.now();
  return (
    <Surface title={t('ui.admin-promoters.expect.title')}>
      {!data ? (
        <SkeletonRows rows={2} label={t('ui.common.loading')} />
      ) : data.items.length === 0 ? (
        <p className={st.calm}>
          <Icon name="status-success" size={20} />
          {t('ui.admin-promoters.expect.empty')}
        </p>
      ) : (
        <ul className={st.expect}>
          {data.items.map((e, i) => {
            const days = Math.max(0, Math.floor((now - new Date(e.since).getTime()) / DAY));
            const href = e.href && isDeliveredPath(e.href) ? e.href : null;
            return (
              <li key={`${e.kind}-${i}`} data-late={e.dueAt && new Date(e.dueAt).getTime() < now ? '1' : undefined}>
                <span className={st.expectKind}>{t(`ui.admin-promoters.expect.kind.${e.kind}`)}</span>
                <span className={st.expectLabel}>{e.label === 'CONVENTION' ? t('ui.admin-promoters.expect.convention') : e.label}</span>
                <span className={s.sub}>
                  {t('ui.admin-promoters.expect.since', { n: days })}
                  {e.dueAt ? ` · ${t('ui.admin-promoters.expect.due', { date: shortDate(e.dueAt, timeZone) })}` : ''}
                </span>
                {href ? (
                  <Link href={href} className={st.answer}>
                    {t('ui.admin-promoters.expect.answer')}
                    <Icon name="arrow-right" size={16} />
                  </Link>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}

export function PromoterRelation({ promoterId }: { promoterId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const { timeZone } = useShell();
  const days = Number(search.get('periode') ?? 90);
  const period = (PERIODS as readonly number[]).includes(days) ? days : 90;
  const [data, setData] = useState<Relation | null>(null);
  useEffect(() => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - (period - 1) * DAY).toISOString().slice(0, 10);
    setData(null);
    void adminCall<Relation>(`/admin/promoters/${promoterId}/relation`, { query: { from, to } }).then((r) => r.ok && setData(r.data));
  }, [promoterId, period]);
  const setPeriod = (d: number) => {
    const q = new URLSearchParams(search.toString());
    q.set('periode', String(d));
    router.replace(`?${q.toString()}`, { scroll: false });
  };
  const dossierLink = (ref: string) => (isDeliveredPath(`/dossiers/${ref.toLowerCase()}`) ? <Link href={`/dossiers/${ref.toLowerCase()}`} className={s.nameLink}>{ref}</Link> : <span className={s.num}>{ref}</span>);
  const f = data?.figures;
  return (
    <>
      <Expectations promoterId={promoterId} />
      <Surface
        title={t('ui.admin-promoters.detail.tab.relation')}
        actions={
          <span className={st.segmented} role="group" aria-label={t('ui.admin-promoters.relation.period')}>
            {PERIODS.map((d) => (
              <button key={d} type="button" aria-pressed={period === d} onClick={() => setPeriod(d)}>
                {t(d === 30 ? 'ui.admin-promoters.relation.last30' : d === 90 ? 'ui.admin-promoters.relation.last90' : 'ui.admin-promoters.relation.last365')}
              </button>
            ))}
          </span>
        }
      >
        {!f ? (
          <SkeletonRows rows={2} label={t('ui.common.loading')} />
        ) : (
          <div className={s.sectionBody}>
            <div className={st.figures}>
              {(['proposed', 'interests', 'visits', 'optionsNow', 'reservations', 'sales', 'closed'] as const).map((k) => (
                <div key={k} className={st.figure} data-zero={f[k] === 0 ? '1' : undefined}>
                  <strong>{f[k]}</strong>
                  <span>{t(`ui.admin-promoters.relation.figures.${k}`)}</span>
                  {k === 'sales' ? <span className={s.note}>{`${t('ui.admin-promoters.relation.figures.externalSales')} : ${f.externalSales}`}</span> : null}
                </div>
              ))}
            </div>
            <div>
              <span className={s.muted}>{t('ui.admin-promoters.relation.closedBy')}</span>
              {f.closed === 0 ? (
                <p className={s.sub}>{t('ui.admin-promoters.relation.noClosed')}</p>
              ) : (
                <ul className={s.chips}>
                  {Object.entries(f.closedByReason).map(([r, n]) => (
                    <li key={r} className={s.chip}>
                      {enumOr('LostReason', r)} · {n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Surface>
      <Surface title={t('ui.admin-promoters.relation.openTitle')}>
        {!data ? null : data.openDossiers.length === 0 ? (
          <p className={s.muted}>{t('ui.admin-promoters.relation.noOpen')}</p>
        ) : (
          <DataTable
            rows={data.openDossiers}
            rowId={(d) => d.id}
            rowLabel={(d) => d.reference}
            labels={tableLabels(t('ui.admin-promoters.relation.openTitle'))}
            columns={[
              { key: 'reference', header: t('ui.admin-promoters.relation.column.reference'), cell: (d) => dossierLink(d.reference) },
              { key: 'client', header: t('ui.admin-promoters.relation.column.client'), cell: (d) => d.clientName ?? DASH },
              { key: 'property', header: t('ui.admin-promoters.relation.column.property'), cell: (d) => <span className={s.sub}>{d.property}</span>, text: (d) => d.property },
              { key: 'lot', header: t('ui.admin-promoters.relation.column.lot'), cell: (d) => d.lot ?? DASH },
              { key: 'stage', header: t('ui.admin-promoters.relation.column.stage'), cell: (d) => <StatusTag tone="info">{enumOr('DossierStage', d.stage)}</StatusTag> },
              { key: 'agent', header: t('ui.admin-promoters.relation.column.agent'), cell: (d) => d.agentName ?? DASH },
            ]}
          />
        )}
      </Surface>
      <Surface title={t('ui.admin-promoters.relation.holdsTitle')}>
        {!data ? null : data.holds.length === 0 ? (
          <p className={s.muted}>{t('ui.admin-promoters.relation.noHolds')}</p>
        ) : (
          <DataTable
            rows={data.holds}
            rowId={(h) => h.id}
            rowLabel={(h) => h.reference}
            labels={tableLabels(t('ui.admin-promoters.relation.holdsTitle'))}
            columns={[
              { key: 'kind', header: t('ui.admin-promoters.relation.column.kind'), cell: (h) => <StatusTag tone={h.kind === 'OPTION' ? 'pending' : 'info'}>{t(`ui.admin-promoters.relation.${h.kind}`)}</StatusTag> },
              { key: 'lot', header: t('ui.admin-promoters.relation.column.lot'), cell: (h) => `${h.lot} · ${h.property}` },
              { key: 'dossier', header: t('ui.admin-promoters.relation.column.reference'), cell: (h) => dossierLink(h.dossierReference) },
              { key: 'due', header: t('ui.admin-promoters.relation.column.due'), cell: (h) => <span className={s.num}>{h.dueAt ? shortDate(h.dueAt, timeZone) : DASH}</span> },
            ]}
          />
        )}
      </Surface>
    </>
  );
}
