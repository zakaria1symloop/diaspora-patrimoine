'use client';
// EA-22 « Un dossier » (PIP-020 … PIP-026, PIP-060, PIP-090). Header: reference, client, retained property, the frieze
// of the seven stages with the dates of the stages passed, state, priority, adviser, stage deadline, the main action
// and the « ⋯ » menu (absent when the role may not, greyed with its reason when the state forbids, BO-047). Under it
// « Ce qu'il manque ». Tabs: Aperçu · Biens · Échanges · Tâches · Historique — the tabs of Lot 4 (Pièces, Financement,
// Réservation et acquisition, Emprunteurs) join with their screens. A finished dossier reads only; notes stay possible.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DOSSIER_PRIORITIES, type DossierDetail } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Banner, Button, Icon, Menu, StatusTag, useToast, type MenuItem } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { money, relativeTime, shortDate, shortDateTime, shortDay, staffLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { CLIENT_STATUS_TONE, DOSSIER_STATUS_TONE } from '@/lib/tones';
import { AppointmentDialog } from '../agenda/AppointmentDialog';
import { ExchangeActions } from '../exchanges/ExchangeActions';
import { EmailComposer } from '../exchanges/EmailComposer';
import { DetailPage } from '../shell/detail/DetailPage';
import { Facts, Surface } from '../shell/Page';
import { signalShellChanged, useShell } from '../shell/ShellContext';
import { Timeline } from '../shell/timeline/Timeline';
import { TaskDialog } from '../tasks/TaskDialog';
import { DossierTasks } from '../tasks/DossierTasks';
import { CandidatesTab } from './CandidatesTab';
import { conditionLabel, DossierDialogs, type DossierDialog } from './dialogs';
import { HistoryTab } from './HistoryTab';
import { PlanSection, NextStepSection } from './OverviewSections';
import { abilityItem, allowed, amount, DASH, enumLabel, NextStep, Photo, PriorityTag, RecordLink, shown, Sla, timelineIcon, timelineSentence } from './parts';
import s from './dossiers.module.css';

export type DossierTab = 'apercu' | 'biens' | 'echanges' | 'taches' | 'historique';

