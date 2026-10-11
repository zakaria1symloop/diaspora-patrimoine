'use client';
// EA-44 — « Médias »: every media of the programmes and properties in one list, with what needs attention first (views
// « En échec », « En cours de traitement », « Images petites », « Sans pièce », with their counts). A row opens the
// « Médias » tab of its record, where it is edited (CTL-080 … CTL-084).
import Link from 'next/link';
import { ADMIN_MEDIA_KINDS, MEDIA_LIBRARY_VIEWS, type MediaLibrary as Library, type MediaLibraryItem } from '@dp/contracts';
import { Icon, StatusTag } from '@dp/ui';
import { DASH, shortDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { ListPage, type ListColumn } from '../shell/list/ListPage';
import { useShell } from '../shell/ShellContext';
import { catalogueStyles as s } from '../catalogue/parts';

const ownerPath = (m: MediaLibraryItem) => `${m.owner.type === 'PROGRAM' ? '/catalogue/programmes' : '/catalogue/biens'}/${m.owner.id}?onglet=medias`;
const size = (n: number | null) => (n === null ? DASH : n > 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1e3))} ko`);

export function MediaLibrary() {
  const { timeZone } = useShell();
  const columns: ListColumn<MediaLibraryItem>[] = [
    {
      key: 'media',
      header: t('ui.admin-media.column.media'),
      fixed: true,
      width: '20rem',
      text: (m) => m.fileName,
      cell: (m) => (
        <span className={s.nameCell}>
          <span className={`${s.thumb} ${s.thumbS}`} aria-hidden="true">
            {m.thumb ? <img src={m.thumb.url} alt="" loading="lazy" /> : <Icon name={m.kind === 'VIDEO' ? 'play' : 'file'} size={16} />}
          </span>
          <span className={s.nameText}>
            <span className={s.nameLink}>{m.fileName ?? (m.url ? m.url.replace(/^https?:\/\//, '') : t(`ui.enum.MediaKind.${m.kind}`))}</span>
            {m.isCover ? <span className={s.sub}>{t('ui.admin-media.manager.cover')}</span> : null}
          </span>
        </span>
      ),
    },
    {
      key: 'owner',
      header: t('ui.admin-media.column.owner'),
      text: (m) => m.owner.label,
      cell: (m) => (
        <span className={s.nameText}>
          <Link href={ownerPath(m)} className={s.nameLink}>
            {m.owner.label}
          </Link>
          <span className={s.sub}>{m.owner.reference ?? t(`ui.admin-media.filter.${m.owner.type}`)}</span>
        </span>
      ),
    },
    { key: 'kind', header: t('ui.admin-media.column.kind'), cell: (m) => t(`ui.enum.MediaKind.${m.kind}`) },
    { key: 'room', header: t('ui.admin-media.column.room'), cell: (m) => m.roomLabel ?? DASH },
    {
      key: 'dimensions',
      header: t('ui.admin-media.column.dimensions'),
      cell: (m) =>
        m.width && m.height ? (
          <span className={m.small ? s.late : s.num} title={m.small ? t('ui.admin-media.manager.small') : undefined}>
            {m.small ? <Icon name="status-warning" size={16} /> : null}
            {`${m.width} × ${m.height}`}
          </span>
        ) : (
          DASH
        ),
    },
    { key: 'sizeBytes', header: t('ui.admin-media.column.size'), sortable: true, align: 'end', cell: (m) => <span className={s.num}>{size(m.sizeBytes)}</span> },
    {
      key: 'state',
      header: t('ui.admin-media.column.state'),
      cell: (m) => (
        <span className={s.nameText}>
          <StatusTag tone={m.processingStatus === 'READY' ? 'success' : m.processingStatus === 'FAILED' ? 'error' : 'pending'}>{t(`ui.admin-media.manager.state.${m.processingStatus}`)}</StatusTag>
          {m.processingError ? <span className={s.sub}>{m.processingError}</span> : null}
        </span>
      ),
    },
    { key: 'createdAt', header: t('ui.admin-media.column.createdAt'), sortable: true, firstDir: 'desc', cell: (m) => <span className={s.num}>{shortDate(m.createdAt, timeZone)}</span> },
  ];
  return (
    <ListPage<MediaLibraryItem, Library>
      listKey="media"
      endpoint="/admin/media/library"
      header={{ title: t('ui.admin-media.title'), crumbs: [{ label: t('ui.admin-shell.menu.group.catalogue') }, { label: t('ui.admin-media.title') }], intro: t('ui.admin-media.intro') }}
      columns={columns}
      rowId={(m) => m.id}
      rowLabel={(m) => m.fileName ?? m.id}
      rowHref={ownerPath}
      defaultSort={{ key: 'createdAt', dir: 'desc' }}
      defaultView="all"
      searchPlaceholder={t('ui.admin-media.search')}
      originViews={(r) => MEDIA_LIBRARY_VIEWS.map((key) => ({ key, label: t(`ui.admin-media.view.${key}`), count: r?.views[key] ?? null, query: { view: key } }))}
      filters={(r) => [
        { key: 'kind', label: t('ui.admin-media.filter.kind'), kind: 'options', options: ADMIN_MEDIA_KINDS.filter((k) => k !== 'LOGO').map((k) => ({ value: k, label: t(`ui.enum.MediaKind.${k}`), count: r?.facets.kind[k] ?? 0 })) },
        {
          key: 'ownerType',
          label: t('ui.admin-media.filter.ownerType'),
          kind: 'options',
          options: (['PROGRAM', 'PROPERTY'] as const).map((k) => ({ value: k, label: t(`ui.admin-media.filter.${k}`), count: r?.facets.ownerType[k] ?? 0 })),
        },
      ]}
      empty={{ title: t('ui.admin-media.empty.title'), text: t('ui.admin-media.empty.text') }}
    />
  );
}
