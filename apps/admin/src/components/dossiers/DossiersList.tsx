'use client';
// EA-21 « Tous les dossiers » (PIP-010). The important data first: who, which property, the stage and what it waits for
// (and from whom), the stage deadline in words, the signals. Origin views with their server counts, inline filters,
// sorting, memory and saved views come from the list template. Bulk actions: « Changer de conseiller » and « Changer la
// priorité », dossier by dossier (PIP-026: each dossier changes for its own account). Exports arrive with Lot 5.
import { useState } from 'react';
import Link from 'next/link';
import { DOSSIER_PRIORITIES, DOSSIER_STAGES, DOSSIER_STATUSES, DOSSIER_VIEWS, type AdminDossierList, type AdminDossierListItem } from '@dp/contracts';
import { Button, ButtonLink, Icon, Menu, Modal, StatusTag, useToast } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { relativeTime, staffLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { DOSSIER_STATUS_TONE } from '@/lib/tones';
import { Checkbox, SelectInput, formStyles as f } from '../shell/forms';
import { ListPage, type ListColumn } from '../shell/list/ListPage';
import { useShell } from '../shell/ShellContext';
import { AgentSelect, useAgents } from './dialogs';
import { DASH, dossierPath, enumLabel, NextStep, PriorityTag, Sla } from './parts';
import s from './dossiers.module.css';

export function DossiersList() {
  const { shell, timeZone, can } = useShell();
  const [bulk, setBulk] = useState<{ kind: 'assign' | 'priority'; ids: string[]; done: () => void } | null>(null);
  const now = Date.now();

  const columns: ListColumn<AdminDossierListItem>[] = [
    {
      key: 'reference',
      header: t('ui.admin-dossiers.column.reference'),
      fixed: true,
      sortable: true,
      width: '15rem',
      cell: (d) => (
        <span className={s.refCell}>
          <Link href={dossierPath(d.reference)} className={s.refLink}>
            {d.reference}
          </Link>
          <span className={s.refClient}>{d.client.name ?? DASH}</span>
          {d.signals.overdueTasks || d.signals.doNotContact || d.signals.inactive ? (
            <span className={s.signals}>
              {d.signals.overdueTasks > 0 ? <StatusTag tone="error" icon="check">{t('ui.admin-dossiers.signal.overdueTasks', { n: d.signals.overdueTasks })}</StatusTag> : null}
              {d.signals.doNotContact ? <StatusTag tone="warning" icon="phone">{t('ui.admin-dossiers.signal.doNotContact')}</StatusTag> : null}
              {d.signals.inactive ? <StatusTag tone="inactive" icon="clock">{t('ui.admin-dossiers.signal.inactive')}</StatusTag> : null}
            </span>
          ) : null}
        </span>
      ),
      text: (d) => `${d.reference} ${d.client.name ?? ''}`,
    },
    {
      key: 'property',
      header: t('ui.admin-dossiers.column.property'),
      cell: (d) => (d.property ? <span className={s.clamp}>{d.property.title}</span> : <span className={s.muted}>{t('ui.admin-dossiers.propertyToDefine')}</span>),
      text: (d) => d.property?.title ?? null,
    },
    {
      key: 'stage',
      header: t('ui.admin-dossiers.column.stage'),
      sortable: true,
      cell: (d) => (
        <span className={s.stageCell}>
          <span className={s.stageName}>{enumLabel('DossierStage', d.stage)}</span>
          {d.status !== 'OPEN' ? <StatusTag tone={DOSSIER_STATUS_TONE[d.status] ?? 'neutral'}>{enumLabel('DossierStatus', d.status)}</StatusTag> : <span className={s.sub}>{t('ui.admin-dossiers.daysInStage', { n: d.daysInStage })}</span>}
        </span>
      ),
    },
    { key: 'next', header: t('ui.admin-dossiers.column.next'), cell: (d) => <NextStep next={d.next} timeZone={timeZone} compact /> },
    { key: 'slaDueAt', header: t('ui.admin-dossiers.column.sla'), sortable: true, cell: (d) => <Sla value={d.sla} /> },
    { key: 'priority', header: t('ui.admin-dossiers.column.priority'), sortable: true, cell: (d) => <PriorityTag value={d.priority} /> },
    {
      key: 'agent',
      header: t('ui.admin-dossiers.column.agent'),
      cell: (d) => (d.agent ? (d.mine ? t('ui.admin-dossiers.agentMe', { nom: staffLabel(d.agent.name) }) : staffLabel(d.agent.name)) : <span className={s.unassigned}>{t('ui.admin-dossiers.unassigned')}</span>),
    },
    { key: 'promoter', header: t('ui.admin-dossiers.column.promoter'), hiddenByDefault: true, cell: (d) => d.promoterName ?? DASH },
    { key: 'completeness', header: t('ui.admin-dossiers.column.completeness'), hiddenByDefault: true, cell: (d) => (d.completenessPct === null ? DASH : `${d.completenessPct} %`) },
    { key: 'lastActivityAt', header: t('ui.admin-dossiers.column.lastActivity'), sortable: true, firstDir: 'desc', cell: (d) => <span title={d.lastActivityAt}>{relativeTime(d.lastActivityAt, now, timeZone)}</span> },
    { key: 'createdAt', header: t('ui.admin-dossiers.column.createdAt'), sortable: true, firstDir: 'desc', hiddenByDefault: true, cell: (d) => relativeTime(d.createdAt, now, timeZone) },
  ];

  const create = can('dossier.create') ? (
    <ButtonLink href="/dossiers/nouveau" variant="tool" size="M">
      <Icon name="plus" size={20} />
      {t('ui.admin-dossiers.create.action')}
    </ButtonLink>
  ) : undefined;

  return (
    <>
      <ListPage<AdminDossierListItem, AdminDossierList>
        listKey="dossiers"
        endpoint="/admin/dossiers"
        header={{ title: t('ui.admin-dossiers.title'), crumbs: [{ label: t('ui.admin-shell.menu.group.dossiers') }, { label: t('ui.admin-dossiers.title') }], intro: t('ui.admin-dossiers.intro'), actions: create }}
        columns={columns}
        rowId={(d) => d.id}
        rowLabel={(d) => d.reference}
        rowHref={(d) => dossierPath(d.reference)}
        defaultSort={{ key: 'lastActivityAt', dir: 'desc' }}
        // PIP-004 — « Mes dossiers » by default for an adviser, « Tous » for the other roles
        defaultView={shell.role === 'AGENT' ? 'mine' : 'all'}
        searchPlaceholder={shell.banners.masked ? t('ui.admin-dossiers.searchReference') : t('ui.admin-dossiers.search')}
        originViews={(r) => DOSSIER_VIEWS.map((key) => ({ key, label: t(`ui.admin-dossiers.view.${key}`), count: r?.views[key] ?? null, query: { view: key } }))}
        filters={(r) => [
          { key: 'stage', label: t('ui.admin-dossiers.column.stage'), kind: 'options', options: DOSSIER_STAGES.map((v) => ({ value: v, label: enumLabel('DossierStage', v) ?? v, count: r?.facets.stage[v] ?? 0 })) },
          { key: 'status', label: t('ui.admin-dossiers.filter.status'), kind: 'options', options: DOSSIER_STATUSES.map((v) => ({ value: v, label: enumLabel('DossierStatus', v) ?? v, count: r?.facets.status[v] ?? 0 })) },
          { key: 'priority', label: t('ui.admin-dossiers.column.priority'), kind: 'options', options: DOSSIER_PRIORITIES.map((v) => ({ value: v, label: enumLabel('Priority', v) ?? v, count: r?.facets.priority[v] ?? 0 })) },
          { key: 'assignedAgentId', label: t('ui.admin-dossiers.column.agent'), kind: 'options', options: [{ value: 'none', label: t('ui.admin-dossiers.unassigned') }, ...(r?.agents ?? []).map((a) => ({ value: a.id, label: a.name }))] },
          {
            key: 'late',
            label: t('ui.admin-dossiers.filter.late'),
            kind: 'options',
            single: true,
            options: [{ value: 'true', label: t('ui.admin-dossiers.filter.lateOnly') }],
          },
          {
            key: 'financing',
            label: t('ui.admin-dossiers.filter.financing'),
            kind: 'options',
            single: true,
            rare: true,
            options: [
              { value: 'with', label: t('ui.admin-dossiers.filter.withFinancing'), count: r?.facets.financing.with ?? 0 },
              { value: 'without', label: t('ui.admin-dossiers.filter.withoutFinancing'), count: r?.facets.financing.without ?? 0 },
            ],
          },
          { key: 'promoterId', label: t('ui.admin-dossiers.column.promoter'), kind: 'options', rare: true, options: (r?.promoters ?? []).map((p) => ({ value: p.id, label: p.name })) },
        ]}
        empty={{ title: t('ui.admin-dossiers.empty.title'), text: t('ui.admin-dossiers.empty.text'), actions: create }}
        bulkActions={
          can('dossier.assign') || can('dossier.update')
            ? (ids, clear, reload) => (
                <>
                  {can('dossier.assign') ? (
                    <Button variant="secondary" size="S" onClick={() => setBulk({ kind: 'assign', ids, done: () => (clear(), reload()) })}>
                      {t('ui.admin-dossiers.bulk.assign')}
                    </Button>
                  ) : null}
                  {can('dossier.update') ? (
                    <Button variant="secondary" size="S" onClick={() => setBulk({ kind: 'priority', ids, done: () => (clear(), reload()) })}>
                      {t('ui.admin-dossiers.bulk.priority')}
                    </Button>
                  ) : null}
                </>
              )
            : undefined
        }
        rowActions={(d) => <Menu label={t('ui.admin-dossiers.rowMenu', { reference: d.reference })} items={[{ key: 'open', label: t('ui.admin-dossiers.open'), icon: 'arrow-right', href: dossierPath(d.reference) }]} />}
      />
      <BulkDialog bulk={bulk} close={() => setBulk(null)} />
    </>
  );
}

/** PIP-010, PIP-026 — the same window for all the dossiers chosen; each changes for its own account. */
function BulkDialog({ bulk, close }: { bulk: { kind: 'assign' | 'priority'; ids: string[]; done: () => void } | null; close: () => void }) {
  const toast = useToast();
  const agents = useAgents(bulk?.kind === 'assign');
  const [agentId, setAgentId] = useState('');
  const [silent, setSilent] = useState(false);
  const [priority, setPriority] = useState('HIGH');
  const [pending, setPending] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);

  async function submit() {
    if (!bulk) return;
    setPending(true);
    setFailures([]);
    const failed: string[] = [];
    for (const id of bulk.ids) {
      let r;
      if (bulk.kind === 'assign') r = await adminCall(`/admin/dossiers/${id}/assign`, { body: { agentId, silent } });
      else {
        // PATCH asks the version read: the record is read first, then changed (MOD-007).
        const d = await adminCall<{ version: number }>(`/admin/dossiers/${id}`);
        r = d.ok ? await adminCall(`/admin/dossiers/${id}`, { method: 'PATCH', body: { version: d.data.version, priority } }) : d;
      }
      if (!r.ok) failed.push(errorText(r));
    }
    setPending(false);
    if (failed.length) return setFailures(failed);
    toast({ text: t('ui.admin-dossiers.bulk.done', { n: bulk.ids.length }) });
    bulk.done();
    close();
  }

  return (
    <Modal open={bulk !== null} onClose={close} title={bulk ? t(`ui.admin-dossiers.bulk.${bulk.kind}Title`, { n: bulk.ids.length }) : ''} closeLabel={t('ui.common.close')}>
      <div className={f.form}>
        {bulk?.kind === 'assign' ? (
          <>
            <AgentSelect value={agentId} onChange={setAgentId} agents={agents} />
            <Checkbox label={t('ui.admin-dossiers.field.silent')} checked={silent} onChange={setSilent} />
          </>
        ) : (
          <SelectInput label={t('ui.admin-dossiers.column.priority')} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {DOSSIER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {enumLabel('Priority', p)}
              </option>
            ))}
          </SelectInput>
        )}
        {failures.length ? (
          <ul className={s.effectsList} role="alert">
            {failures.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        ) : null}
        <div className={`${f.actions} ${f.actionsEnd}`}>
          <Button variant="secondary" size="M" onClick={close}>
            {t('ui.common.cancel')}
          </Button>
          <Button variant="tool" size="M" pending={pending} disabled={bulk?.kind === 'assign' && !agentId} onClick={() => void submit()}>
            {t('ui.admin-dossiers.bulk.apply')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
