'use client';
// EA-41 — one programme (CTL-021 … CTL-024). Header: state, promoter, place, delivery; ONE main action that follows the
// state (a draft: « Publier »; online: « Ajouter une typologie »; archived: « Désarchiver ») and the other actions in
// « ⋯ » (greyed with their reason when impossible, BO-047). What publishing lacks and an availability check due are
// said at the top. Tabs: Informations · Biens · Lots · Médias · Financement · Chantier · À proximité · Dossiers ·
// Historique (`?onglet=`). The right column gives the important figures first: stock, prices, delivery, publication.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminProgramDetail } from '@dp/contracts';
import { Banner, Button, Icon, Menu, StatusTag, useToast, type MenuItem } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { shortDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { PUBLICATION_TONE } from '@/lib/tones';
import { DetailPage } from '../shell/detail/DetailPage';
import { Facts, Surface } from '../shell/Page';
import { isDeliveredPath } from '../shell/menu';
import { signalShellChanged, useShell } from '../shell/ShellContext';
import { Timeline } from '../shell/timeline/Timeline';
import { Checkbox } from '../shell/forms';
import { CatalogueDossiersTab } from '../catalogue/CatalogueDossiersTab';
import { FinancingTab } from '../catalogue/FinancingTab';
import { PoiEditor } from '../catalogue/PoiEditor';
import { useCatalogueReference } from '../catalogue/reference';
import { catalogueStyles as s, ConfirmDialog, deliveryLabel, LinkButton, MissingList, moneyOr, pickTab, StockMeter, Thumb } from '../catalogue/parts';
import { LotsTable } from '../lots/LotsTable';
import { StockCheck } from '../lots/StockCheck';
import { MediaManager } from '../media/MediaManager';
import { ConstructionTab } from './ConstructionTab';
import { ProgramInfo } from './ProgramInfo';
import { ProgramProperties } from './ProgramProperties';
import { programPath } from './ProgramsList';

type Dialog = 'publish' | 'unpublish' | 'archive' | 'unarchive' | 'duplicate' | 'delete' | 'missing' | 'regenerate' | null;

export function ProgramView({ program, tab, webUrl }: { program: AdminProgramDetail; tab?: string; webUrl: string }) {
  const p = program;
  const router = useRouter();
  const ref = useCatalogueReference();
  const { timeZone } = useShell();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [withProperties, setWithProperties] = useState(true);
  const refresh = () => router.refresh();
  const close = () => setDialog(null);
  const toast = useToast();

  // NOT-032 — opening the record marks its notifications read.
  useEffect(() => {
    void adminCall('/admin/notifications/read', { body: { entityType: 'Program', entityId: p.id } }).then((r) => {
      if (r.ok) signalShellChanged();
    });
  }, [p.id]);

  const banks = ref?.banks.length ?? 0;
  const features = ref?.settings;
  const tabs = [
    { key: 'informations', label: t('ui.admin-programs.detail.tab.info') },
    { key: 'biens', label: t('ui.admin-programs.detail.tab.properties'), count: p.counts.properties },
    { key: 'lots', label: t('ui.admin-programs.detail.tab.lots'), count: p.counts.lots },
    { key: 'medias', label: t('ui.admin-programs.detail.tab.media'), count: p.counts.media },
    ...(banks > 0 ? [{ key: 'financement', label: t('ui.admin-programs.detail.tab.financing') }] : []),
    ...(features?.constructionProgress !== false ? [{ key: 'chantier', label: t('ui.admin-programs.detail.tab.works'), count: p.counts.updates }] : []),
    ...(features?.poi !== false ? [{ key: 'a-proximite', label: t('ui.admin-programs.detail.tab.nearby'), count: p.counts.pois }] : []),
    { key: 'dossiers', label: t('ui.admin-programs.detail.tab.dossiers'), count: p.counts.dossiers },
    { key: 'historique', label: t('ui.admin-programs.detail.tab.history') },
  ];
  const active = pickTab(tab, tabs.map((x) => x.key));
  const promoterHref = `/promoteurs/${p.promoter.id}`;
  const addProperty = `/catalogue/biens/nouveau?programme=${p.id}`;

  // ─── Actions (CTL-024) ────────────────────────────────────────────────
  const publishable = p.publicationMissing.length === 0;
  const main =
    p.publication === 'DRAFT' && p.can.publish ? (
      <Button variant="tool" size="M" icon="send" onClick={() => setDialog(publishable ? 'publish' : 'missing')}>
        {t('ui.admin-programs.action.publish')}
      </Button>
    ) : p.publication === 'ARCHIVED' && p.can.publish ? (
      <Button variant="tool" size="M" onClick={() => setDialog('unarchive')}>
        {t('ui.admin-programs.action.unarchive')}
      </Button>
    ) : p.publication !== 'ARCHIVED' && p.can.write ? (
      <LinkButton href={addProperty} icon="plus">
        {t('ui.admin-programs.action.addProperty')}
      </LinkButton>
    ) : null;
  // FIC-120 — « Aperçu » of a programme that is not online: its public page by a link signed for one hour
  const openPreview = async () => {
    const r = await adminCall<{ url: string }>(`/admin/programs/${p.id}/preview-link`, { method: 'POST' });
    if (r.ok) window.open(r.data.url, '_blank', 'noopener');
    else toast({ tone: 'error', text: errorText(r) });
  };
  const items: MenuItem[] = [
    ...(p.publication !== 'PUBLISHED' ? [{ key: 'preview', label: t('ui.admin-programs.action.preview'), icon: 'eye' as const, onSelect: () => void openPreview() }] : []),
    ...(p.publicPath ? [{ key: 'open', label: t('ui.admin-programs.common.openPublic'), icon: 'external-link' as const, onSelect: () => window.open(`${webUrl}${p.publicPath}`, '_blank', 'noopener') }] : []),
    ...(p.publication === 'DRAFT' && p.can.write && p.can.publish ? [{ key: 'add', label: t('ui.admin-programs.action.addProperty'), icon: 'plus' as const, href: addProperty }] : []),
    ...(p.publication === 'PUBLISHED' && p.can.publish ? [{ key: 'unpublish', label: t('ui.admin-programs.action.unpublish'), onSelect: () => setDialog('unpublish') }] : []),
    ...(p.publication !== 'ARCHIVED' && p.can.publish ? [{ key: 'archive', label: t('ui.admin-programs.action.archive'), icon: 'folder' as const, onSelect: () => setDialog('archive') }] : []),
    ...(p.publication === 'ARCHIVED' && p.can.publish ? [{ key: 'republish', label: t('ui.admin-programs.action.republish'), onSelect: () => setDialog(publishable ? 'publish' : 'missing') }] : []),
    // TRV-052 — « Régénérer l'adresse » after a change of name: the old address redirects (301)
    ...(p.can.write ? [{ key: 'regenerate', label: t('ui.admin-programs.action.regenerate'), icon: 'globe' as const, onSelect: () => setDialog('regenerate') }] : []),
    ...(p.can.write ? [{ key: 'duplicate', label: t('ui.admin-programs.action.duplicate'), icon: 'copy' as const, onSelect: () => setDialog('duplicate'), separated: true }] : []),
    ...(p.can.delete
      ? [{ key: 'delete', label: t('ui.admin-programs.action.delete'), icon: 'trash' as const, danger: true, onSelect: () => setDialog('delete'), disabledReason: p.counts.properties > 0 ? t('ui.admin-programs.action.deleteBlocked', { n: p.counts.properties }) : null }]
      : []),
  ];

  const meta = (
    <>
      <StatusTag tone={PUBLICATION_TONE[p.publication] ?? 'neutral'}>{t(`ui.enum.PublicationStatus.${p.publication}`)}</StatusTag>
      {isDeliveredPath(promoterHref) ? (
        <Link href={promoterHref} className={s.nameLink}>
          {p.promoter.name}
        </Link>
      ) : (
        <span>{p.promoter.name}</span>
      )}
      <span>{[p.city, p.region].filter(Boolean).join(', ')}</span>
      <span>{t(`ui.enum.Standing.${p.standing}`)}</span>
    </>
  );

  const notice =
    p.publication === 'DRAFT' && !publishable ? (
      <Banner tone="info" title={t('ui.admin-programs.common.missing.title')}>
        <MissingList codes={p.publicationMissing} />
      </Banner>
    ) : p.stock.state === 'DUE' ? (
      <Banner tone="warning" title={t('ui.admin-programs.stock.due')}>
        <p>{p.stock.confirmedAt ? t('ui.admin-programs.stock.verifiedNoOne', { date: shortDate(p.stock.confirmedAt, timeZone) }) : t('ui.admin-programs.stock.never')}</p>
        <Link href={`${programPath(p.id)}?onglet=lots`} className={s.nameLink}>
          {t('ui.admin-programs.detail.tab.lots')} →
        </Link>
      </Banner>
    ) : null;

  const aside = (
    <>
      <Surface>
        <div className={s.asideHero}>
          {p.cover ? <Thumb image={p.cover} size="L" /> : null}
          <div className={s.kpis}>
            <div className={s.kpi}>
              <StockMeter available={p.lotsAvailable} total={p.lotsTotal} large />
              <span className={s.kpiLabel}>{t('ui.admin-programs.detail.aside.stock')}</span>
            </div>
            <div className={s.kpi}>
              <span className={s.kpiValue}>{moneyOr(p.priceFrom, p.currency)}</span>
              <span className={s.kpiLabel}>
                {t('ui.admin-programs.detail.aside.priceFrom')}
              </span>
              {p.priceFromRef && p.currency !== p.referenceCurrency ? <span className={s.note}>{t('ui.admin-programs.common.equivalent', { montant: moneyOr(p.priceFromRef, p.referenceCurrency) })}</span> : null}
            </div>
            <div className={s.kpi}>
              <span className={s.kpiValue}>{p.lotsHeld}</span>
              <span className={s.kpiLabel}>{t('ui.admin-programs.detail.aside.held')}</span>
            </div>
            <div className={s.kpi}>
              <span className={s.kpiValue}>{p.lotsSold}</span>
              <span className={s.kpiLabel}>{t('ui.admin-programs.detail.aside.sold')}</span>
            </div>
          </div>
          <p className={s.note}>{t('ui.admin-programs.detail.aside.publicStock')}</p>
        </div>
      </Surface>
      <Surface title={t('ui.admin-programs.detail.publishCard.title')}>
        <div className={s.publishBox}>
          <span>
            {p.publication === 'PUBLISHED'
              ? t('ui.admin-programs.detail.publishCard.published', { date: shortDate(p.publishedAt, timeZone) })
              : p.publication === 'ARCHIVED'
                ? t('ui.admin-programs.detail.publishCard.archived')
                : t('ui.admin-programs.detail.publishCard.draft')}
          </span>
          {p.publication !== 'PUBLISHED' ? (
            publishable ? (
              <span className={s.ok}>
                <Icon name="status-success" size={16} />
                {t('ui.admin-programs.common.readyToPublish')}
              </span>
            ) : (
              <MissingList codes={p.publicationMissing} />
            )
          ) : null}
        </div>
      </Surface>
      <Surface title={t('ui.admin-programs.detail.aside.title')}>
        <Facts
          items={[
            { label: t('ui.admin-programs.detail.aside.promoter'), value: p.promoter.name },
            {
              label: t('ui.admin-programs.detail.aside.delivery'),
              value: p.deliveryLate ? (
                <span className={s.late}>
                  <Icon name="status-warning" size={16} />
                  {deliveryLabel(p.deliveryStatus, p.deliveryDate, p.deliveryDatePrecision)}
                </span>
              ) : (
                deliveryLabel(p.deliveryStatus, p.deliveryDate, p.deliveryDatePrecision)
              ),
            },
            { label: t('ui.admin-programs.detail.aside.createdAt'), value: shortDate(p.createdAt, timeZone) },
          ]}
        />
      </Surface>
    </>
  );

  return (
    <>
      <DetailPage
        crumbs={[{ label: t('ui.admin-shell.menu.group.catalogue') }, { label: t('ui.admin-programs.title'), href: '/catalogue/programmes' }, { label: p.name }]}
        title={p.name}
        meta={meta}
        actions={
          <>
            {main}
            {items.length ? <Menu label={t('ui.admin-programs.common.moreActions')} items={items} renderLink={(item, props) => <Link href={item.href!} {...props} />} /> : null}
          </>
        }
        notice={notice}
        tabs={tabs}
        activeTab={active}
        basePath={programPath(p.id)}
        aside={active === 'informations' || active === 'biens' ? aside : undefined}
      >
        {active === 'informations' ? <ProgramInfo program={p} webUrl={webUrl} /> : null}
        {active === 'biens' ? <ProgramProperties program={p} /> : null}
        {active === 'lots' ? (
          <>
            <StockCheck scope={{ programId: p.id }} canWrite={p.can.write} stock={p.stock} onChanged={refresh} />
            <LotsTable scope={{ programId: p.id }} canWrite={p.can.write} canImport={p.can.import} onChanged={refresh} />
          </>
        ) : null}
        {active === 'medias' ? <MediaManager ownerType="PROGRAM" ownerId={p.id} ownerLabel={p.name} canWrite={p.can.write} onChanged={refresh} /> : null}
        {active === 'financement' ? <FinancingTab scope={{ programId: p.id }} canManage={p.can.eligibility} onChanged={refresh} /> : null}
        {active === 'chantier' ? <ConstructionTab programId={p.id} canWrite={p.can.write} onChanged={refresh} /> : null}
        {active === 'a-proximite' ? <PoiEditor scope={{ programId: p.id }} canWrite={p.can.write} /> : null}
        {active === 'dossiers' ? <CatalogueDossiersTab endpoint={`/admin/programs/${p.id}/dossiers`} /> : null}
        {active === 'historique' ? <Timeline endpoint={`/admin/programs/${p.id}/timeline`} entity={{ type: 'PROGRAM', id: p.id }} types={['RECORD', 'NOTE']} /> : null}
      </DetailPage>

      {/* CYC-125, CYC-126 — publish (or republish), with the properties that left with it */}
      <ConfirmDialog
        open={dialog === 'publish'}
        title={t('ui.admin-programs.dialog.publish.title', { nom: p.name })}
        text={t('ui.admin-programs.dialog.publish.text')}
        submit={t('ui.admin-programs.dialog.publish.submit')}
        call={() => adminCall(`/admin/programs/${p.id}/publish`, { body: { republishProperties: p.cascade.unpublished + p.cascade.archived > 0 && withProperties } })}
        success={t('ui.admin-programs.toast.published')}
        onClose={close}
        onDone={() => (close(), refresh())}
      >
        {p.cascade.unpublished + p.cascade.archived > 0 ? (
          <Checkbox label={t('ui.admin-programs.dialog.publish.withProperties', { n: p.cascade.unpublished + p.cascade.archived })} checked={withProperties} onChange={setWithProperties} />
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'missing'}
        title={t('ui.admin-programs.dialog.notPublishable.title', { nom: p.name })}
        text={t('ui.admin-programs.dialog.notPublishable.text')}
        submit={t('ui.common.close')}
        call={async () => ({ ok: true as const, status: 200, data: true })}
        onClose={close}
        onDone={close}
      >
        <MissingList codes={p.publicationMissing} />
        <p className={s.muted}>{t('ui.admin-programs.common.missingHint')}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'regenerate'}
        title={t('ui.admin-programs.dialog.regenerate.title', { nom: p.name })}
        text={t('ui.admin-programs.dialog.regenerate.text', { adresse: `${webUrl}/programmes/${p.slug}` })}
        submit={t('ui.admin-programs.dialog.regenerate.submit')}
        call={() => adminCall<{ slug: string }>(`/admin/programs/${p.id}/regenerate-slug`, { method: 'POST' })}
        onClose={close}
        onDone={(r) => {
          close();
          toast({ text: r.slug === p.slug ? t('ui.admin-programs.toast.slugSame') : t('ui.admin-programs.toast.slugRegenerated', { adresse: `/programmes/${r.slug}` }) });
          refresh();
        }}
      />
      <ConfirmDialog
        open={dialog === 'unpublish'}
        title={t('ui.admin-programs.dialog.unpublish.title', { nom: p.name })}
        text={t('ui.admin-programs.dialog.unpublish.text', { n: p.properties.filter((x) => x.publication === 'PUBLISHED').length })}
        submit={t('ui.admin-programs.dialog.unpublish.submit')}
        danger
        call={() => adminCall(`/admin/programs/${p.id}/unpublish`, { method: 'POST' })}
        success={t('ui.admin-programs.toast.unpublished')}
        onClose={close}
        onDone={() => (close(), refresh())}
      />
      <ConfirmDialog
        open={dialog === 'archive'}
        title={t('ui.admin-programs.dialog.archive.title', { nom: p.name })}
        text={t('ui.admin-programs.dialog.archive.text', { n: p.archiveImpact.properties })}
        submit={t('ui.admin-programs.dialog.archive.submit')}
        danger
        call={() => adminCall(`/admin/programs/${p.id}/archive`, { method: 'POST' })}
        success={t('ui.admin-programs.toast.archived')}
        onClose={close}
        onDone={() => (close(), refresh())}
      >
        {p.archiveImpact.openDossiers > 0 ? (
          <Banner tone="warning">
            <p>{t('ui.admin-programs.dialog.archive.dossiers', { n: p.archiveImpact.openDossiers })}</p>
          </Banner>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'unarchive'}
        title={t('ui.admin-programs.dialog.unarchive.title', { nom: p.name })}
        text={t('ui.admin-programs.dialog.unarchive.text')}
        submit={t('ui.admin-programs.dialog.unarchive.submit')}
        call={() => adminCall(`/admin/programs/${p.id}/unarchive`, { body: { unarchiveProperties: p.cascade.archived > 0 && withProperties } })}
        success={t('ui.admin-programs.toast.unarchived')}
        onClose={close}
        onDone={() => (close(), refresh())}
      >
        {p.cascade.archived > 0 ? <Checkbox label={t('ui.admin-programs.dialog.unarchive.withProperties', { n: p.cascade.archived })} checked={withProperties} onChange={setWithProperties} /> : null}
      </ConfirmDialog>
      <ConfirmDialog<{ id: string }>
        open={dialog === 'duplicate'}
        title={t('ui.admin-programs.dialog.duplicate.title', { nom: p.name })}
        text={t('ui.admin-programs.dialog.duplicate.text', { nom: p.name })}
        submit={t('ui.admin-programs.dialog.duplicate.submit')}
        call={() => adminCall<{ id: string }>(`/admin/programs/${p.id}/duplicate`, { method: 'POST' })}
        success={t('ui.admin-programs.toast.duplicated')}
        onClose={close}
        onDone={(d) => (close(), router.push(programPath(d.id)))}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={t('ui.admin-programs.dialog.delete.title', { nom: p.name })}
        text={t('ui.admin-programs.dialog.delete.text')}
        submit={t('ui.admin-programs.dialog.delete.submit')}
        danger
        call={() => adminCall(`/admin/programs/${p.id}`, { method: 'DELETE' })}
        success={t('ui.admin-programs.toast.deleted')}
        onClose={close}
        onDone={() => (close(), router.push('/catalogue/programmes'))}
      />
    </>
  );
}
