'use client';
// EA-51 — one promoter (CTL-003 … CTL-007). Header: status (with its reason and date), the convention's dates (for every
// role; its terms only in the « Convention » tab, `partner.convention.manage`), ONE main action following the status
// (« Sélectionner » · « Nouveau programme » · « Réactiver » · « Reprendre la relation ») and the others in « ⋯ »:
// « Suspendre », « Terminer la relation » (reason required; the effects are announced BEFORE confirming, MOD-110),
// « Supprimer » (only without programme, property or dossier). After a suspension: « {n} fiches ont été dépubliées… »
// · « Les republier ». Tabs: Identité · Contacts · Sélection · Convention · Documents · Page publique · Programmes ·
// Relation · Historique (`?onglet=`). No « Accès » tab: CTL-008 is [P2].
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminPromoterDetail, PromoterImpact, RepublishResult } from '@dp/contracts';
import { Banner, Button, Menu, Modal, StatusTag, useToast, type MenuItem } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { shortDate, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { DetailPage } from '../shell/detail/DetailPage';
import { Facts, Surface } from '../shell/Page';
import { signalShellChanged, useShell } from '../shell/ShellContext';
import { Timeline } from '../shell/timeline/Timeline';
import { TextArea, formStyles as f } from '../shell/forms';
import { catalogueStyles as s, ConfirmDialog, DialogButtons, FailureBanner, LinkButton, MissingList, pickTab, Thumb, useCall } from '../catalogue/parts';
import { ConventionCell, PARTNER_STATUS_TONE, promoterPath, statusLabel } from './PromotersList';
import { PromoterRelation } from './PromoterRelation';
import { PromoterContacts, PromoterConvention, PromoterDocuments, PromoterIdentity, PromoterPrograms, PromoterPublicPage, PromoterVetting } from './PromoterTabs';

type Dialog = 'select' | 'suspend' | 'end' | 'resume' | 'reactivate' | 'republish' | 'delete' | null;

export function PromoterView({ promoter, tab, webUrl }: { promoter: AdminPromoterDetail; tab?: string; webUrl: string }) {
  const p = promoter;
  const router = useRouter();
  const toast = useToast();
  const { timeZone } = useShell();
  const [dialog, setDialog] = useState<Dialog>(null);
  const refresh = () => router.refresh();
  const close = () => setDialog(null);

  useEffect(() => {
    void adminCall('/admin/notifications/read', { body: { entityType: 'Promoter', entityId: p.id } }).then((r) => {
      if (r.ok) signalShellChanged();
    });
  }, [p.id]);

  const tabs = [
    { key: 'identite', label: t('ui.admin-promoters.detail.tab.identity') },
    { key: 'contacts', label: t('ui.admin-promoters.detail.tab.contacts'), count: p.counts.contacts },
    { key: 'selection', label: t('ui.admin-promoters.detail.tab.vetting') },
    ...(p.can.convention ? [{ key: 'convention', label: t('ui.admin-promoters.detail.tab.convention') }] : []),
    { key: 'documents', label: t('ui.admin-promoters.detail.tab.documents'), count: p.counts.documents },
    { key: 'page-publique', label: t('ui.admin-promoters.detail.tab.public') },
    { key: 'programmes', label: t('ui.admin-promoters.detail.tab.programs'), count: p.counts.programs },
    { key: 'relation', label: t('ui.admin-promoters.detail.tab.relation') },
    { key: 'historique', label: t('ui.admin-promoters.detail.tab.history') },
  ];
  const active = pickTab(tab, tabs.map((x) => x.key));

  const main =
    !p.can.write ? null
    : p.status === 'PROSPECT' ? (
      <Button variant="tool" size="M" icon="check" onClick={() => setDialog('select')}>
        {t('ui.admin-promoters.action.select')}
      </Button>
    ) : p.status === 'SUSPENDED' ? (
      <Button variant="tool" size="M" onClick={() => setDialog('reactivate')}>
        {t('ui.admin-promoters.action.reactivate')}
      </Button>
    ) : p.status === 'ENDED' ? (
      <Button variant="tool" size="M" onClick={() => setDialog('resume')}>
        {t('ui.admin-promoters.action.resume')}
      </Button>
    ) : (
      <LinkButton href={`/catalogue/programmes/nouveau?promoteur=${p.id}`} icon="plus">
        {t('ui.admin-promoters.action.newProgram')}
      </LinkButton>
    );
  const items: MenuItem[] = [
    ...(p.publicPath ? [{ key: 'open', label: t('ui.admin-promoters.action.openPublic'), icon: 'external-link' as const, onSelect: () => window.open(`${webUrl}${p.publicPath}`, '_blank', 'noopener') }] : []),
    ...(p.can.write && p.status === 'ACTIVE' ? [{ key: 'suspend', label: t('ui.admin-promoters.action.suspend'), onSelect: () => setDialog('suspend') }] : []),
    ...(p.can.write && p.status !== 'ENDED' ? [{ key: 'end', label: t('ui.admin-promoters.action.end'), danger: true, onSelect: () => setDialog('end') }] : []),
    ...(p.can.delete ? [{ key: 'delete', label: t('ui.admin-promoters.action.delete'), icon: 'trash' as const, danger: true, separated: true, onSelect: () => setDialog('delete'), disabledReason: p.deleteBlocked ? t('ui.admin-promoters.action.deleteBlocked') : null }] : []),
  ];

  const meta = (
    <>
      <StatusTag tone={PARTNER_STATUS_TONE[p.status]}>{statusLabel(p.status)}</StatusTag>
      {p.statusChangedAt ? <span className={s.sub}>{t('ui.admin-promoters.detail.meta.since', { date: shortDate(p.statusChangedAt, timeZone) })}</span> : null}
      {p.statusReason ? <span className={s.sub}>· {t('ui.admin-promoters.detail.meta.reason', { raison: p.statusReason })}</span> : null}
      <span>
        {p.conventionSignedAt ? t('ui.admin-promoters.detail.meta.conventionFrom', { date: shortDay(p.conventionSignedAt) }) : t('ui.admin-promoters.detail.meta.noConvention')}
        {p.conventionExpiresAt ? ' ' : ''}
      </span>
      {p.conventionExpiresAt ? <ConventionCell date={p.conventionExpiresAt} state={p.conventionState} /> : null}
    </>
  );
  const notice =
    p.suspension && p.status === 'ACTIVE' ? (
      <Banner
        tone="info"
        action={
          p.can.publish ? (
            <Button variant="secondary" size="S" onClick={() => setDialog('republish')}>
              {t('ui.admin-promoters.detail.suspension.republish')}
            </Button>
          ) : undefined
        }
      >
        <p>{t('ui.admin-promoters.detail.suspension.banner', { n: p.suspension.count, date: shortDate(p.suspension.date, timeZone) })}</p>
      </Banner>
    ) : null;

  const aside = (
    <>
      {p.logo || p.cover ? (
        <Surface>
          <div className={s.asideHero}>
            {p.cover ? <Thumb image={p.cover} size="L" /> : null}
            {p.logo ? <img src={p.logo.url} alt="" style={{ maxHeight: '3rem', maxWidth: '10rem', objectFit: 'contain' }} /> : null}
          </div>
        </Surface>
      ) : null}
      <Surface title={t('ui.admin-promoters.detail.aside.title')}>
        <div className={s.asideHero}>
          <div className={s.kpis}>
            <div className={s.kpi}>
              <span className={s.kpiValue}>{p.counts.programs}</span>
              <span className={s.kpiLabel}>{t('ui.admin-promoters.detail.aside.programs')}</span>
            </div>
            <div className={s.kpi}>
              <span className={s.kpiValue}>{p.counts.properties}</span>
              <span className={s.kpiLabel}>{t('ui.admin-promoters.detail.aside.properties')}</span>
            </div>
            <div className={s.kpi}>
              <span className={s.kpiValue}>{p.counts.openDossiers}</span>
              <span className={s.kpiLabel}>{t('ui.admin-promoters.detail.aside.dossiers')}</span>
            </div>
          </div>
          <Facts
            items={[
              { label: t('ui.admin-promoters.detail.aside.manager'), value: p.accountManager ?? t('ui.admin-promoters.detail.aside.noManager') },
              { label: t('ui.admin-promoters.detail.aside.region'), value: [p.city, p.region].filter(Boolean).join(', ') || null },
            ]}
          />
        </div>
      </Surface>
    </>
  );

  return (
    <>
      <DetailPage
        crumbs={[{ label: t('ui.admin-shell.menu.group.catalogue') }, { label: t('ui.admin-promoters.title'), href: '/promoteurs' }, { label: p.name }]}
        title={p.name}
        meta={meta}
        actions={
          <>
            {main}
            {items.length ? <Menu label={t('ui.admin-programs.common.moreActions')} items={items} /> : null}
          </>
        }
        notice={notice}
        tabs={tabs}
        activeTab={active}
        basePath={promoterPath(p.id)}
        aside={active === 'historique' || active === 'relation' ? undefined : aside}
      >
        {active === 'identite' ? <PromoterIdentity p={p} /> : null}
        {active === 'contacts' ? <PromoterContacts p={p} /> : null}
        {active === 'selection' ? <PromoterVetting p={p} /> : null}
        {active === 'convention' && p.can.convention ? <PromoterConvention p={p} /> : null}
        {active === 'documents' ? <PromoterDocuments p={p} /> : null}
        {active === 'page-publique' ? <PromoterPublicPage p={p} webUrl={webUrl} /> : null}
        {active === 'programmes' ? <PromoterPrograms p={p} /> : null}
        {active === 'relation' ? <PromoterRelation promoterId={p.id} /> : null}
        {active === 'historique' ? <Timeline endpoint={`/admin/promoters/${p.id}/timeline`} entity={{ type: 'PROMOTER', id: p.id }} types={['RECORD', 'EMAIL', 'NOTE']} /> : null}
      </DetailPage>

      {/* CTL-004 « Sélectionner » — needs the selection date and the convention's signature date. */}
      <ConfirmDialog
        open={dialog === 'select'}
        title={t('ui.admin-promoters.dialog.select.title', { nom: p.name })}
        text={t('ui.admin-promoters.dialog.select.text')}
        submit={t('ui.admin-promoters.dialog.select.submit')}
        call={() => adminCall(`/admin/promoters/${p.id}/activate`, { body: { version: p.version } })}
        success={t('ui.admin-promoters.toast.selected')}
        onClose={close}
        onDone={() => (close(), refresh())}
      >
        {!p.vettedAt || !p.conventionSignedAt ? (
          <>
            <p className={s.muted}>{t('ui.admin-promoters.dialog.select.missing')}</p>
            <MissingList codes={[...(p.vettedAt ? [] : ['VETTED_AT']), ...(p.conventionSignedAt ? [] : ['CONVENTION_SIGNED'])]} />
          </>
        ) : null}
      </ConfirmDialog>
      {dialog === 'suspend' || dialog === 'end' ? <StatusDialog p={p} kind={dialog} onClose={close} onDone={() => (close(), refresh())} /> : null}
      <ConfirmDialog
        open={dialog === 'resume'}
        title={t('ui.admin-promoters.dialog.resume.title', { nom: p.name })}
        text={t('ui.admin-promoters.dialog.resume.text')}
        submit={t('ui.admin-promoters.dialog.resume.submit')}
        call={() => adminCall(`/admin/promoters/${p.id}/resume`, { body: { version: p.version } })}
        success={t('ui.admin-promoters.toast.resumed')}
        onClose={close}
        onDone={() => (close(), refresh())}
      />
      <ConfirmDialog
        open={dialog === 'reactivate'}
        title={t('ui.admin-promoters.dialog.reactivate.title', { nom: p.name })}
        text={t('ui.admin-promoters.dialog.reactivate.text')}
        submit={t('ui.admin-promoters.dialog.reactivate.submit')}
        call={() => adminCall(`/admin/promoters/${p.id}/activate`, { body: { version: p.version } })}
        success={t('ui.admin-promoters.toast.reactivated')}
        onClose={close}
        onDone={() => (close(), refresh())}
      />
      <ConfirmDialog<RepublishResult>
        open={dialog === 'republish'}
        title={t('ui.admin-promoters.dialog.republish.title', { nom: p.name })}
        text={t('ui.admin-promoters.dialog.republish.text')}
        submit={t('ui.admin-promoters.dialog.republish.submit')}
        call={() => adminCall<RepublishResult>(`/admin/promoters/${p.id}/republish`, { method: 'POST' })}
        onClose={close}
        onDone={(r) => {
          close();
          toast({ text: t('ui.admin-promoters.dialog.republish.done', { n: r.republished }) });
          if (r.blocked.length) toast({ tone: 'info', text: `${t('ui.admin-promoters.dialog.republish.blocked')} ${r.blocked.map((b) => b.label).join(', ')}` });
          refresh();
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={t('ui.admin-promoters.dialog.delete.title', { nom: p.name })}
        text={t('ui.admin-promoters.dialog.delete.text')}
        submit={t('ui.admin-promoters.dialog.delete.submit')}
        danger
        call={() => adminCall(`/admin/promoters/${p.id}`, { method: 'DELETE' })}
        success={t('ui.admin-promoters.toast.deleted')}
        onClose={close}
        onDone={() => (close(), router.push('/promoteurs'))}
      />
    </>
  );
}

/** CTL-004 « Suspendre » / « Terminer » — the effects announced with numbers BEFORE confirming (MOD-110), a reason required. */
function StatusDialog({ p, kind, onClose, onDone }: { p: AdminPromoterDetail; kind: 'suspend' | 'end'; onClose: () => void; onDone: () => void }) {
  const [impact, setImpact] = useState<PromoterImpact | null>(null);
  const [reason, setReason] = useState('');
  const { pending, failure, errors, run } = useCall();
  useEffect(() => {
    void adminCall<PromoterImpact>(`/admin/promoters/${p.id}/impact`).then((r) => r.ok && setImpact(r.data));
  }, [p.id]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => adminCall(`/admin/promoters/${p.id}/${kind}`, { body: { reason, version: p.version } }), t(kind === 'suspend' ? 'ui.admin-promoters.toast.suspended' : 'ui.admin-promoters.toast.ended'));
    if (ok !== null) onDone();
  }
  return (
    <Modal open onClose={onClose} title={t(`ui.admin-promoters.dialog.${kind}.title`, { nom: p.name })} closeLabel={t('ui.common.close')} width={560}>
      <form className={f.form} onSubmit={submit} noValidate>
        <FailureBanner failure={failure} />
        {impact ? (
          <Banner tone="warning">
            <p>
              <strong>{t('ui.admin-promoters.dialog.effects', { p: impact.programs, b: impact.properties })}</strong> {t('ui.admin-promoters.dialog.dossiers', { n: impact.openDossiers })}
            </p>
          </Banner>
        ) : null}
        <p className={s.muted}>{t('ui.admin-promoters.dialog.keep')}</p>
        <TextArea label={t('ui.admin-promoters.dialog.reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} error={errors.reason} hint={t('ui.admin-promoters.dialog.reasonHint')} autoFocus />
        <DialogButtons close={onClose} pending={pending} label={t(`ui.admin-promoters.dialog.${kind}.submit`)} danger disabled={!reason.trim() || !impact} />
      </form>
    </Modal>
  );
}

