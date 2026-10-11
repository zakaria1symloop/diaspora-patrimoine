'use client';
// EA-12 — the clients (CRM-040). Columns: Nom · E-mail · Téléphone · Pays de résidence · Statut · Score · Conseiller ·
// Dernière activité · Origine. Origin views with their server counts; « Mes clients » by default for an adviser, « Tous »
// for the other roles. Filters: status, adviser, country, score level, origin, account, news consent, creation and
// last-activity periods — inline chips, the state in the address. Bulk actions (BO-035): change the referent adviser,
// archive; the export arrives with lot 5.
import { useState } from 'react';
import Link from 'next/link';
import { CLIENT_STATUSES, CLIENT_VIEWS, LEAD_SOURCES, SCORE_LEVELS, type ClientBulkResult, type ClientList as ClientListData, type ClientListItem } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Banner, Button, ButtonInner, buttonClass, Modal, StatusTag, dateFilterBounds, useToast } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { DASH, relativeTime, shortDateTime, staffLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { CLIENT_STATUS_TONE } from '@/lib/tones';
import { AdvisorSelect } from '../crm/AdvisorSelect';
import { ListPage, type ListColumn } from '../shell/list/ListPage';
import { useShell } from '../shell/ShellContext';
import { formStyles as f } from '../shell/forms';
import { countryName, ScoreChip } from './client-parts';
import s from './clients.module.css';

export const clientPath = (id: string) => `/clients/${id}`;

type Bulk = { kind: 'assign' | 'archive'; ids: string[]; clear: () => void; reload: () => void } | null;

export function ClientsList() {
  const { shell, timeZone, can } = useShell();
  const [bulk, setBulk] = useState<Bulk>(null);
  const now = Date.now();

  const columns: ListColumn<ClientListItem>[] = [
    {
      key: 'name',
      header: t('ui.admin-clients.column.name'),
      sortable: true,
      fixed: true,
      width: '15rem',
      cell: (c) => (
        <span className={s.nameCell}>
          <Link href={clientPath(c.id)} className={s.nameLink}>
            {c.name ?? DASH}
          </Link>
          <span className={s.flags}>
            {c.noEmail ? <StatusTag tone="warning">{t('ui.admin-clients.flag.noEmail')}</StatusTag> : null}
            {c.doNotContact ? <StatusTag tone="error" icon="lock">{t('ui.admin-clients.flag.doNotContact')}</StatusTag> : null}
          </span>
        </span>
      ),
      text: (c) => c.name,
    },
    { key: 'email', header: t('ui.admin-clients.column.email'), cell: (c) => c.email ?? DASH, text: (c) => c.email },
    { key: 'phone', header: t('ui.admin-clients.column.phone'), cell: (c) => (c.phone ? <span className={s.num}>{c.phone}</span> : DASH), text: (c) => c.phone },
    { key: 'country', header: t('ui.admin-clients.column.country'), cell: (c) => (c.countryOfResidence ? countryName(c.countryOfResidence) : DASH) },
    {
      key: 'status',
      header: t('ui.admin-clients.column.status'),
      sortable: true,
      cell: (c) => <StatusTag tone={CLIENT_STATUS_TONE[c.status] ?? 'neutral'}>{t(`ui.enum.ClientStatus.${c.status}` as MessageKey)}</StatusTag>,
    },
    { key: 'score', header: t('ui.admin-clients.column.score'), sortable: true, firstDir: 'desc', cell: (c) => <ScoreChip score={c.score} level={c.scoreLevel} /> },
    {
      key: 'agent',
      header: t('ui.admin-clients.column.agent'),
      cell: (c) => (c.agentName ? (c.mine ? t('ui.admin-clients.agentMe', { nom: c.agentName }) : c.agentName) : <span className={s.muted}>{t('ui.admin-clients.noAgent')}</span>),
    },
    {
      key: 'lastActivityAt',
      header: t('ui.admin-clients.column.lastActivity'),
      sortable: true,
      firstDir: 'desc',
      cell: (c) => <time dateTime={c.lastActivityAt} title={shortDateTime(c.lastActivityAt, timeZone)}>{relativeTime(c.lastActivityAt, now, timeZone)}</time>,
    },
    { key: 'source', header: t('ui.admin-clients.column.source'), hiddenByDefault: true, cell: (c) => (c.source ? t(`ui.enum.LeadSource.${c.source}` as MessageKey) : DASH) },
    { key: 'createdAt', header: t('ui.admin-clients.column.createdAt'), sortable: true, firstDir: 'desc', hiddenByDefault: true, cell: (c) => shortDateTime(c.createdAt, timeZone) },
  ];

  const dateFilter = (key: string, label: string, from: string, to: string) => ({
    key,
    label,
    kind: 'date' as const,
    rare: true,
    toQuery: (values: string[], today: string) => {
      const b = dateFilterBounds(values, today);
      return { [from]: b.from ?? undefined, [to]: b.to ?? undefined };
    },
  });

  return (
    <>
      <ListPage<ClientListItem, ClientListData>
        listKey="clients"
        endpoint="/admin/clients"
        header={{
          title: t('ui.admin-clients.title'),
          crumbs: [{ label: t('ui.admin-shell.menu.group.crm') }, { label: t('ui.admin-clients.title') }],
          intro: t('ui.admin-clients.intro'),
          actions: can('client.create') ? (
            <Link href="/clients/nouveau" className={buttonClass('tool', 'M')}>
              <ButtonInner size="M" icon="plus">
                {t('ui.admin-clients.create.open')}
              </ButtonInner>
            </Link>
          ) : undefined,
        }}
        columns={columns}
        rowId={(c) => c.id}
        rowLabel={(c) => c.name ?? c.id}
        rowHref={(c) => clientPath(c.id)}
        defaultSort={{ key: 'lastActivityAt', dir: 'desc' }}
        defaultView={shell.role === 'AGENT' ? 'mine' : 'all'}
        searchPlaceholder={t('ui.admin-clients.search')}
        originViews={(r) => CLIENT_VIEWS.map((key) => ({ key, label: t(`ui.admin-clients.view.${key}` as MessageKey), count: r?.views[key] ?? null, query: { view: key } }))}
        filters={(r) => [
          { key: 'status', label: t('ui.admin-clients.column.status'), kind: 'options', options: CLIENT_STATUSES.map((v) => ({ value: v, label: t(`ui.enum.ClientStatus.${v}` as MessageKey), count: r?.facets.status[v] ?? 0 })) },
          { key: 'score', label: t('ui.admin-clients.column.score'), kind: 'options', options: SCORE_LEVELS.map((v) => ({ value: v, label: t(`ui.admin-clients.score.${v}` as MessageKey), count: r?.facets.score[v] ?? 0 })) },
          {
            key: 'assignedAgentId',
            label: t('ui.admin-clients.column.agent'),
            kind: 'options',
            options: [{ value: 'none', label: t('ui.admin-clients.noAgent') }, ...(r?.agents ?? []).map((a) => ({ value: a.id, label: staffLabel(a.name) }))],
          },
          {
            key: 'countryOfResidence',
            label: t('ui.admin-clients.column.country'),
            kind: 'options',
            options: Object.entries(r?.facets.countryOfResidence ?? {})
              .sort((a, b) => b[1] - a[1])
              .map(([code, count]) => ({ value: code, label: countryName(code), count })),
          },
          { key: 'source', label: t('ui.admin-clients.column.source'), kind: 'options', rare: true, options: LEAD_SOURCES.filter((v) => (r?.facets.source[v] ?? 0) > 0).map((v) => ({ value: v, label: t(`ui.enum.LeadSource.${v}` as MessageKey), count: r?.facets.source[v] ?? 0 })) },
          { key: 'hasAccount', label: t('ui.admin-clients.filter.account'), kind: 'options', single: true, rare: true, options: [{ value: 'true', label: t('ui.admin-clients.filter.withAccount') }, { value: 'false', label: t('ui.admin-clients.filter.withoutAccount') }] },
          { key: 'marketingOptIn', label: t('ui.admin-clients.filter.marketing'), kind: 'options', single: true, rare: true, options: [{ value: 'true', label: t('ui.admin-clients.filter.marketingYes') }, { value: 'false', label: t('ui.admin-clients.filter.marketingNo') }] },
          dateFilter('created', t('ui.admin-clients.filter.created'), 'createdFrom', 'createdTo'),
          dateFilter('activity', t('ui.admin-clients.filter.activity'), 'activityFrom', 'activityTo'),
        ]}
        empty={{
          title: t('ui.admin-clients.empty.title'),
          text: t('ui.admin-clients.empty.text'),
          actions: can('client.create') ? (
            <Link href="/clients/nouveau" className={buttonClass('tool', 'M')}>
              <ButtonInner size="M" icon="plus">
                {t('ui.admin-clients.create.open')}
              </ButtonInner>
            </Link>
          ) : undefined,
        }}
        bulkActions={
          can('client.assign') || can('client.archive')
            ? (ids, clear, reload) => (
                <>
                  {can('client.assign') ? (
                    <Button variant="secondary" size="S" icon="partners" onClick={() => setBulk({ kind: 'assign', ids, clear, reload })}>
                      {t('ui.admin-clients.bulk.assign')}
                    </Button>
                  ) : null}
                  {can('client.archive') ? (
                    <Button variant="secondary" size="S" icon="trash" onClick={() => setBulk({ kind: 'archive', ids, clear, reload })}>
                      {t('ui.admin-clients.bulk.archive')}
                    </Button>
                  ) : null}
                </>
              )
            : undefined
        }
      />
      <BulkDialog bulk={bulk} close={() => setBulk(null)} />
    </>
  );
}

function BulkDialog({ bulk, close }: { bulk: Bulk; close: () => void }) {
  const toast = useToast();
  const [agentId, setAgentId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClientBulkResult | null>(null);
  const reset = () => {
    setAgentId('');
    setError(null);
    setResult(null);
    close();
  };
  const n = bulk?.ids.length ?? 0;
  const submit = async () => {
    if (!bulk) return;
    if (bulk.kind === 'assign' && !agentId) return setError(t('ui.validation.REQUIRED'));
    setPending(true);
    const r = await adminCall<ClientBulkResult>('/admin/clients/bulk', { body: bulk.kind === 'assign' ? { action: 'assign', ids: bulk.ids, agentId } : { action: 'archive', ids: bulk.ids } });
    setPending(false);
    if (!r.ok) return setError(errorText(r));
    bulk.clear();
    bulk.reload();
    if (!r.data.skipped.length) {
      toast({ text: t('ui.admin-clients.bulk.done', { n: r.data.done }) });
      reset();
    } else setResult(r.data);
  };
  return (
    <Modal
      open={bulk !== null}
      onClose={reset}
      title={bulk ? t(`ui.admin-clients.bulk.${bulk.kind}Title` as MessageKey, { n }) : ''}
      closeLabel={t('ui.common.close')}
      footer={
        result ? (
          <Button variant="tool" size="M" onClick={reset}>
            {t('ui.common.close')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="M" onClick={reset}>
              {t('ui.common.cancel')}
            </Button>
            <Button variant="tool" size="M" pending={pending} onClick={() => void submit()}>
              {bulk ? t(`ui.admin-clients.bulk.${bulk.kind}Submit` as MessageKey, { n }) : ''}
            </Button>
          </>
        )
      }
    >
      <div className={f.form}>
        {result ? (
          <>
            <p>{t('ui.admin-clients.bulk.partial', { n: result.done, m: result.skipped.length })}</p>
            <ul className={s.plainList}>
              {Object.entries(result.skipped.reduce<Record<string, number>>((acc, x) => ({ ...acc, [x.reason]: (acc[x.reason] ?? 0) + 1 }), {})).map(([reason, count]) => (
                <li key={reason}>{hasMessage(`ui.admin-clients.skipped.${reason}`) ? t(`ui.admin-clients.skipped.${reason}` as MessageKey, { n: count }) : `${reason} (${count})`}</li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p>{bulk ? t(`ui.admin-clients.bulk.${bulk.kind}Text` as MessageKey, { n }) : ''}</p>
            {bulk?.kind === 'assign' ? <AdvisorSelect value={agentId} onChange={setAgentId} error={error} autoFocus /> : error ? <Banner tone="error">{error}</Banner> : null}
          </>
        )}
      </div>
    </Modal>
  );
}
