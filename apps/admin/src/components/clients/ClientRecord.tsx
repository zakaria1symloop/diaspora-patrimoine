'use client';
// EA-13 — the record of a client (CRM-045 … CRM-048, CRM-060, CRM-065, CRM-070, CRM-075). Header: name, computed status,
// score and its detail, referent adviser, « Voir comme le client », « ⋯ ». The banners that apply, each with what can be
// done about it. Tabs whose address keeps the trace (`?onglet=`), each loaded on demand (BO-083). On the right, the key
// information — coordinates as links (TRV-041), the client's local time (TRV-031).
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ClientDetail } from '@dp/contracts';
import type { MessageKey } from '@dp/i18n';
import { Banner, Button, Icon, Menu, Modal, StatusTag, useToast, type MenuItem } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { shortDate, shortDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { CLIENT_STATUS_TONE } from '@/lib/tones';
import { AdvisorSelect } from '../crm/AdvisorSelect';
import { ExchangeActions, PhoneLinks } from '../exchanges/ExchangeActions';
import { DetailPage } from '../shell/detail/DetailPage';
import { Facts, Surface } from '../shell/Page';
import { signalShellChanged, useShell } from '../shell/ShellContext';
import { TextArea, formStyles as f } from '../shell/forms';
import { isDeliveredPath } from '../shell/menu';
import { Timeline } from '../shell/timeline/Timeline';
import { AccountTab } from './account/AccountTab';
import { PreviewButton } from './account/PreviewButton';
import { countryName, localTime, ScoreButton } from './client-parts';
import { ConsentsTab, ContactsTab, DossiersTab, FavoritesTab, FeedbackTab, LeadsTab, RegistrationsTab } from './ClientTabs';
import { ProjectTab } from './ProjectTab';
import { DuplicateBanner } from './merge/DuplicateBanner';
import { LeadDifferencesBanner } from './merge/LeadDifferencesBanner';
import { SimulationsTab } from './simulations/SimulationsTab';
import s from './clients.module.css';

type Dialog = 'assign' | 'dnc' | 'archive' | 'unarchive' | null;

export function ClientRecord({ client, tab }: { client: ClientDetail; tab: string }) {
  const { timeZone, can } = useShell();
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [timelineKey, setTimelineKey] = useState(0);
  const [editEmail, setEditEmail] = useState(false);
  const refresh = () => {
    setTimelineKey((k) => k + 1);
    router.refresh();
  };
  const name = client.fullName;
  const base = `/clients/${client.id}`;

  // NOT-032 — opening the record marks its notifications read
  useEffect(() => {
    void adminCall('/admin/notifications/read', { body: { entityType: 'Client', entityId: client.id } }).then((r) => {
      if (r.ok) signalShellChanged();
    });
  }, [client.id]);

  const quick = async (path: string, success: string) => {
    const r = await adminCall(`/admin/clients/${client.id}/${path}`, { method: 'POST' });
    if (r.ok) {
      toast({ text: success });
      refresh();
    } else toast({ tone: 'error', text: errorText(r) });
  };

  const items: MenuItem[] = [];
  if (client.can.assign) items.push({ key: 'assign', label: t('ui.admin-clients.action.assign'), icon: 'partners', onSelect: () => setDialog('assign') });
  if (client.can.update) items.push({ key: 'dnc', label: client.banners.doNotContact ? t('ui.admin-clients.action.dncLift') : t('ui.admin-clients.action.dnc'), icon: 'lock', onSelect: () => setDialog('dnc') });
  if (client.can.merge && client.banners.duplicates.some((d) => d.name)) {
    const twin = client.banners.duplicates.find((d) => d.name)!;
    items.push({ key: 'merge', label: t('ui.admin-clients.action.merge'), icon: 'copy', href: `${base}/fusion?avec=${twin.id}` });
  }
  if (client.can.archive) items.push({ key: 'archive', label: t('ui.admin-clients.action.archive'), icon: 'trash', danger: true, separated: true, disabledReason: client.can.archiveBlocked ? t('ui.admin-clients.blocked.HAS_OPEN_DOSSIER') : null, onSelect: () => setDialog('archive') });
  if (client.can.unarchive) items.push({ key: 'unarchive', label: t('ui.admin-clients.action.unarchive'), icon: 'arrow-left', separated: true, onSelect: () => setDialog('unarchive') });

  const tabs = [
    { key: 'apercu', label: t('ui.admin-clients.tab.apercu') },
    { key: 'projet', label: t('ui.admin-clients.tab.projet') },
    { key: 'demandes', label: t('ui.admin-clients.tab.demandes'), count: client.counts.leads },
    { key: 'dossiers', label: t('ui.admin-clients.tab.dossiers'), count: client.counts.dossiers },
    ...(can('simulation.read') ? [{ key: 'simulations', label: t('ui.admin-clients.tab.simulations') }] : []),
    { key: 'favoris', label: t('ui.admin-clients.tab.favoris'), count: client.counts.favorites },
    { key: 'cafes', label: t('ui.admin-clients.tab.cafes'), count: client.counts.registrations },
    // D-089 — a section whose data is missing is not shown: « Avis » appears with the first feedback
    ...(client.counts.feedback > 0 ? [{ key: 'avis', label: t('ui.admin-clients.tab.avis'), count: client.counts.feedback }] : []),
    { key: 'proches', label: t('ui.admin-clients.tab.proches'), count: client.counts.contacts },
    { key: 'accords', label: t('ui.admin-clients.tab.accords') },
    { key: 'compte', label: t('ui.admin-clients.tab.compte') },
  ];
  const active = tabs.some((x) => x.key === tab) ? tab : 'apercu';
  const b = client.banners;
  const c = client.coordinates;

  const banners = (
    <div className={s.banners}>
      {b.doNotContact ? (
        <Banner tone="error" title={t('ui.admin-clients.banner.dnc')} action={client.can.update ? <Button variant="secondary" size="S" onClick={() => setDialog('dnc')}>{t('ui.admin-clients.action.dncLift')}</Button> : undefined}>
          {[b.doNotContact.reason, b.doNotContact.at ? t('ui.admin-clients.banner.since', { date: shortDate(b.doNotContact.at, timeZone) }) : null].filter(Boolean).join(' · ')}
        </Banner>
      ) : null}
      {b.restricted ? <Banner tone="warning" title={t('ui.admin-clients.banner.restricted', { date: shortDate(b.restricted.at, timeZone) })}>{t('ui.admin-clients.banner.restrictedText')}</Banner> : null}
      {b.deletionRequestedAt ? <Banner tone="warning">{t('ui.admin-clients.banner.deletion', { date: shortDate(b.deletionRequestedAt, timeZone) })}</Banner> : null}
      {b.archived ? (
        <Banner tone="info" title={t('ui.admin-clients.banner.archived', { date: shortDate(b.archived.at, timeZone) })} action={client.can.unarchive ? <Button variant="secondary" size="S" onClick={() => setDialog('unarchive')}>{t('ui.admin-clients.action.unarchive')}</Button> : undefined}>
          {b.archived.reason ?? t('ui.admin-clients.banner.archivedText')}
        </Banner>
      ) : null}
      {b.noEmail ? (
        <Banner tone="warning" title={t('ui.admin-clients.banner.noEmail')} action={client.can.editEmail ? <Button variant="secondary" size="S" onClick={() => setEditEmail(true)}>{t('ui.admin-clients.action.addEmail')}</Button> : undefined}>
          {t('ui.admin-clients.banner.noEmailText')}
        </Banner>
      ) : null}
      {b.emailBouncedAt ? (
        <Banner
          tone="error"
          title={t('ui.admin-clients.banner.bounced', { date: shortDate(b.emailBouncedAt, timeZone) })}
          action={
            client.can.update ? (
              <span className={s.bannerActions}>
                {client.can.editEmail ? <Button variant="secondary" size="S" onClick={() => setEditEmail(true)}>{t('ui.admin-clients.action.fixEmail')}</Button> : null}
                <Button variant="secondary" size="S" onClick={() => void quick('confirm-email', t('ui.admin-clients.toast.emailConfirmed'))}>
                  {t('ui.admin-clients.action.emailOk')}
                </Button>
              </span>
            ) : undefined
          }
        >
          {t('ui.admin-clients.banner.bouncedText')}
        </Banner>
      ) : b.emailDoubtful ? (
        <Banner tone="info" title={t('ui.admin-clients.banner.doubtful')} action={client.can.update ? <Button variant="secondary" size="S" onClick={() => void quick('confirm-email', t('ui.admin-clients.toast.emailConfirmed'))}>{t('ui.admin-clients.action.emailOk')}</Button> : undefined} />
      ) : null}
      {b.phoneCheckNeeded ? (
        <Banner tone="warning" title={t('ui.admin-clients.banner.phone')} action={client.can.update ? <Button variant="secondary" size="S" onClick={() => void quick('confirm-phone', t('ui.admin-clients.toast.phoneConfirmed'))}>{t('ui.admin-clients.action.phoneOk')}</Button> : undefined}>
          {t('ui.admin-clients.banner.phoneText')}
        </Banner>
      ) : null}
      <DuplicateBanner clientId={client.id} clientName={name} duplicates={b.duplicates} onChanged={refresh} />
      <LeadDifferencesBanner clientId={client.id} clientName={name} onChanged={refresh} />
    </div>
  );

  return (
    <DetailPage
      crumbs={[{ label: t('ui.admin-shell.menu.group.crm') }, { label: t('ui.admin-clients.title'), href: '/clients' }, { label: name ?? t('ui.admin-clients.unnamed') }]}
      title={name ?? t('ui.admin-clients.unnamed')}
      meta={
        <>
          <StatusTag tone={CLIENT_STATUS_TONE[client.status] ?? 'neutral'}>{t(`ui.enum.ClientStatus.${client.status}` as MessageKey)}</StatusTag>
          {client.score ? <ScoreButton score={client.score} /> : null}
          <span className={s.metaItem}>
            <span className={s.metaLabel}>{t('ui.admin-clients.agent')}</span>
            {client.agent ? (client.mine ? t('ui.admin-clients.agentMe', { nom: client.agent.name ?? '' }) : (client.agent.name ?? t('ui.common.deletedUser'))) : t('ui.admin-clients.noAgent')}
          </span>
        </>
      }
      actions={
        <>
          <PreviewButton clientId={client.id} clientName={name} accountActive={client.account === 'ACTIVE'} />
          {items.length ? <Menu label={t('ui.admin-clients.action.more')} items={items} renderLink={(item, props) => <Link href={item.href!} className={props.className} role={props.role} tabIndex={props.tabIndex} onClick={props.onClick}>{props.children}</Link>} /> : null}
        </>
      }
      notice={banners}
      tabs={tabs}
      activeTab={active}
      basePath={base}
      aside={
        <Surface title={t('ui.admin-clients.aside.title')}>
          <Facts
            items={[
              { label: t('ui.admin-clients.aside.email'), value: c.email ? client.masked ? c.email : <a href={`mailto:${c.email}`}>{c.email}</a> : <span className={s.muted}>{t('ui.admin-clients.flag.noEmail')}</span> },
              { label: t('ui.admin-clients.aside.phone'), value: c.phone ? client.masked ? c.phone : <PhoneLinks phone={c.phone} whatsapp={c.whatsappOptIn} /> : null },
              { label: t('ui.admin-clients.aside.country'), value: [c.cityOfResidence, c.countryOfResidence ? countryName(c.countryOfResidence) : null].filter(Boolean).join(', ') || null },
              { label: t('ui.admin-clients.aside.localTime'), value: localTime(c.timezone) },
              { label: t('ui.admin-clients.aside.contactPref'), value: [c.preferredContactChannel ? t(`ui.enum.ContactChannel.${c.preferredContactChannel}` as MessageKey) : null, c.preferredContactSlot ? t(`ui.enum.ContactTimeSlot.${c.preferredContactSlot}` as MessageKey) : null].filter(Boolean).join(' · ') || null },
              { label: t('ui.admin-clients.aside.news'), value: c.marketingOptIn ? t('ui.admin-clients.aside.newsYes') : t('ui.admin-clients.aside.newsNo') },
              { label: t('ui.admin-clients.aside.account'), value: t(`ui.admin-clients.account.${client.account}` as MessageKey) },
              { label: t('ui.admin-clients.aside.source'), value: client.source ? t(`ui.enum.LeadSource.${client.source}` as MessageKey) : null },
              { label: t('ui.admin-clients.aside.created'), value: shortDateTime(client.createdAt, timeZone) },
              { label: t('ui.admin-clients.aside.activity'), value: shortDateTime(client.lastActivityAt, timeZone) },
            ]}
          />
        </Surface>
      }
    >
      {active === 'apercu' ? (
        <>
          <div className={s.next}>
            <NextCard icon="folder" label={t('ui.admin-clients.overview.dossier')} empty={t('ui.admin-clients.overview.noDossier')}>
              {client.overview.currentDossier ? (
                <>
                  {isDeliveredPath('/dossiers') ? <Link className={s.nextLink} href={`/dossiers/${client.overview.currentDossier.reference.toLowerCase()}`}>{client.overview.currentDossier.reference}</Link> : <strong>{client.overview.currentDossier.reference}</strong>}
                  <span className={s.muted}>{t(`ui.enum.DossierStage.${client.overview.currentDossier.stage}` as MessageKey)}</span>
                </>
              ) : null}
            </NextCard>
            <NextCard icon="mail" label={t('ui.admin-clients.overview.lastLead')} empty={t('ui.admin-clients.overview.noLead')}>
              {client.overview.lastLead ? (
                <>
                  <Link className={s.nextLink} href={`/demandes/${client.overview.lastLead.reference.toLowerCase()}`}>
                    {client.overview.lastLead.reference}
                  </Link>
                  <span className={s.muted}>
                    {t(`ui.enum.LeadKind.${client.overview.lastLead.kind}` as MessageKey)} · {shortDate(client.overview.lastLead.createdAt, timeZone)}
                  </span>
                </>
              ) : null}
            </NextCard>
            {client.overview.nextTask !== undefined ? (
              <NextCard icon="check" label={t('ui.admin-clients.overview.nextTask')} empty={t('ui.admin-clients.overview.noTask')}>
                {client.overview.nextTask ? (
                  <>
                    {isDeliveredPath('/taches') ? <Link className={s.nextLink} href={`/taches?tache=${client.overview.nextTask.id}`}>{client.overview.nextTask.title}</Link> : <strong>{client.overview.nextTask.title}</strong>}
                    <span className={s.muted}>{client.overview.nextTask.dueAt ? shortDateTime(client.overview.nextTask.dueAt, timeZone) : t('ui.admin-clients.overview.noDue')}</span>
                  </>
                ) : null}
              </NextCard>
            ) : null}
            {client.overview.nextAppointment !== undefined ? (
              <NextCard icon="calendar" label={t('ui.admin-clients.overview.nextAppointment')} empty={t('ui.admin-clients.overview.noAppointment')}>
                {client.overview.nextAppointment ? (
                  <>
                    {isDeliveredPath('/agenda') ? (
                      <Link className={s.nextLink} href={`/agenda?${client.overview.nextAppointment.startsAt ? `date=${new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(client.overview.nextAppointment.startsAt))}&` : ''}rdv=${client.overview.nextAppointment.id}`}>
                        {t(`ui.enum.AppointmentType.${client.overview.nextAppointment.type}` as MessageKey)}
                      </Link>
                    ) : (
                      <strong>{t(`ui.enum.AppointmentType.${client.overview.nextAppointment.type}` as MessageKey)}</strong>
                    )}
                    <span className={s.muted}>{client.overview.nextAppointment.startsAt ? shortDateTime(client.overview.nextAppointment.startsAt, timeZone) : t('ui.admin-clients.overview.toSchedule')}</span>
                  </>
                ) : null}
              </NextCard>
            ) : null}
          </div>
          <Timeline
            key={timelineKey}
            endpoint={`/admin/clients/${client.id}/timeline`}
            entity={{ type: 'CLIENT', id: client.id }}
            types={['LEAD', 'EMAIL', 'CALL', 'NOTE', 'SYSTEM']}
            quickActions={<ExchangeActions target={{ clientId: client.id, personName: name }} onDone={refresh} />}
          />
        </>
      ) : null}
      {active === 'projet' ? <ProjectTab client={client} onSaved={refresh} /> : null}
      {active === 'demandes' ? <LeadsTab clientId={client.id} /> : null}
      {active === 'dossiers' ? <DossiersTab clientId={client.id} /> : null}
      {active === 'simulations' ? <SimulationsTab clientId={client.id} clientName={name} /> : null}
      {active === 'favoris' ? <FavoritesTab clientId={client.id} /> : null}
      {active === 'cafes' ? <RegistrationsTab clientId={client.id} /> : null}
      {active === 'avis' ? <FeedbackTab clientId={client.id} /> : null}
      {active === 'proches' ? <ContactsTab clientId={client.id} canEdit={client.can.update} onChanged={refresh} /> : null}
      {active === 'accords' ? <ConsentsTab clientId={client.id} /> : null}
      {active === 'compte' ? <AccountTab clientId={client.id} clientName={name} onChanged={refresh} /> : null}

      <Modal open={dialog !== null} onClose={() => setDialog(null)} title={dialog ? t(`ui.admin-clients.dialog.${dialog === 'dnc' ? (b.doNotContact ? 'dncLift' : 'dnc') : dialog}.title` as MessageKey) : ''} closeLabel={t('ui.common.close')}>
        {dialog ? <ClientDialog kind={dialog} client={client} close={() => setDialog(null)} done={(text) => { toast({ text }); setDialog(null); refresh(); }} /> : null}
      </Modal>
      {editEmail ? <ProjectTab client={client} onSaved={() => { setEditEmail(false); refresh(); }} only="email" onClose={() => setEditEmail(false)} /> : null}
    </DetailPage>
  );
}