export function DossierView({ initial, tab, webUrl }: { initial: DossierDetail; tab: DossierTab; webUrl: string }) {
  const router = useRouter();
  const toast = useToast();
  const { timeZone, can } = useShell();
  const [d, setD] = useState(initial);
  const [dialog, setDialog] = useState<DossierDialog>(null);
  // the timeline reads itself: a new key makes it read again after an exchange noted from here (CRM-030)
  const [timelineKey, setTimelineKey] = useState(0);
  // CTL-006 — « Écrire au promoteur » of the retained property, from the dossier
  const [writingPromoter, setWritingPromoter] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => setD(initial), [initial]);

  // NOT-032 — opening the dossier (any tab) marks its notifications read.
  useEffect(() => {
    void adminCall('/admin/notifications/read', { body: { entityType: 'Dossier', entityId: d.id } }).then((r) => {
      if (r.ok) signalShellChanged();
    });
  }, [d.id]);

  const reload = async () => {
    const r = await adminCall<DossierDetail>(`/admin/dossiers/${d.id}`);
    if (r.ok) setD(r.data);
  };
  const done = (next: DossierDetail) => {
    setD(next);
    setDialog(null);
    signalShellChanged();
    router.refresh();
  };

  const finished = d.status === 'WON' || d.status === 'LOST';

  // PIP-021 — the main action. « Prendre en charge » is the change of adviser to oneself (CYC-020).
  async function take() {
    setPending(true);
    const me = await adminCall<{ data: { id: string; me: boolean }[] }>('/admin/dossiers/pickers/agents');
    const self = me.ok ? me.data.data.find((a) => a.me) : undefined;
    const r = self ? await adminCall<DossierDetail>(`/admin/dossiers/${d.id}/assign`, { body: { agentId: self.id, silent: false } }) : me;
    setPending(false);
    if (r.ok && self) {
      toast({ text: t('ui.admin-dossiers.toast.taken') });
      done(r.data as DossierDetail);
    } else if (!r.ok) toast({ tone: 'error', text: errorText(r) });
  }

  const missing = d.conditions.filter((c) => !c.met);
  const main =
    d.action === 'TAKE' ? (
      <Button variant="tool" size="M" pending={pending} onClick={() => void take()}>
        {t('ui.admin-dossiers.action.take')}
      </Button>
    ) : d.action === 'QUALIFY' ? (
      <Button variant="tool" size="M" onClick={() => setDialog('qualify')}>
        {t('ui.admin-dossiers.action.qualify')}
      </Button>
    ) : d.action === 'RESUME' ? (
      <Button variant="tool" size="M" onClick={() => setDialog('resume')}>
        {t('ui.admin-dossiers.action.resumeDossier')}
      </Button>
    ) : null;

  const menu: MenuItem[] = [
    ...(d.status === 'ON_HOLD' ? [] : abilityItem(d.can.hold, { key: 'hold', label: t('ui.admin-dossiers.action.hold'), icon: 'pause', onSelect: () => setDialog('hold') })),
    ...(d.status === 'ON_HOLD' ? abilityItem(d.can.resume, { key: 'resume', label: t('ui.admin-dossiers.action.resume'), icon: 'play', onSelect: () => setDialog('resume') }) : []),
    ...(d.status === 'LOST' ? abilityItem(d.can.reopen, { key: 'reopen', label: t('ui.admin-dossiers.action.reopen'), icon: 'arrow-left', onSelect: () => setDialog('reopen') }) : abilityItem(d.can.close, { key: 'close', label: t('ui.admin-dossiers.action.close'), icon: 'close', onSelect: () => setDialog('close') })),
    ...(finished ? [] : abilityItem(d.can.moveBack, { key: 'moveBack', label: t('ui.admin-dossiers.action.moveBack'), icon: 'arrow-left', onSelect: () => setDialog('moveBack') })),
    ...(d.can.assignToOthers ? abilityItem(d.can.assign, { key: 'assign', label: t('ui.admin-dossiers.action.assign'), icon: 'user', onSelect: () => setDialog('assign'), separated: true }) : []),
    ...abilityItem(d.can.delete, { key: 'delete', label: t('ui.admin-dossiers.action.delete'), icon: 'trash', danger: true, onSelect: () => setDialog('delete'), separated: true }),
  ];

  async function setPriority(priority: string) {
    const r = await adminCall<DossierDetail>(`/admin/dossiers/${d.id}`, { method: 'PATCH', body: { version: d.version, priority } });
    if (r.ok) done(r.data);
    else toast({ tone: 'error', text: errorText(r) });
  }

  const tabs = [
    { key: 'apercu', label: t('ui.admin-dossiers.tab.apercu') },
    { key: 'biens', label: t('ui.admin-dossiers.tab.biens'), count: d.counts.proposalsWaiting || null },
    { key: 'echanges', label: t('ui.admin-dossiers.tab.echanges') },
    ...(can('task.read') ? [{ key: 'taches', label: t('ui.admin-dossiers.tab.taches'), count: d.counts.overdueTasks || null }] : []),
    { key: 'historique', label: t('ui.admin-dossiers.tab.historique') },
  ];

  const header = (
    <div className={s.metaLine}>
      <StatusTag tone={DOSSIER_STATUS_TONE[d.status] ?? 'neutral'}>{enumLabel('DossierStatus', d.status)}</StatusTag>
      <span className={s.metaItem}>
        <span className={s.metaLabel}>{t('ui.admin-dossiers.column.client')}</span>
        <RecordLink href={`/clients/${d.client.id}`}>{d.client.name ?? DASH}</RecordLink>
      </span>
      <span className={s.metaItem}>
        <span className={s.metaLabel}>{t('ui.admin-dossiers.column.property')}</span>
        {d.property ? <RecordLink href={`/catalogue/biens/${d.property.id}`}>{d.property.title}</RecordLink> : <span className={s.muted}>{t('ui.admin-dossiers.propertyToDefine')}</span>}
      </span>
      <span className={s.metaItem}>
        <span className={s.metaLabel}>{t('ui.admin-dossiers.column.agent')}</span>
        {d.agent ? staffLabel(d.agent.name) : <span className={s.unassigned}>{t('ui.admin-dossiers.unassigned')}</span>}
      </span>
      <span className={s.metaItem}>
        <span className={s.metaLabel}>{t('ui.admin-dossiers.column.priority')}</span>
        {allowed(d.can.update) ? (
          <Menu
            label={t('ui.admin-dossiers.changePriority')}
            trigger={
              <span className={s.priorityTrigger}>
                <PriorityTag value={d.priority} />
                <Icon name="chevron-down" size={16} />
              </span>
            }
            triggerClassName={s.inlineMenu}
            align="start"
            items={DOSSIER_PRIORITIES.map((p) => ({ key: p, label: enumLabel('Priority', p) ?? p, onSelect: () => void setPriority(p), disabledReason: p === d.priority ? t('ui.admin-dossiers.currentValue') : null }))}
          />
        ) : (
          <PriorityTag value={d.priority} />
        )}
      </span>
      <span className={s.metaItem}>
        <span className={s.metaLabel}>{t('ui.admin-dossiers.column.sla')}</span>
        <Sla value={d.sla} />
      </span>
    </div>
  );

  return (
    <>
      <DetailPage
        crumbs={[{ label: t('ui.admin-shell.menu.group.dossiers') }, { label: t('ui.admin-dossiers.title'), href: '/dossiers' }, { label: d.reference }]}
        title={t('ui.admin-dossiers.detail.title', { reference: d.reference, client: d.client.name ?? '' })}
        meta={header}
        actions={
          <>
            {main}
            {menu.length ? <Menu label={t('ui.admin-dossiers.moreActions')} items={menu} /> : null}
          </>
        }
        notice={
          <>
            <Frieze d={d} />
            {/* PIP-021 « Ce qu'il manque » — each condition, met or missing; the button is active only when all are met */}
            {d.conditions.length ? (
              <div className={s.missing} data-complete={missing.length === 0 ? 'true' : 'false'}>
                <span className={s.missingTitle}>
                  <Icon name={missing.length ? 'status-warning' : 'status-success'} size={20} />
                  {missing.length ? t('ui.admin-dossiers.missing.title', { n: missing.length }) : t('ui.admin-dossiers.missing.allMet')}
                </span>
                <ul className={s.missingList}>
                  {d.conditions.map((c) => (
                    <li key={c.code} className={c.met ? s.condOk : s.condKo}>
                      <Icon name={c.met ? 'check' : 'close'} size={16} />
                      {conditionLabel(c.code)}
                    </li>
                  ))}
                </ul>
                {d.stage === 'MATCHING' ? <span className={s.sub}>{t('ui.admin-dossiers.missing.lot4')}</span> : null}
              </div>
            ) : null}
          </>
        }
        tabs={tabs}
        activeTab={tab}
        basePath={`/dossiers/${d.reference.toLowerCase()}`}
        aside={<Aside d={d} timeZone={timeZone} />}
      >
        {tab === 'apercu' ? <Overview d={d} timeZone={timeZone} done={done} openTask={() => setTaskOpen(true)} /> : null}
        {tab === 'biens' ? <CandidatesTab dossier={d} webUrl={webUrl} onChange={() => void reload()} openVisit={() => setAppointmentOpen(true)} /> : null}
        {tab === 'echanges' ? (
          <Timeline
            key={timelineKey}
            endpoint={`/admin/dossiers/${d.id}/timeline`}
            entity={{ type: 'DOSSIER', id: d.id }}
            types={['STAGE', 'PROPERTY', 'ACTIVITY', 'LEAD', 'EMAIL', 'CALL', 'NOTE']}
            quickActions={
              <>
                {/* CRM-030, CRM-031, COM-020, COM-030 — « Noter un appel… (depuis une demande, un client ou un dossier) » */}
                <ExchangeActions
                  target={{ dossierId: d.id, clientId: d.client.id, personName: d.client.name }}
                  onDone={() => {
                    setTimelineKey((k) => k + 1);
                    void reload();
                  }}
                />
                {d.property?.promoterId && can('email.send') ? (
                  <Button variant="secondary" size="S" icon="mail" onClick={() => setWritingPromoter(true)}>
                    {t('ui.admin-exchanges.partner.button')}
                  </Button>
                ) : null}
                {d.can.createTask ? (
                  <Button variant="secondary" size="S" onClick={() => setTaskOpen(true)}>
                    <Icon name="check" size={16} />
                    {t('ui.admin-dossiers.quick.task')}
                  </Button>
                ) : null}
                {d.can.createAppointment ? (
                  <Button variant="secondary" size="S" onClick={() => setAppointmentOpen(true)}>
                    <Icon name="calendar" size={16} />
                    {t('ui.admin-dossiers.quick.appointment')}
                  </Button>
                ) : null}
              </>
            }
          />
        ) : null}
        {tab === 'taches' ? <DossierTasks dossierId={d.id} dossierReference={d.reference} clientId={d.client.id} readOnly={finished} onChange={() => void reload()} /> : null}
        {tab === 'historique' ? <HistoryTab dossier={d} /> : null}
      </DetailPage>
      {d.property?.promoterId ? (
        <EmailComposer
          open={writingPromoter}
          target={{ promoterId: d.property.promoterId, dossierId: d.id, personName: d.property.promoterName }}
          close={() => setWritingPromoter(false)}
          done={() => {
            setWritingPromoter(false);
            setTimelineKey((k) => k + 1);
          }}
        />
      ) : null}
      <DossierDialogs dialog={dialog} dossier={d} close={() => setDialog(null)} done={done} deleted={() => router.push('/dossiers')} />
      <TaskDialog open={taskOpen} onClose={() => setTaskOpen(false)} onDone={() => (setTaskOpen(false), void reload())} links={{ dossierId: d.id, clientId: d.client.id, label: t('ui.admin-dossiers.linkLabel', { reference: d.reference }) }} />
      <AppointmentDialog open={appointmentOpen} onClose={() => setAppointmentOpen(false)} onDone={() => (setAppointmentOpen(false), void reload())} preset={{ clientId: d.client.id, clientName: d.client.name, dossierId: d.id }} />
    </>
  );
}

