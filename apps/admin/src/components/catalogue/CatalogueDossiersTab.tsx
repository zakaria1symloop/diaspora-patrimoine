'use client';
// CTL-021 « Dossiers » of a programme, CTL-045 « Demandes et dossiers » of a property: the dossiers where it is
// considered or retained (with the status of the considered property), the requests received, and the counters
// (views, interests, proposals, visits held). Within the reader's perimeter; names masked for SUPPORT (by the API).
// A dossier or a request is a link only when its screen is delivered (`isDeliveredPath`).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CatalogueDossierRow, CatalogueDossiers, CatalogueLeadRow } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { DataTable, EmptyState, SkeletonRows, StatusTag } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { DASH, shortDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { DOSSIER_STATUS_TONE, LEAD_STATUS_TONE } from '@/lib/tones';
import { Surface } from '../shell/Page';
import { isDeliveredPath } from '../shell/menu';
import { useShell } from '../shell/ShellContext';
import { catalogueStyles as s, FailureBanner, tableLabels } from './parts';

const enumOr = (name: string, v: string | null) => (v && hasMessage(`ui.enum.${name}.${v}`) ? t(`ui.enum.${name}.${v}` as MessageKey) : (v ?? DASH));

function Ref({ href, children }: { href: string; children: string }) {
  return isDeliveredPath(href) ? (
    <Link href={href} className={s.nameLink}>
      {children}
    </Link>
  ) : (
    <span className={s.num}>{children}</span>
  );
}

export function CatalogueDossiersTab({ endpoint }: { endpoint: string }) {
  const { timeZone } = useShell();
  const [data, setData] = useState<CatalogueDossiers | null>(null);
  const [failure, setFailure] = useState<Parameters<typeof FailureBanner>[0]['failure']>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    void adminCall<CatalogueDossiers>(endpoint, { signal: ctrl.signal }).then((r) => {
      if (r.ok) setData(r.data);
      else if (!r.aborted) setFailure(r);
    });
    return () => ctrl.abort();
  }, [endpoint]);
  if (failure) return <FailureBanner failure={failure} />;
  if (!data) return <SkeletonRows rows={4} label={t('ui.common.loading')} />;
  const c = data.counters;
  return (
    <>
      <Surface>
        <div className={s.counters}>
          {(['views', 'interests', 'proposals', 'visits'] as const).map((k) => (
            <div key={k} className={s.kpi}>
              <span className={s.kpiValue}>{c[k]}</span>
              <span className={s.kpiLabel}>{t(`ui.admin-programs.dossiers.counters.${k}`)}</span>
            </div>
          ))}
        </div>
      </Surface>
      <Surface title={t('ui.admin-programs.dossiers.dossiersTitle')}>
        {data.dossiers.length === 0 ? (
          <EmptyState icon="folder" title={t('ui.admin-programs.dossiers.empty.dossiers')} compact />
        ) : (
          <DataTable<CatalogueDossierRow>
            rows={data.dossiers}
            rowId={(d) => d.id}
            rowLabel={(d) => d.reference}
            labels={tableLabels(t('ui.admin-programs.dossiers.dossiersTitle'))}
            columns={[
              { key: 'reference', header: t('ui.admin-programs.dossiers.column.reference'), cell: (d) => <Ref href={`/dossiers/${d.reference.toLowerCase()}`}>{d.reference}</Ref> },
              { key: 'client', header: t('ui.admin-programs.dossiers.column.client'), cell: (d) => d.clientName ?? DASH },
              { key: 'property', header: t('ui.admin-programs.dossiers.column.property'), cell: (d) => <span className={s.sub}>{[d.propertyReference, d.propertyTitle].filter(Boolean).join(' · ')}</span>, text: (d) => d.propertyTitle },
              { key: 'lot', header: t('ui.admin-programs.dossiers.column.lot'), cell: (d) => d.lotReference ?? DASH },
              {
                key: 'stage',
                header: t('ui.admin-programs.dossiers.column.stage'),
                cell: (d) => (
                  <span className={s.tags}>
                    <StatusTag tone={DOSSIER_STATUS_TONE[d.status] ?? 'neutral'}>{d.status === 'OPEN' ? enumOr('DossierStage', d.stage) : enumOr('DossierStatus', d.status)}</StatusTag>
                  </span>
                ),
              },
              {
                key: 'candidate',
                header: t('ui.admin-programs.dossiers.column.candidate'),
                cell: (d) => (d.selected ? <StatusTag tone="success">{t('ui.admin-programs.dossiers.retained')}</StatusTag> : enumOr('CandidateStatus', d.candidateStatus)),
              },
              { key: 'agent', header: t('ui.admin-programs.dossiers.column.agent'), cell: (d) => d.agentName ?? DASH },
              { key: 'updatedAt', header: t('ui.admin-programs.dossiers.column.updatedAt'), cell: (d) => <span className={s.num}>{shortDate(d.updatedAt, timeZone)}</span> },
            ]}
          />
        )}
      </Surface>
      <Surface title={t('ui.admin-programs.dossiers.leadsTitle')}>
        {data.leads.length === 0 ? (
          <EmptyState icon="mail" title={t('ui.admin-programs.dossiers.empty.leads')} compact />
        ) : (
          <DataTable<CatalogueLeadRow>
            rows={data.leads}
            rowId={(l) => l.id}
            rowLabel={(l) => l.reference}
            labels={tableLabels(t('ui.admin-programs.dossiers.leadsTitle'))}
            columns={[
              { key: 'reference', header: t('ui.admin-programs.dossiers.column.reference'), cell: (l) => <Ref href={`/demandes/${l.reference.toLowerCase()}`}>{l.reference}</Ref> },
              { key: 'kind', header: t('ui.admin-programs.dossiers.column.kind'), cell: (l) => enumOr('LeadKind', l.kind) },
              { key: 'client', header: t('ui.admin-programs.dossiers.column.client'), cell: (l) => l.clientName ?? DASH },
              { key: 'property', header: t('ui.admin-programs.dossiers.column.property'), cell: (l) => l.propertyReference ?? DASH },
              { key: 'status', header: t('ui.admin-programs.dossiers.column.status'), cell: (l) => <StatusTag tone={LEAD_STATUS_TONE[l.status] ?? 'neutral'}>{enumOr('LeadStatus', l.status)}</StatusTag> },
              { key: 'createdAt', header: t('ui.admin-programs.dossiers.column.createdAt'), cell: (l) => <span className={s.num}>{shortDate(l.createdAt, timeZone)}</span> },
            ]}
          />
        )}
      </Surface>
    </>
  );
}
