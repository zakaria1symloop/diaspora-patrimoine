'use client';
// EA-43 — one property (CTL-042 … CTL-045). Header: reference, publication and availability, programme (link) or
// « Bien isolé », place; ONE main action following the state (draft: « Publier », active when CYC-120 is met; online:
// « Voir sur le site »; archived: « Désarchiver ») and the others in « ⋯ ». The completeness card (CTL-043) stays on the
// right of every tab. Tabs: Informations · Lots (a typology) · Médias · Financement · À proximité · Demandes et dossiers
// · Historique. A standalone property has no lots table: its single lot is in « Informations » (CTL-063).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminPropertyDetail } from '@dp/contracts';
import { Banner, Button, Icon, Menu, StatusTag, type MenuItem } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { shortDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { AVAILABILITY_TONE, PUBLICATION_TONE } from '@/lib/tones';
import { DetailPage } from '../shell/detail/DetailPage';
import { Facts, Surface } from '../shell/Page';
import { signalShellChanged, useShell } from '../shell/ShellContext';
import { Timeline } from '../shell/timeline/Timeline';
import { Checkbox } from '../shell/forms';
import { CatalogueDossiersTab } from '../catalogue/CatalogueDossiersTab';
import { FinancingTab } from '../catalogue/FinancingTab';
import { PoiEditor } from '../catalogue/PoiEditor';
import { useCatalogueReference } from '../catalogue/reference';
import { catalogueStyles as s, ConfirmDialog, MissingList, moneyOr, pickTab, StockMeter } from '../catalogue/parts';
import { LotsTable } from '../lots/LotsTable';
import { StockCheck } from '../lots/StockCheck';
import { MediaManager } from '../media/MediaManager';
import { CompletenessCard } from './CompletenessCard';
import { propertyPath } from './PropertiesList';
import { PropertyInfo } from './PropertyInfo';

type Dialog = 'publish' | 'missing' | 'unpublish' | 'archive' | 'unarchive' | 'duplicate' | 'delete' | null;

export function PropertyView({ property, tab, webUrl }: { property: AdminPropertyDetail; tab?: string; webUrl: string }) {
  const p = property;
  const router = useRouter();
  const ref = useCatalogueReference();
  const { timeZone } = useShell();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [withLots, setWithLots] = useState(false);
  const refresh = () => router.refresh();
  const close = () => setDialog(null);

  useEffect(() => {
    void adminCall('/admin/notifications/read', { body: { entityType: 'Property', entityId: p.id } }).then((r) => {
      if (r.ok) signalShellChanged();
    });
  }, [p.id]);

  const tabs = [
    { key: 'informations', label: t('ui.admin-properties.detail.tab.info') },
    ...(p.program ? [{ key: 'lots', label: t('ui.admin-properties.detail.tab.lots'), count: p.counts.lots }] : []),
    { key: 'medias', label: t('ui.admin-properties.detail.tab.media'), count: p.counts.media },
    ...((ref?.banks.length ?? 0) > 0 ? [{ key: 'financement', label: t('ui.admin-properties.detail.tab.financing') }] : []),
    ...(ref?.settings.poi !== false ? [{ key: 'a-proximite', label: t('ui.admin-properties.detail.tab.nearby') }] : []),
    { key: 'dossiers', label: t('ui.admin-properties.detail.tab.dossiers'), count: p.counts.dossiers + p.counts.leads },
    { key: 'historique', label: t('ui.admin-properties.detail.tab.history') },
  ];
  const active = pickTab(tab, tabs.map((x) => x.key));
  const publishable = p.publicationMissing.length === 0;

  const main =
    p.publication === 'DRAFT' && p.can.publish ? (
      <Button variant="tool" size="M" icon="send" onClick={() => setDialog(publishable ? 'publish' : 'missing')}>
        {t('ui.admin-properties.action.publish')}
      </Button>
    ) : p.publication === 'ARCHIVED' && p.can.publish ? (
      <Button variant="tool" size="M" onClick={() => setDialog('unarchive')}>
        {t('ui.admin-properties.action.unarchive')}
      </Button>
    ) : p.publicPath ? (
      <Button variant="tool" size="M" icon="external-link" onClick={() => window.open(`${webUrl}${p.publicPath}`, '_blank', 'noopener')}>
        {t('ui.admin-programs.common.openPublic')}
      </Button>
    ) : null;
  const items: MenuItem[] = [
    ...(p.program ? [{ key: 'program', label: t('ui.admin-properties.action.openProgram'), icon: 'building' as const, href: `/catalogue/programmes/${p.program.id}` }] : []),
    ...(p.publication === 'PUBLISHED' && p.can.publish ? [{ key: 'unpublish', label: t('ui.admin-properties.action.unpublish'), onSelect: () => setDialog('unpublish') }] : []),
    ...(p.publication !== 'ARCHIVED' && p.can.publish ? [{ key: 'archive', label: t('ui.admin-properties.action.archive'), icon: 'folder' as const, onSelect: () => setDialog('archive') }] : []),
    ...(p.can.write && p.program?.publication !== 'ARCHIVED' ? [{ key: 'duplicate', label: t('ui.admin-properties.action.duplicate'), icon: 'copy' as const, onSelect: () => setDialog('duplicate'), separated: true }] : []),
    ...(p.can.delete ? [{ key: 'delete', label: t('ui.admin-properties.action.delete'), icon: 'trash' as const, danger: true, onSelect: () => setDialog('delete'), disabledReason: p.deleteBlocked ? t('ui.admin-properties.action.deleteBlocked') : null }] : []),
  ];

  const meta = (
    <>
      <span className={s.num}>{p.reference}</span>
      <StatusTag tone={PUBLICATION_TONE[p.publication] ?? 'neutral'}>{t(`ui.enum.PublicationStatus.${p.publication}`)}</StatusTag>
      <StatusTag tone={AVAILABILITY_TONE[p.availability] ?? 'neutral'}>{t(`ui.enum.Availability.${p.availability}`)}</StatusTag>
      {p.program ? (
        <Link href={`/catalogue/programmes/${p.program.id}`} className={s.nameLink}>
          {p.program.name}
        </Link>
      ) : (
        <span>{t('ui.admin-properties.standalone')}</span>
      )}
      <span>{[p.city, p.region].filter(Boolean).join(', ')}</span>
    </>
  );
  const notice =
    p.publication === 'DRAFT' && p.unpublishedAt ? (
      <Banner tone="info">
        <p>{t('ui.admin-properties.detail.aside.offlineSince', { date: shortDate(p.unpublishedAt, timeZone) })}</p>
      </Banner>
    ) : p.stock?.state === 'DUE' ? (
      <Banner tone="warning" title={t('ui.admin-programs.stock.due')}>
        <p>{p.stock.confirmedAt ? t('ui.admin-programs.stock.verifiedNoOne', { date: shortDate(p.stock.confirmedAt, timeZone) }) : t('ui.admin-programs.stock.never')}</p>
      </Banner>
    ) : null;

  const aside = (
    <>
      <CompletenessCard property={p} onPublish={() => setDialog('publish')} />
      <Surface title={t('ui.admin-properties.detail.aside.title')}>
        <div className={s.asideHero}>
          <div className={s.kpis}>
            <div className={s.kpi}>
              <StockMeter available={p.lotsAvailable} total={p.lotsTotal} large />
              <span className={s.kpiLabel}>{t('ui.admin-properties.detail.aside.stock')}</span>
            </div>
            <div className={s.kpi}>
              <span className={s.kpiValue}>{moneyOr(p.priceFrom, p.currency)}</span>
              <span className={s.kpiLabel}>
                {t('ui.admin-properties.detail.aside.priceFrom')}
              </span>
              {p.priceFromRef && p.currency !== p.referenceCurrency ? <span className={s.note}>{t('ui.admin-programs.common.equivalent', { montant: moneyOr(p.priceFromRef, p.referenceCurrency) })}</span> : null}
            </div>
            <div className={s.kpi}>
              <span className={s.kpiValue}>{p.viewCount}</span>
              <span className={s.kpiLabel}>{t('ui.admin-properties.detail.aside.views')}</span>
            </div>
            <div className={s.kpi}>
              <span className={s.kpiValue}>{p.interestCount}</span>
              <span className={s.kpiLabel}>{t('ui.admin-properties.detail.aside.interests')}</span>
            </div>
          </div>
          <Facts
            items={[
              { label: t('ui.admin-properties.detail.aside.promoter'), value: p.promoter.name },
              { label: t('ui.admin-properties.detail.aside.publishedAt'), value: p.publishedAt ? shortDate(p.publishedAt, timeZone) : null },
            ]}
          />
        </div>
      </Surface>
    </>
  );

  return (
    <>
      <DetailPage
        crumbs={[{ label: t('ui.admin-shell.menu.group.catalogue') }, { label: t('ui.admin-properties.title'), href: '/catalogue/biens' }, { label: p.reference }]}
        title={p.title}
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
        basePath={propertyPath(p.id)}
        aside={aside}
      >
        {active === 'informations' ? (
          <>
            {!p.program && p.stock ? <StockCheck scope={{ propertyId: p.id }} canWrite={p.can.write} stock={p.stock} onChanged={refresh} /> : null}
            <PropertyInfo property={p} webUrl={webUrl} onChanged={refresh} />
          </>
        ) : null}
        {active === 'lots' && p.program ? <LotsTable scope={{ propertyId: p.id }} canWrite={p.can.write} onChanged={refresh} /> : null}
        {active === 'medias' ? (
          <>
            {p.usesProgramPhotos ? (
              <p className={s.notice}>
                <Icon name="info" size={16} />
                {t('ui.admin-properties.detail.usesProgramPhotos')}
              </p>
            ) : null}
            <MediaManager ownerType="PROPERTY" ownerId={p.id} ownerLabel={p.title} canWrite={p.can.write} onChanged={refresh} />
          </>
        ) : null}
        {active === 'financement' ? <FinancingTab scope={{ propertyId: p.id }} canManage={p.can.eligibility} onChanged={refresh} /> : null}
        {active === 'a-proximite' ? <PoiEditor scope={{ propertyId: p.id }} canWrite={p.can.write} /> : null}
        {active === 'dossiers' ? <CatalogueDossiersTab endpoint={`/admin/properties/${p.id}/dossiers`} /> : null}
        {active === 'historique' ? <Timeline endpoint={`/admin/properties/${p.id}/timeline`} entity={{ type: 'PROPERTY', id: p.id }} types={['RECORD', 'NOTE']} /> : null}
      </DetailPage>

      <ConfirmDialog
        open={dialog === 'publish'}
        title={t('ui.admin-properties.dialog.publish.title', { nom: p.title })}
        text={t('ui.admin-properties.dialog.publish.text')}
        submit={t('ui.admin-properties.dialog.publish.submit')}
        call={() => adminCall(`/admin/properties/${p.id}/publish`, { method: 'POST' })}
        success={t('ui.admin-properties.toast.published')}
        onClose={close}
        onDone={() => (close(), refresh())}
      />
      <ConfirmDialog
        open={dialog === 'missing'}
        title={t('ui.admin-properties.dialog.notPublishable.title', { nom: p.title })}
        text={t('ui.admin-properties.dialog.notPublishable.text')}
        submit={t('ui.common.close')}
        call={async () => ({ ok: true as const, status: 200, data: true })}
        onClose={close}
        onDone={close}
      >
        <MissingList codes={p.publicationMissing} minScore={p.completeness.publishMinScore} />
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'unpublish'}
        title={t('ui.admin-properties.dialog.unpublish.title', { nom: p.title })}
        text={t('ui.admin-properties.dialog.unpublish.text')}
        submit={t('ui.admin-properties.dialog.unpublish.submit')}
        danger
        call={() => adminCall(`/admin/properties/${p.id}/unpublish`, { method: 'POST' })}
        success={t('ui.admin-properties.toast.unpublished')}
        onClose={close}
        onDone={() => (close(), refresh())}
      />
      <ConfirmDialog
        open={dialog === 'archive'}
        title={t('ui.admin-properties.dialog.archive.title', { nom: p.title })}
        text={t('ui.admin-properties.dialog.archive.text', { n: p.archiveImpact.considering, m: p.archiveImpact.selected })}
        submit={t('ui.admin-properties.dialog.archive.submit')}
        danger
        call={() => adminCall(`/admin/properties/${p.id}/archive`, { method: 'POST' })}
        success={t('ui.admin-properties.toast.archived')}
        onClose={close}
        onDone={() => (close(), refresh())}
      >
        {p.archiveImpact.considering > 0 ? <p className={s.muted}>{t('ui.admin-properties.dialog.archive.clients')}</p> : null}
        {p.featuredRank ? <p className={s.muted}>{t('ui.admin-properties.dialog.archive.pin')}</p> : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'unarchive'}
        title={t('ui.admin-properties.dialog.unarchive.title', { nom: p.title })}
        text={t('ui.admin-properties.dialog.unarchive.text')}
        submit={t('ui.admin-properties.dialog.unarchive.submit')}
        call={() => adminCall(`/admin/properties/${p.id}/unarchive`, { method: 'POST' })}
        success={t('ui.admin-properties.toast.unarchived')}
        onClose={close}
        onDone={() => (close(), refresh())}
      />
      <ConfirmDialog<{ id: string }>
        open={dialog === 'duplicate'}
        title={t('ui.admin-properties.dialog.duplicate.title', { nom: p.title })}
        text={t('ui.admin-properties.dialog.duplicate.text')}
        submit={t('ui.admin-properties.dialog.duplicate.submit')}
        call={() => adminCall<{ id: string }>(`/admin/properties/${p.id}/duplicate`, { body: { withLots } })}
        success={t('ui.admin-properties.toast.duplicated')}
        onClose={close}
        onDone={(d) => (close(), router.push(propertyPath(d.id)))}
      >
        {p.program && p.counts.lots > 0 ? <Checkbox label={t('ui.admin-properties.dialog.duplicate.withLots')} checked={withLots} onChange={setWithLots} /> : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'delete'}
        title={t('ui.admin-properties.dialog.delete.title', { nom: p.title })}
        text={t('ui.admin-properties.dialog.delete.text')}
        submit={t('ui.admin-properties.dialog.delete.submit')}
        danger
        call={() => adminCall(`/admin/properties/${p.id}`, { method: 'DELETE' })}
        success={t('ui.admin-properties.toast.deleted')}
        onClose={close}
        onDone={() => (close(), router.push('/catalogue/biens'))}
      />
    </>
  );
}