/** PIP-020 — the frieze: seven stages, the current one stands out, the dates of the stages passed. */
function Frieze({ d }: { d: DossierDetail }) {
  return (
    <ol className={s.frieze} aria-label={t('ui.admin-dossiers.frieze')}>
      {d.steps.map((step, i) => (
        <li key={step.stage} className={[s.fStep, s[`f${step.state}`]].filter(Boolean).join(' ')} aria-current={step.state === 'CURRENT' ? 'step' : undefined} style={{ animationDelay: `${i * 40}ms` }}>
          <span className={s.fDot}>{step.state === 'DONE' ? <Icon name="check" size={16} /> : i + 1}</span>
          <span className={s.fName}>{enumLabel('DossierStage', step.stage)}</span>
          <span className={s.fDate}>
            {step.state === 'SKIPPED' ? t('ui.admin-dossiers.frieze.skipped') : step.enteredAt ? shortDay(step.enteredAt.slice(0, 10)) : step.state === 'CURRENT' ? t('ui.admin-dossiers.frieze.now') : ''}
          </span>
          {step.state === 'CURRENT' && d.status === 'ON_HOLD' ? <StatusTag tone="warning" icon="pause">{t('ui.admin-dossiers.frieze.paused')}</StatusTag> : null}
        </li>
      ))}
    </ol>
  );
}

