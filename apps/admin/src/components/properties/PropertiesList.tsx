'use client';
// EA-42 — the properties (CTL-040). Columns: Référence · Titre · Programme · Promoteur · Région · Type · Pièces · Surface
// · Prix à partir de (currency of the property and reference currency) · Lots disponibles / total · Disponibilité ·
// Publication · Complétude · Vues · Intérêts · Modifié le. Origin views « Publiés » · « Brouillons » · « À compléter »
// (published, score under `catalogue.completeScore`) · « Sans photo réelle » · « Réservés et vendus » · « Archivés » ·
// « Tous », with their counts; filters with their counts. Paged, sorted and counted by the server.
import Link from 'next/link';
import { AVAILABILITIES, DELIVERY_STATUSES, PROPERTY_TYPES, PROPERTY_VIEWS, PUBLICATION_STATUSES, STANDINGS, type PropertyList, type PropertyListItem } from '@dp/contracts';
import { StatusTag } from '@dp/ui';
import { DASH, shortDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { AVAILABILITY_TONE, PUBLICATION_TONE } from '@/lib/tones';
import { ListPage, type ListColumn } from '../shell/list/ListPage';
import { useShell } from '../shell/ShellContext';
import { useCatalogueReference } from '../catalogue/reference';
import { catalogueStyles as s, LinkButton, moneyOr, StockMeter, Thumb } from '../catalogue/parts';
import { CompletenessPill } from './CompletenessPill';

export const propertyPath = (id: string) => `/catalogue/biens/${id}`;

export function PropertiesList() {
  const { can, timeZone } = useShell();
  const ref = useCatalogueReference();
  const min = ref?.settings.publishMinScore ?? 60;
  const complete = ref?.settings.completeScore ?? 85;
  const create = can('catalogue.write') ? (
    <LinkButton href="/catalogue/biens/nouveau" icon="plus">
      {t('ui.admin-properties.create')}
    </LinkButton>
  ) : undefined;

  const columns: ListColumn<PropertyListItem>[] = [
    {
      key: 'reference',
      header: t('ui.admin-properties.column.reference'),
      fixed: true,
      sortable: true,
      width: '18rem',
      text: (p) => p.title,
      cell: (p) => (
        <span className={s.nameCell}>
          <Thumb image={p.cover} />
          <span className={s.nameText}>
            <Link href={propertyPath(p.id)} className={s.nameLink}>
              {p.title}
            </Link>
            <span className={s.sub}>
              {p.reference}
              {p.featuredRank ? ` · ${t('ui.admin-properties.pinned', { n: p.featuredRank })}` : ''}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'program',
      header: t('ui.admin-properties.column.program'),
      text: (p) => p.program?.name ?? null,
      cell: (p) =>
        p.program ? (
          <Link href={`/catalogue/programmes/${p.program.id}`} className={s.sub}>
            {p.program.name}
          </Link>
        ) : (
          <span className={s.muted}>{t('ui.admin-properties.standalone')}</span>
        ),
    },
    { key: 'promoter', header: t('ui.admin-properties.column.promoter'), hiddenByDefault: true, cell: (p) => p.promoter.name, text: (p) => p.promoter.name },
    { key: 'region', header: t('ui.admin-properties.column.region'), cell: (p) => p.region },
    { key: 'type', header: t('ui.admin-properties.column.type'), cell: (p) => t(`ui.enum.PropertyType.${p.type}`) },
    { key: 'rooms', header: t('ui.admin-properties.column.rooms'), align: 'end', hiddenByDefault: true, cell: (p) => <span className={s.num}>{p.rooms ?? DASH}</span> },
    { key: 'surfaceM2', header: t('ui.admin-properties.column.surface'), sortable: true, align: 'end', cell: (p) => <span className={s.num}>{`${Number(p.surfaceM2).toLocaleString('fr-FR')} m²`}</span> },
    {
      key: 'priceFrom',
      header: t('ui.admin-properties.column.priceFrom'),
      sortable: true,
      align: 'end',
      cell: (p) => (
        <span className={s.nameText} style={{ textAlign: 'end' }}>
          <strong className={s.num}>{moneyOr(p.priceFrom, p.currency)}</strong>
          {p.priceFromRef && p.currency !== p.referenceCurrency ? <span className={s.sub}>{t('ui.admin-programs.common.equivalent', { montant: moneyOr(p.priceFromRef, p.referenceCurrency) })}</span> : null}
        </span>
      ),
    },
    { key: 'lots', header: t('ui.admin-properties.column.lots'), cell: (p) => <StockMeter available={p.lotsAvailable} total={p.lotsTotal} compact /> },
    { key: 'availability', header: t('ui.admin-properties.column.availability'), cell: (p) => <StatusTag tone={AVAILABILITY_TONE[p.availability] ?? 'neutral'}>{t(`ui.enum.Availability.${p.availability}`)}</StatusTag> },
    { key: 'publication', header: t('ui.admin-properties.column.publication'), cell: (p) => <StatusTag tone={PUBLICATION_TONE[p.publication] ?? 'neutral'}>{t(`ui.enum.PublicationStatus.${p.publication}`)}</StatusTag> },
    { key: 'completenessScore', header: t('ui.admin-properties.column.completeness'), sortable: true, cell: (p) => <CompletenessPill score={p.completenessScore} min={min} complete={complete} /> },
    { key: 'viewCount', header: t('ui.admin-properties.column.views'), sortable: true, align: 'end', hiddenByDefault: true, cell: (p) => <span className={s.num}>{p.viewCount}</span> },
    { key: 'interestCount', header: t('ui.admin-properties.column.interests'), sortable: true, align: 'end', hiddenByDefault: true, cell: (p) => <span className={s.num}>{p.interestCount}</span> },
    { key: 'updatedAt', header: t('ui.admin-properties.column.updatedAt'), sortable: true, firstDir: 'desc', cell: (p) => <span className={s.num}>{shortDate(p.updatedAt, timeZone)}</span> },
  ];

  return (
    <ListPage<PropertyListItem, PropertyList>
      listKey="properties"
      endpoint="/admin/properties"
      header={{ title: t('ui.admin-properties.title'), crumbs: [{ label: t('ui.admin-shell.menu.group.catalogue') }, { label: t('ui.admin-properties.title') }], intro: t('ui.admin-properties.intro'), actions: create }}
      columns={columns}
      rowId={(p) => p.id}
      rowLabel={(p) => p.reference}
      rowHref={(p) => propertyPath(p.id)}
      defaultSort={{ key: 'updatedAt', dir: 'desc' }}
      defaultView="all"
      searchPlaceholder={t('ui.admin-properties.search')}
      originViews={(r) => PROPERTY_VIEWS.map((key) => ({ key, label: t(`ui.admin-properties.view.${key}`), count: r?.views[key] ?? null, query: { view: key } }))}
      filters={(r) => [
        { key: 'programId', label: t('ui.admin-properties.column.program'), kind: 'options', options: (r?.programs ?? []).map((p) => ({ value: p.id, label: p.name, count: r?.facets.programId[p.id] ?? 0 })) },
        { key: 'type', label: t('ui.admin-properties.column.type'), kind: 'options', options: PROPERTY_TYPES.map((v) => ({ value: v, label: t(`ui.enum.PropertyType.${v}`), count: r?.facets.type[v] ?? 0 })) },
        { key: 'availability', label: t('ui.admin-properties.column.availability'), kind: 'options', options: AVAILABILITIES.map((v) => ({ value: v, label: t(`ui.enum.Availability.${v}`), count: r?.facets.availability[v] ?? 0 })) },
        { key: 'regionId', label: t('ui.admin-properties.column.region'), kind: 'options', options: (r?.regions ?? []).map((x) => ({ value: x.id, label: x.name, count: r?.facets.regionId[x.id] ?? 0 })) },
        { key: 'promoterId', label: t('ui.admin-properties.column.promoter'), kind: 'options', rare: true, options: (r?.promoters ?? []).map((p) => ({ value: p.id, label: p.name, count: r?.facets.promoterId[p.id] ?? 0 })) },
        { key: 'publication', label: t('ui.admin-properties.column.publication'), kind: 'options', rare: true, options: PUBLICATION_STATUSES.map((v) => ({ value: v, label: t(`ui.enum.PublicationStatus.${v}`), count: r?.facets.publication[v] ?? 0 })) },
        { key: 'standing', label: t('ui.admin-programs.column.standing'), kind: 'options', rare: true, options: STANDINGS.map((v) => ({ value: v, label: t(`ui.enum.Standing.${v}`), count: r?.facets.standing[v] ?? 0 })) },
        { key: 'deliveryStatus', label: t('ui.admin-properties.filter.deliveryStatus'), kind: 'options', rare: true, options: DELIVERY_STATUSES.map((v) => ({ value: v, label: t(`ui.enum.DeliveryStatus.${v}`), count: r?.facets.deliveryStatus[v] ?? 0 })) },
        {
          key: 'kind',
          label: t('ui.admin-properties.filter.kind'),
          kind: 'options',
          single: true,
          rare: true,
          options: [
            { value: 'typology', label: t('ui.admin-properties.filter.typology'), count: r?.facets.kind.typology ?? 0 },
            { value: 'standalone', label: t('ui.admin-properties.filter.standalone'), count: r?.facets.kind.standalone ?? 0 },
          ],
        },
      ]}
      empty={{ title: t('ui.admin-properties.empty.title'), text: t('ui.admin-properties.empty.text'), actions: create }}
    />
  );
}
