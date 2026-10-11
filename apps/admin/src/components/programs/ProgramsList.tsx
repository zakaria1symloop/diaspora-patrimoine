'use client';
// EA-40 — the programmes (CTL-020). Columns: Nom · Promoteur · Région · Standing · Livraison · Biens · Lots disponibles /
// total · Prix à partir de · Publication · Modifié le. Origin views « Publiés » · « Brouillons » · « Archivés » · « Tous »
// with their counts; filters with their counts (promoter, region, standing, state of the works, « À surveiller »:
// availabilities to verify — AUT-079 — and deliveries past their date). Paged, sorted and counted by the server.
import Link from 'next/link';
import { DELIVERY_STATUSES, PROGRAM_VIEWS, STANDINGS, type ProgramList, type ProgramListItem } from '@dp/contracts';
import { Icon, StatusTag } from '@dp/ui';
import { shortDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { PUBLICATION_TONE } from '@/lib/tones';
import { ListPage, type ListColumn } from '../shell/list/ListPage';
import { useShell } from '../shell/ShellContext';
import { catalogueStyles as s, deliveryLabel, LinkButton, moneyOr, StockMeter, Thumb } from '../catalogue/parts';

export const programPath = (id: string) => `/catalogue/programmes/${id}`;

export function ProgramsList() {
  const { can, timeZone } = useShell();
  const columns: ListColumn<ProgramListItem>[] = [
    {
      key: 'name',
      header: t('ui.admin-programs.column.name'),
      fixed: true,
      sortable: true,
      width: '16rem',
      text: (p) => p.name,
      cell: (p) => (
        <span className={s.nameCell}>
          <Thumb image={p.cover} />
          <span className={s.nameText}>
            <Link href={programPath(p.id)} className={s.nameLink}>
              {p.name}
            </Link>
            <span className={s.sub}>{[p.city, p.region].filter(Boolean).join(', ')}</span>
          </span>
        </span>
      ),
    },
    { key: 'promoter', header: t('ui.admin-programs.column.promoter'), cell: (p) => p.promoter.name, text: (p) => p.promoter.name },
    { key: 'region', header: t('ui.admin-programs.column.region'), cell: (p) => p.region, hiddenByDefault: true },
    { key: 'standing', header: t('ui.admin-programs.column.standing'), cell: (p) => t(`ui.enum.Standing.${p.standing}`) },
    {
      key: 'deliveryDate',
      header: t('ui.admin-programs.column.delivery'),
      sortable: true,
      cell: (p) =>
        p.deliveryLate ? (
          <span className={s.late} title={t('ui.admin-programs.common.delivery.late')}>
            <Icon name="status-warning" size={16} />
            {deliveryLabel(p.deliveryStatus, p.deliveryDate, p.deliveryDatePrecision)}
          </span>
        ) : (
          <span className={s.num}>{deliveryLabel(p.deliveryStatus, p.deliveryDate, p.deliveryDatePrecision)}</span>
        ),
    },
    { key: 'properties', header: t('ui.admin-programs.column.properties'), align: 'end', cell: (p) => <span className={s.num}>{p.propertyCount}</span> },
    { key: 'lots', header: t('ui.admin-programs.column.lots'), cell: (p) => <StockMeter available={p.lotsAvailable} total={p.lotsTotal} /> },
    { key: 'priceFrom', header: t('ui.admin-programs.column.priceFrom'), sortable: true, align: 'end', cell: (p) => <span className={s.num}>{moneyOr(p.priceFrom, p.currency)}</span> },
    {
      key: 'publication',
      header: t('ui.admin-programs.column.publication'),
      cell: (p) => (
        <span className={s.tags}>
          <StatusTag tone={PUBLICATION_TONE[p.publication] ?? 'neutral'}>{t(`ui.enum.PublicationStatus.${p.publication}`)}</StatusTag>
          {p.stockCheck === 'DUE' ? (
            <StatusTag tone="warning" icon="clock">
              {t('ui.admin-programs.row.toCheck')}
            </StatusTag>
          ) : null}
        </span>
      ),
    },
    { key: 'updatedAt', header: t('ui.admin-programs.column.updatedAt'), sortable: true, firstDir: 'desc', cell: (p) => <span className={s.num}>{shortDate(p.updatedAt, timeZone)}</span> },
  ];

  return (
    <ListPage<ProgramListItem, ProgramList>
      listKey="programs"
      endpoint="/admin/programs"
      header={{
        title: t('ui.admin-programs.title'),
        crumbs: [{ label: t('ui.admin-shell.menu.group.catalogue') }, { label: t('ui.admin-programs.title') }],
        intro: t('ui.admin-programs.intro'),
        actions: can('catalogue.write') ? (
          <LinkButton href="/catalogue/programmes/nouveau" icon="plus">
            {t('ui.admin-programs.create')}
          </LinkButton>
        ) : undefined,
      }}
      columns={columns}
      rowId={(p) => p.id}
      rowLabel={(p) => p.name}
      rowHref={(p) => programPath(p.id)}
      defaultSort={{ key: 'updatedAt', dir: 'desc' }}
      defaultView="all"
      searchPlaceholder={t('ui.admin-programs.search')}
      originViews={(r) => PROGRAM_VIEWS.map((key) => ({ key, label: t(`ui.admin-programs.view.${key}`), count: r?.views[key] ?? null, query: { view: key } }))}
      filters={(r) => [
        {
          key: 'attention',
          label: t('ui.admin-programs.filter.attention'),
          kind: 'options',
          options: [
            { value: 'to-check', label: t('ui.admin-programs.filter.toCheck'), count: r?.facets.attention['to-check'] ?? 0 },
            { value: 'late', label: t('ui.admin-programs.filter.late'), count: r?.facets.attention.late ?? 0 },
          ],
        },
        { key: 'promoterId', label: t('ui.admin-programs.column.promoter'), kind: 'options', options: (r?.promoters ?? []).map((p) => ({ value: p.id, label: p.name, count: r?.facets.promoterId[p.id] ?? 0 })) },
        { key: 'regionId', label: t('ui.admin-programs.column.region'), kind: 'options', options: (r?.regions ?? []).map((x) => ({ value: x.id, label: x.name, count: r?.facets.regionId[x.id] ?? 0 })) },
        { key: 'standing', label: t('ui.admin-programs.column.standing'), kind: 'options', options: STANDINGS.map((v) => ({ value: v, label: t(`ui.enum.Standing.${v}`), count: r?.facets.standing[v] ?? 0 })) },
        { key: 'deliveryStatus', label: t('ui.admin-programs.filter.deliveryStatus'), kind: 'options', rare: true, options: DELIVERY_STATUSES.map((v) => ({ value: v, label: t(`ui.enum.DeliveryStatus.${v}`), count: r?.facets.deliveryStatus[v] ?? 0 })) },
      ]}
      empty={{
        title: t('ui.admin-programs.empty.title'),
        text: t('ui.admin-programs.empty.text'),
        actions: can('catalogue.write') ? (
          <LinkButton href="/catalogue/programmes/nouveau" icon="plus">
            {t('ui.admin-programs.create')}
          </LinkButton>
        ) : undefined,
      }}
    />
  );
}
