'use client';
// EA-50 — the promoters (CTL-001). Columns: Nom · Statut · Région · Programmes · Biens publiés · Dossiers en cours · Fin
// de convention · Public. Origin views « Sélectionnés » (default) · « En discussion » · « Suspendus et terminés » ·
// « Tous », with their counts; a convention expired or expiring within 30 days is visible at a glance (AUT-073).
// « Nouveau promoteur » (CTL-002): raison sociale, nom commercial, pays → born PROSPECT, lands on its record.
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type AdminPartnerStatus, type PromoterList, type PromoterListItem, PROMOTER_VIEWS } from '@dp/contracts';
import { Button, Icon, Modal, StatusTag, type StatusTone } from '@dp/ui';
import { adminCall, newIdempotencyKey } from '@/lib/admin-client';
import { shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { ListPage, type ListColumn } from '../shell/list/ListPage';
import { useShell } from '../shell/ShellContext';
import { SelectInput, TextInput, formStyles as f } from '../shell/forms';
import { refreshCatalogueReference, useCatalogueReference } from '../catalogue/reference';
import { catalogueStyles as s, DialogButtons, FailureBanner, Thumb, useCall } from '../catalogue/parts';

export const promoterPath = (id: string) => `/promoteurs/${id}`;
export const PARTNER_STATUS_TONE: Record<AdminPartnerStatus, StatusTone> = { PROSPECT: 'info', ACTIVE: 'success', SUSPENDED: 'warning', ENDED: 'inactive' };
export const statusLabel = (s2: AdminPartnerStatus) => (s2 === 'ACTIVE' ? t('ui.enum.PartnerStatus.ACTIVE.promoter' as never) : t(`ui.enum.PartnerStatus.${s2}`));

export function ConventionCell({ date, state }: { date: string | null; state: PromoterListItem['conventionState'] }) {
  if (!date) return <span className={s.muted}>{t('ui.admin-promoters.convention.NONE')}</span>;
  if (state === 'EXPIRED' || state === 'EXPIRING')
    return (
      <span className={s.late} title={t(`ui.admin-promoters.convention.${state}`)}>
        <Icon name="status-warning" size={16} />
        {shortDay(date)}
        <span className={s.sub}>· {t(`ui.admin-promoters.convention.${state}`)}</span>
      </span>
    );
  return <span className={s.num}>{shortDay(date)}</span>;
}

export function PromotersList() {
  const { can } = useShell();
  const [creating, setCreating] = useState(false);
  const create = can('promoter.write') ? (
    <Button variant="tool" size="M" icon="plus" onClick={() => setCreating(true)}>
      {t('ui.admin-promoters.create')}
    </Button>
  ) : undefined;
  const columns: ListColumn<PromoterListItem>[] = [
    {
      key: 'name',
      header: t('ui.admin-promoters.column.name'),
      fixed: true,
      sortable: true,
      width: '18rem',
      text: (p) => p.name,
      cell: (p) => (
        <span className={s.nameCell}>
          <Thumb image={p.logo} />
          <span className={s.nameText}>
            <Link href={promoterPath(p.id)} className={s.nameLink}>
              {p.name}
            </Link>
            {p.name !== p.legalName ? <span className={s.sub}>{p.legalName}</span> : null}
          </span>
        </span>
      ),
    },
    { key: 'status', header: t('ui.admin-promoters.column.status'), cell: (p) => <StatusTag tone={PARTNER_STATUS_TONE[p.status]}>{statusLabel(p.status)}</StatusTag> },
    { key: 'region', header: t('ui.admin-promoters.column.region'), cell: (p) => p.region ?? '—' },
    { key: 'programs', header: t('ui.admin-promoters.column.programs'), align: 'end', cell: (p) => <span className={s.num}>{p.programCount}</span> },
    { key: 'published', header: t('ui.admin-promoters.column.published'), align: 'end', cell: (p) => <span className={s.num}>{p.publishedProperties}</span> },
    { key: 'dossiers', header: t('ui.admin-promoters.column.dossiers'), align: 'end', cell: (p) => <span className={s.num}>{p.openDossiers}</span> },
    { key: 'conventionExpiresAt', header: t('ui.admin-promoters.column.convention'), sortable: true, cell: (p) => <ConventionCell date={p.conventionExpiresAt} state={p.conventionState} /> },
    { key: 'public', header: t('ui.admin-promoters.column.public'), cell: (p) => (p.isPublic ? <StatusTag tone="success">{t('ui.admin-promoters.publicYes')}</StatusTag> : <span className={s.muted}>{t('ui.admin-promoters.publicNo')}</span>) },
  ];
  return (
    <>
      <ListPage<PromoterListItem, PromoterList>
        listKey="promoters"
        endpoint="/admin/promoters"
        header={{ title: t('ui.admin-promoters.title'), crumbs: [{ label: t('ui.admin-shell.menu.group.catalogue') }, { label: t('ui.admin-promoters.title') }], intro: t('ui.admin-promoters.intro'), actions: create }}
        columns={columns}
        rowId={(p) => p.id}
        rowLabel={(p) => p.name}
        rowHref={(p) => promoterPath(p.id)}
        defaultSort={{ key: 'name', dir: 'asc' }}
        defaultView="selected"
        searchPlaceholder={t('ui.admin-promoters.search')}
        originViews={(r) => PROMOTER_VIEWS.map((key) => ({ key, label: t(`ui.admin-promoters.view.${key}`), count: r?.views[key] ?? null, query: { view: key } }))}
        filters={(r) => [
          {
            key: 'convention',
            label: t('ui.admin-promoters.filter.convention'),
            kind: 'options',
            options: (['expiring', 'expired', 'none'] as const).map((v) => ({ value: v, label: t(`ui.admin-promoters.filter.${v}`), count: r?.facets.convention[v] ?? 0 })),
          },
          { key: 'regionId', label: t('ui.admin-promoters.column.region'), kind: 'options', options: (r?.regions ?? []).map((x) => ({ value: x.id, label: x.name, count: r?.facets.regionId[x.id] ?? 0 })) },
          {
            key: 'isPublic',
            label: t('ui.admin-promoters.filter.public'),
            kind: 'options',
            single: true,
            options: [
              { value: 'true', label: t('ui.admin-promoters.filter.publicYes'), count: r?.facets.isPublic.true ?? 0 },
              { value: 'false', label: t('ui.admin-promoters.filter.publicNo'), count: r?.facets.isPublic.false ?? 0 },
            ],
          },
        ]}
        empty={{ title: t('ui.admin-promoters.empty.title'), text: t('ui.admin-promoters.empty.text'), actions: create }}
      />
      {creating ? <CreatePromoterDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}

function CreatePromoterDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const ref = useCatalogueReference();
  const [key] = useState(newIdempotencyKey);
  const [v, setV] = useState({ legalName: '', brandName: '', countryCode: 'DZ' });
  const { pending, failure, errors, run } = useCall();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const created = await run(() => adminCall<{ id: string }>('/admin/promoters', { body: { legalName: v.legalName.trim(), brandName: v.brandName.trim() || null, countryCode: v.countryCode }, idempotencyKey: key }), t('ui.admin-promoters.toast.created'));
    if (created) {
      refreshCatalogueReference();
      router.push(promoterPath(created.id));
    }
  }
  return (
    <Modal open onClose={onClose} title={t('ui.admin-promoters.createDialog.title')} closeLabel={t('ui.common.close')} width={560}>
      <form className={f.form} onSubmit={submit} noValidate>
        <p className={s.muted}>{t('ui.admin-promoters.createDialog.intro')}</p>
        <FailureBanner failure={failure} />
        <TextInput label={t('ui.admin-promoters.createDialog.legalName')} value={v.legalName} onChange={(e) => setV((x) => ({ ...x, legalName: e.target.value }))} maxLength={160} error={errors.legalName} autoFocus />
        <div className={f.row}>
          <TextInput label={t('ui.admin-promoters.createDialog.brandName')} optional value={v.brandName} onChange={(e) => setV((x) => ({ ...x, brandName: e.target.value }))} maxLength={160} error={errors.brandName} />
          <SelectInput label={t('ui.admin-promoters.createDialog.country')} value={v.countryCode} onChange={(e) => setV((x) => ({ ...x, countryCode: e.target.value }))} error={errors.countryCode}>
            {(ref?.countries ?? []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </div>
        <DialogButtons close={onClose} pending={pending} label={t('ui.admin-promoters.createDialog.submit')} disabled={!v.legalName.trim()} />
      </form>
    </Modal>
  );
}