function NextCard({ icon, label, empty, children }: { icon: 'folder' | 'mail' | 'check' | 'calendar'; label: string; empty: string; children: React.ReactNode }) {
  return (
    <div className={s.nextCard}>
      <span className={s.nextIcon} aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className={s.nextText}>
        <span className={s.nextLabel}>{label}</span>
        {children ?? <span className={s.muted}>{empty}</span>}
      </span>
    </div>
  );
}

function ClientDialog({ kind, client, close, done }: { kind: Exclude<Dialog, null>; client: ClientDetail; close: () => void; done: (text: string) => void }) {
  const [agentId, setAgentId] = useState(client.agent?.id ?? '');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lifting = kind === 'dnc' && Boolean(client.banners.doNotContact);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (kind === 'dnc' && !lifting && !reason.trim()) return setError(t('ui.validation.REQUIRED'));
    setPending(true);
    setError(null);
    const call =
      kind === 'assign'
        ? adminCall(`/admin/clients/${client.id}/assign`, { body: { agentId: agentId || null } })
        : kind === 'dnc'
          ? adminCall(`/admin/clients/${client.id}/do-not-contact`, { body: lifting ? { enabled: false } : { enabled: true, reason } })
          : kind === 'archive'
            ? adminCall(`/admin/clients/${client.id}/archive`, { body: { reason: reason || null } })
            : adminCall(`/admin/clients/${client.id}/unarchive`, { method: 'POST' });
    const r = await call;
    setPending(false);
    if (!r.ok) return setError(errorText(r));
    done(t(`ui.admin-clients.toast.${kind === 'dnc' ? (lifting ? 'dncLifted' : 'dncSet') : kind}` as MessageKey));
  };
  const nameArg = { nom: client.fullName ?? '' };
  return (
    <form className={f.form} onSubmit={submit} noValidate>
      {kind === 'assign' ? (
        <>
          <p>{t('ui.admin-clients.dialog.assign.text', nameArg)}</p>
          <AdvisorSelect value={agentId} onChange={setAgentId} allowNone autoFocus />
        </>
      ) : null}
      {kind === 'dnc' ? (
        lifting ? (
          <p>{t('ui.admin-clients.dialog.dncLift.text', nameArg)}</p>
        ) : (
          <>
            <p>{t('ui.admin-clients.dialog.dnc.text', nameArg)}</p>
            <TextArea label={t('ui.admin-clients.dialog.dnc.reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} error={error} autoFocus />
          </>
        )
      ) : null}
      {kind === 'archive' ? (
        <>
          <p>{t('ui.admin-clients.dialog.archive.text', nameArg)}</p>
          <TextArea label={t('ui.admin-clients.dialog.archive.reason')} optional value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} />
        </>
      ) : null}
      {kind === 'unarchive' ? <p>{t('ui.admin-clients.dialog.unarchive.text', nameArg)}</p> : null}
      {error && kind !== 'dnc' ? <Banner tone="error">{error}</Banner> : null}
      {error && kind === 'dnc' && lifting ? <Banner tone="error">{error}</Banner> : null}
      <div className={`${f.actions} ${f.actionsEnd}`}>
        <Button variant="secondary" size="M" onClick={close}>
          {t('ui.common.cancel')}
        </Button>
        <Button type="submit" variant={kind === 'archive' || (kind === 'dnc' && !lifting) ? 'danger' : 'tool'} size="M" pending={pending}>
          {t(`ui.admin-clients.dialog.${kind === 'dnc' ? (lifting ? 'dncLift' : 'dnc') : kind}.submit` as MessageKey)}
        </Button>
      </div>
    </form>
  );
}