/** BO-045 — the right column: what the dossier waits for, the client and how to reach him, the requests behind it. */
function Aside({ d, timeZone }: { d: DossierDetail; timeZone: string }) {
  const local = d.client.timezone ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: d.client.timezone }).format(new Date()).replace(':', ' h ') : null;
  return (
    <>
      <Surface title={t('ui.admin-dossiers.aside.next')}>
        <div className={s.asideNext}>
          <NextStep next={d.next} timeZone={timeZone} />
          <span className={s.sub}>{t('ui.admin-dossiers.daysInStage', { n: d.daysInStage })}</span>
        </div>
      </Surface>
      <Surface title={t('ui.admin-dossiers.aside.client')}>
        <Facts
          items={[
            { label: t('ui.admin-dossiers.aside.name'), value: <RecordLink href={`/clients/${d.client.id}`}>{d.client.name ?? DASH}</RecordLink> },
            { label: t('ui.admin-dossiers.aside.status'), value: <StatusTag tone={CLIENT_STATUS_TONE[d.client.status] ?? 'neutral'}>{enumLabel('ClientStatus', d.client.status)}</StatusTag> },
            { label: t('ui.admin-dossiers.aside.score'), value: d.client.score === null ? null : String(d.client.score) },
            { label: t('ui.admin-dossiers.aside.email'), value: d.client.email ? d.client.masked ? d.client.email : <a href={`mailto:${d.client.email}`}>{d.client.email}</a> : t('ui.admin-dossiers.aside.noEmail') },
            { label: t('ui.admin-dossiers.aside.phone'), value: d.client.phone ? d.client.masked ? d.client.phone : <a href={`tel:${d.client.phone}`}>{d.client.phone}</a> : null },
            { label: t('ui.admin-dossiers.aside.preferred'), value: [enumLabel('ContactChannel', d.client.preferredChannel), enumLabel('ContactTimeSlot', d.client.preferredSlot)].filter(Boolean).join(' · ') || null },
            { label: t('ui.admin-dossiers.aside.localTime'), value: local ? t('ui.admin-dossiers.aside.localTimeValue', { heure: local, zone: d.client.timezone ?? '' }) : null },
            { label: t('ui.admin-dossiers.aside.space'), value: t(d.client.hasAccount ? 'ui.admin-dossiers.aside.hasSpace' : 'ui.admin-dossiers.aside.noSpace') },
          ]}
        />
      </Surface>
      {d.leads.length ? (
        <Surface title={t('ui.admin-dossiers.aside.leads')}>
          <ul className={s.leadList}>
            {d.leads.map((l) => (
              <li key={l.reference}>
                <Link href={`/demandes/${l.reference.toLowerCase()}`} className={s.leadLink}>
                  <span className={s.refLink}>{l.reference}</span>
                  <span className={s.sub}>{enumLabel('LeadKind', l.kind)}</span>
                </Link>
                {l.origin ? <StatusTag tone="info">{t('ui.admin-dossiers.aside.origin')}</StatusTag> : null}
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}
      <Surface title={t('ui.admin-dossiers.aside.dates')}>
        <Facts
          items={[
            { label: t('ui.admin-dossiers.column.createdAt'), value: shortDate(d.createdAt, timeZone) },
            { label: t('ui.admin-dossiers.aside.stageSince'), value: shortDateTime(d.stageEnteredAt, timeZone) },
            { label: t('ui.admin-dossiers.column.lastActivity'), value: relativeTime(d.lastActivityAt, Date.now(), timeZone) },
          ]}
        />
      </Surface>
    </>
  );
}

const BANNER_TONE: Record<string, 'info' | 'warning' | 'error' | 'success'> = {
  ON_HOLD: 'warning',
  RESUME_DUE: 'warning',
  ACTIVITY_ON_HOLD: 'info',
  SELECTION_REQUESTED: 'info',
  PROPERTY_UNAVAILABLE: 'error',
  PROPERTY_OFFLINE: 'warning',
  PROPERTY_RESERVED: 'warning',
  DO_NOT_CONTACT: 'error',
  NO_EMAIL: 'info',
  EMAIL_BOUNCED: 'error',
  RESTRICTED: 'warning',
  INACTIVE: 'warning',
  LOST: 'info',
  WON: 'success',
};

/** PIP-025 — the overview: banners, the plan, the sentence the client reads, what is to do, the last activity. */
function Overview({ d, timeZone, done, openTask }: { d: DossierDetail; timeZone: string; done: (next: DossierDetail) => void; openTask: () => void }) {
  const fmt = (code: string, params: Record<string, string | number | null>): string => {
    const p: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) p[k] = v;
    if (typeof p.date === 'string' && p.date.includes('T')) p.date = shortDate(p.date, timeZone);
    if (typeof p.until === 'string') p.until = shortDay(p.until);
    if (typeof p.reason === 'string' && code !== 'DO_NOT_CONTACT') p.reason = enumLabel('HoldReason', p.reason) !== p.reason ? (enumLabel('HoldReason', p.reason) ?? p.reason) : (enumLabel('LostReason', p.reason) ?? p.reason);
    const variant =
      code === 'ON_HOLD' ? (p.until ? 'ON_HOLD_until' : p.note ? 'ON_HOLD_note' : code) : code === 'DO_NOT_CONTACT' && params.reason ? 'DO_NOT_CONTACT_reason' : code === 'SELECTION_REQUESTED' && p.lot ? (p.lotLost ? 'SELECTION_REQUESTED_lotLost' : 'SELECTION_REQUESTED_lot') : code;
    return t(`ui.admin-dossiers.banner.${variant}` as MessageKey, p);
  };
  return (
    <div className={s.overview}>
      {d.banners.length ? (
        <div className={s.banners}>
          {d.banners.map((b) => (
            <Banner key={b.code} tone={BANNER_TONE[b.code] ?? 'info'} action={b.code === 'SELECTION_REQUESTED' ? <Link href={`?onglet=biens`} className={s.bannerLink}>{t('ui.admin-dossiers.banner.openProperties')}</Link> : undefined}>
              <p>{fmt(b.code, { ...b.params, client: d.client.name ?? '' })}</p>
            </Banner>
          ))}
        </div>
      ) : null}
      <div className={s.overviewGrid}>
        {d.property ? (
          <Surface title={t('ui.admin-dossiers.overview.property')} className={s.propertySurface}>
            <div className={s.retained}>
              <Photo image={d.property.photo} className={s.retainedPhoto} />
              <div className={s.retainedText}>
                <strong>{d.property.title}</strong>
                <span className={s.sub}>{[d.property.reference, d.property.city, d.property.promoterName].filter(Boolean).join(' · ')}</span>
                <span>{d.lot ? t('ui.admin-dossiers.overview.lot', { lot: d.lot.reference, prix: money(d.lot.price.amount, d.lot.price.currency) }) : d.lotLost ? <span className={s.warnText}>{t('ui.admin-dossiers.overview.lotLost')}</span> : t('ui.admin-dossiers.overview.noLot')}</span>
              </div>
            </div>
          </Surface>
        ) : null}
        <PlanSection d={d} done={done} />
        <NextStepSection d={d} done={done} />
        <Surface
          title={t('ui.admin-dossiers.overview.todo')}
          actions={
            d.can.createTask ? (
              <Button variant="secondary" size="S" onClick={openTask}>
                <Icon name="plus" size={16} />
                {t('ui.admin-dossiers.quick.task')}
              </Button>
            ) : undefined
          }
        >
          {d.todo.tasks.length || d.todo.nextAppointment ? (
            <ul className={s.todo}>
              {d.todo.nextAppointment ? (
                <li className={s.todoItem}>
                  <Icon name="calendar" size={20} />
                  <span className={s.todoText}>
                    <strong>{enumLabel('AppointmentType', d.todo.nextAppointment.type)}</strong>
                    <span className={s.sub}>
                      {[d.todo.nextAppointment.startsAt ? shortDateTime(d.todo.nextAppointment.startsAt, timeZone) : enumLabel('AppointmentStatus', d.todo.nextAppointment.status), d.todo.nextAppointment.propertyTitle].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </li>
              ) : null}
              {d.todo.tasks.map((task) => (
                <li key={task.id} className={[s.todoItem, task.overdue && s.todoLate].filter(Boolean).join(' ')}>
                  <Icon name={task.overdue ? 'status-warning' : 'check'} size={20} />
                  <span className={s.todoText}>
                    <Link href={`/taches?tache=${task.id}`} className={s.todoLink}>
                      {task.title}
                    </Link>
                    <span className={s.sub}>{[task.dueAt ? (task.dueHasTime ? shortDateTime(task.dueAt, timeZone) : shortDate(task.dueAt, timeZone)) : t('ui.admin-dossiers.overview.noDue'), staffLabel(task.assigneeName), task.automatic ? t('ui.admin-dossiers.overview.automatic') : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  {task.priority === 'HIGH' || task.priority === 'URGENT' ? <PriorityTag value={task.priority} /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.empty}>{t('ui.admin-dossiers.overview.nothingToDo')}</p>
          )}
        </Surface>
        <Surface title={t('ui.admin-dossiers.overview.activity')} actions={<Link href="?onglet=echanges" className={s.bannerLink}>{t('ui.admin-dossiers.overview.allActivity')}</Link>}>
          {d.recent.length ? (
            <ul className={s.activity}>
              {d.recent.map((e) => (
                <li key={e.id}>
                  <Icon name={timelineIcon(e.type)} size={16} />
                  <span className={s.activityText}>{timelineSentence(e)}</span>
                  <span className={s.sub}>{relativeTime(e.at, Date.now(), timeZone)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.empty}>{t('ui.admin-dossiers.overview.noActivity')}</p>
          )}
        </Surface>
      </div>
    </div>
  );
}

