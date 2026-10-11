'use client';
// EA-10 — the requests, the team's inbox, in reading (package 2.11; CRM-001 … CRM-003). Columns: Référence · Reçue le ·
// Nature · Client · Objet · Origine · Conseiller · Premier contact · État; the most recent first. Origin views of
// CRM-003 with their server counts; default view « À prendre en charge » for an adviser, « Toutes » for the other
// roles. The bulk actions of CRM-004 and the actions of a request arrive with its processing (package 3.2): until
// then there is neither selection nor action here — nothing leads to what is not delivered.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LEAD_KINDS, LEAD_SOURCES, LEAD_STATUSES, LEAD_VIEWS, type LeadList, type LeadListItem } from '@dp/contracts';
import { Button, ButtonInner, buttonClass, HelpTip, Modal, StatusTag, dateFilterBounds, useToast } from '@dp/ui';
import { LEAD_MANUAL_OUTCOMES, type LeadBulkResult } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { AdvisorSelect } from '../crm/AdvisorSelect';
import { signalShellChanged } from '../shell/ShellContext';
import { SelectInput, formStyles as f } from '../shell/forms';
import { DASH, shortDateTime, staffLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { LEAD_STATUS_TONE } from '@/lib/tones';
import { ListPage, type ListColumn } from '../shell/list/ListPage';
import { useShell } from '../shell/ShellContext';
import { FirstContact } from './lead-parts';
import s from './leads.module.css';

export const leadPath = (reference: string) => `/demandes/${reference.toLowerCase()}`;

let countries: Intl.DisplayNames | null = null;
const countryName = (code: string) => {
  try {
    countries ??= new Intl.DisplayNames(['fr'], { type: 'region' });
    return countries.of(code) ?? code;
  } catch {
    return code;
  }
};

type Bulk = { kind: 'assign' | 'close' | 'spam'; ids: string[]; clear: () => void; reload: () => void } | null;

export function LeadsList() {
  const { shell, timeZone, can } = useShell();
  const router = useRouter();
  const toast = useToast();
  const [bulk, setBulk] = useState<Bulk>(null);
  const [taking, setTaking] = useState<string | null>(null);

  /** CRM-011 — « Prendre en charge » from the row: the request is mine, its record opens. */
  const take = async (l: LeadListItem, reload: () => void) => {
    setTaking(l.id);
    const r = await adminCall(`/admin/leads/${l.id}/take`, { method: 'POST' });
    setTaking(null);
    if (r.ok) {
      toast({ text: t('ui.admin-leads.toast.takenRef', { reference: l.reference }), action: { label: t('ui.admin-leads.action.open'), run: () => router.push(leadPath(l.reference)) } });
      signalShellChanged();
    } else toast({ tone: 'error', text: errorText(r) });
    reload();
  };
  const workday = shell.calendar.workdayMinutes;

  const columns: ListColumn<LeadListItem>[] = [
    {
      key: 'reference',
      header: t('ui.admin-leads.column.reference'),
      fixed: true,
      width: '10.5rem',
      cell: (l) => (
        <span className={s.reference}>
          <Link href={leadPath(l.reference)} className={s.referenceLink}>
            {l.reference}
          </Link>
          {l.needsReview ? <StatusTag tone="warning">{t('ui.admin-leads.toReview')}</StatusTag> : null}
        </span>
      ),
    },
    { key: 'createdAt', header: t('ui.admin-leads.column.createdAt'), sortable: true, firstDir: 'desc', cell: (l) => shortDateTime(l.createdAt, timeZone) },
    { key: 'kind', header: t('ui.admin-leads.column.kind'), sortable: true, cell: (l) => t(`ui.enum.LeadKind.${l.kind}`) },
    { key: 'client', header: t('ui.admin-leads.column.client'), cell: (l) => l.clientName ?? DASH, text: (l) => l.clientName },
    {
      key: 'object',
      header: t('ui.admin-leads.column.object'),
      cell: (l) => (l.object ? [l.object.reference, l.object.title].filter(Boolean).join(' · ') : DASH),
      text: (l) => (l.object ? [l.object.reference, l.object.title].filter(Boolean).join(' · ') : null),
    },
    { key: 'source', header: t('ui.admin-leads.column.source'), cell: (l) => t(`ui.enum.LeadSource.${l.source}`) },
    {
      key: 'agent',
      header: t('ui.admin-leads.column.agent'),
      cell: (l) => (l.agentName ? (l.mine ? t('ui.admin-leads.agentMe', { nom: l.agentName }) : l.agentName) : <span className={s.unassigned}>{t('ui.admin-leads.unassigned')}</span>),
    },
    {
      key: 'slaDueAt',
      header: t('ui.admin-leads.column.firstContact'),
      sortable: true,
      help: (
        <HelpTip label={t('ui.admin-leads.firstContact.helpLabel')} title={t('ui.admin-leads.column.firstContact')} align="end">
          {t('ui.admin-leads.firstContact.help')}
        </HelpTip>
      ),
      cell: (l) => <FirstContact value={l.firstContact} workdayMinutes={workday} />,
    },
    {
      key: 'status',
      header: t('ui.admin-leads.column.status'),
      sortable: true,
      cell: (l) => (
        <span className={s.statusCell}>
          <StatusTag tone={LEAD_STATUS_TONE[l.status] ?? 'neutral'}>{t(`ui.enum.LeadStatus.${l.status}`)}</StatusTag>
          {l.outcome ? <span className={s.sub}>{t(`ui.enum.LeadOutcome.${l.outcome}` as never)}</span> : null}
        </span>
      ),
    },
  ];

  return (
    <>
    <ListPage<LeadListItem, LeadList>
      listKey="leads"
      endpoint="/admin/leads"
      header={{
        title: t('ui.admin-leads.title'),
        crumbs: [{ label: t('ui.admin-shell.menu.group.crm') }, { label: t('ui.admin-leads.title') }],
        intro: t('ui.admin-leads.intro'),
        actions: can('lead.create') ? (
          <Link href="/demandes/nouvelle" className={buttonClass('tool', 'M')}>
            <ButtonInner size="M" icon="plus">{t('ui.admin-leads.create.open')}</ButtonInner>
          </Link>
        ) : undefined,
      }}
      columns={columns}
      rowId={(l) => l.id}
      rowLabel={(l) => l.reference}
      rowHref={(l) => leadPath(l.reference)}
      defaultSort={{ key: 'createdAt', dir: 'desc' }}
      // CRM-003 — « À prendre en charge » for an adviser, « Toutes » for the other roles
      defaultView={shell.role === 'AGENT' ? 'to-take' : 'all'}
      searchPlaceholder={shell.banners.masked ? t('ui.admin-leads.searchReference') : t('ui.admin-leads.search')}
      originViews={(r) => LEAD_VIEWS.map((key) => ({ key, label: t(`ui.admin-leads.view.${key}`), count: r?.views[key] ?? null, query: { view: key } }))}
      filters={(r) => [
        { key: 'status', label: t('ui.admin-leads.column.status'), kind: 'options', options: LEAD_STATUSES.map((v) => ({ value: v, label: t(`ui.enum.LeadStatus.${v}`), count: r?.facets.status[v] ?? 0 })) },
        { key: 'kind', label: t('ui.admin-leads.column.kind'), kind: 'options', options: LEAD_KINDS.map((v) => ({ value: v, label: t(`ui.enum.LeadKind.${v}`), count: r?.facets.kind[v] ?? 0 })) },
        {
          key: 'assignedAgentId',
          label: t('ui.admin-leads.column.agent'),
          kind: 'options',
          options: [{ value: 'none', label: t('ui.admin-leads.unassigned') }, ...(r?.agents ?? []).map((a) => ({ value: a.id, label: staffLabel(a.name) }))],
        },
        {
          key: 'created',
          label: t('ui.admin-leads.filter.created'),
          kind: 'date',
          toQuery: (values, today) => {
            const b = dateFilterBounds(values, today);
            return { createdFrom: b.from ?? undefined, createdTo: b.to ?? undefined };
          },
        },
        { key: 'source', label: t('ui.admin-leads.column.source'), kind: 'options', rare: true, options: LEAD_SOURCES.filter((v) => (r?.facets.source[v] ?? 0) > 0 || v === 'WEB_FORM').map((v) => ({ value: v, label: t(`ui.enum.LeadSource.${v}`), count: r?.facets.source[v] ?? 0 })) },
        {
          key: 'countryOfResidence',
          label: t('ui.admin-leads.filter.country'),
          kind: 'options',
          rare: true,
          options: Object.entries(r?.facets.countryOfResidence ?? {})
            .sort((a, b) => b[1] - a[1])
            .map(([code, count]) => ({ value: code, label: countryName(code), count })),
        },
        {
          key: 'hasDossier',
          label: t('ui.admin-leads.filter.hasDossier'),
          kind: 'options',
          single: true,
          rare: true,
          options: [
            { value: 'true', label: t('ui.admin-leads.filter.withDossier') },
            { value: 'false', label: t('ui.admin-leads.filter.withoutDossier') },
          ],
        },
      ]}
      empty={{
        title: t('ui.admin-leads.empty.title'),
        text: t('ui.admin-leads.empty.text'),
        actions: can('lead.create') ? (
          <Link href="/demandes/nouvelle" className={buttonClass('tool', 'M')}>
            <ButtonInner size="M" icon="plus">{t('ui.admin-leads.create.open')}</ButtonInner>
          </Link>
        ) : undefined,
      }}
      rowActions={(l, reload) =>
        l.canTake ? (
          <Button variant="secondary" size="S" icon="user" pending={taking === l.id} onClick={() => void take(l, reload)}>
            {t('ui.admin-leads.action.takeShort')}
          </Button>
        ) : null
      }
      bulkActions={(ids, clear, reload) => (
        <>
          {can('lead.assign') ? (
            <Button variant="secondary" size="S" icon="partners" onClick={() => setBulk({ kind: 'assign', ids, clear, reload })}>
              {t('ui.admin-leads.bulk.assign')}
            </Button>
          ) : null}
          {can('lead.process') ? (
            <>
              <Button variant="secondary" size="S" icon="check" onClick={() => setBulk({ kind: 'close', ids, clear, reload })}>
                {t('ui.admin-leads.bulk.close')}
              </Button>
              <Button variant="secondary" size="S" icon="trash" onClick={() => setBulk({ kind: 'spam', ids, clear, reload })}>
                {t('ui.admin-leads.bulk.spam')}
              </Button>
            </>
          ) : null}
        </>
      )}
    />
    <BulkDialog bulk={bulk} close={() => setBulk(null)} />
    </>
  );
}

/** CRM-004 — each request is its own action; the result says how many were done, and which were left and why. */
function BulkDialog({ bulk, close }: { bulk: Bulk; close: () => void }) {
  const toast = useToast();
  const [agentId, setAgentId] = useState('');
  const [outcome, setOutcome] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LeadBulkResult | null>(null);
  const reset = () => {
    setAgentId('');
    setOutcome('');
    setError(null);
    setResult(null);
    close();
  };
  const submit = async () => {
    if (!bulk) return;
    if (bulk.kind === 'assign' && !agentId) return setError(t('ui.validation.REQUIRED'));
    if (bulk.kind === 'close' && !outcome) return setError(t('ui.validation.REQUIRED'));
    setPending(true);
    const body = bulk.kind === 'assign' ? { action: 'assign', ids: bulk.ids, agentId } : bulk.kind === 'close' ? { action: 'close', ids: bulk.ids, outcome, note: null } : { action: 'spam', ids: bulk.ids };
    const r = await adminCall<LeadBulkResult>('/admin/leads/bulk', { body });
    setPending(false);
    if (!r.ok) return setError(errorText(r));
    bulk.clear();
    bulk.reload();
    signalShellChanged();
    if (!r.data.failed.length) {
      toast({ text: t('ui.admin-leads.bulk.done', { n: r.data.done }) });
      reset();
    } else setResult(r.data);
  };
  const n = bulk?.ids.length ?? 0;
  return (
    <Modal
      open={bulk !== null}
      onClose={reset}
      title={bulk ? t(`ui.admin-leads.bulk.${bulk.kind}Title` as MessageKey, { n }) : ''}
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
            <Button variant={bulk?.kind === 'spam' ? 'danger' : 'tool'} size="M" pending={pending} onClick={() => void submit()}>
              {bulk ? t(`ui.admin-leads.bulk.${bulk.kind}Submit` as MessageKey, { n }) : ''}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className={f.form}>
          <p>{t('ui.admin-leads.bulk.partial', { n: result.done, m: result.failed.length })}</p>
          <ul className={s.failedList}>
            {result.failed.map((x) => (
              <li key={x.id}>
                <strong>{x.reference ?? '—'}</strong> · {hasMessage(`ui.admin-leads.blocked.${x.reason}`) ? t(`ui.admin-leads.blocked.${x.reason}` as MessageKey) : t('ui.admin-leads.blocked.default')}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={f.form}>
          <p>{bulk ? t(`ui.admin-leads.bulk.${bulk.kind}Text` as MessageKey, { n }) : ''}</p>
          {bulk?.kind === 'assign' ? <AdvisorSelect value={agentId} onChange={setAgentId} disableAbsent error={error} autoFocus /> : null}
          {bulk?.kind === 'close' ? (
            <SelectInput label={t('ui.admin-leads.dialog.close.outcome')} value={outcome} onChange={(e) => setOutcome(e.target.value)} error={error}>
              <option value="" disabled>
                {t('ui.admin-leads.dialog.close.outcomePlaceholder')}
              </option>
              {LEAD_MANUAL_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {t(`ui.enum.LeadOutcome.${o}` as MessageKey)}
                </option>
              ))}
            </SelectInput>
          ) : null}
          {bulk?.kind === 'spam' && error ? <p className={s.choiceError}>{error}</p> : null}
        </div>
      )}
    </Modal>
  );
}
