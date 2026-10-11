'use client';
// CAT-090 « Liste · Carte » (hidden when the map is unavailable, FIC-061), CAT-091 « Grouper par programme », and the
// shortcuts to the visitor's favourites (SFA-021) — all state in the address (CAT-003, TRV-101); the page goes back to 1.
import Link from 'next/link';
import { criteriaToSearch, type CatalogueCriteria } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { useHearts } from '@/lib/account-favorites';
import { t } from '@/lib/i18n';
import { useDiscoveryFlags } from '@/components/discovery/DiscoveryProvider';
import s from './views.module.css';

export function ViewControls({ criteria, mapAvailable }: { criteria: CatalogueCriteria; mapAvailable: boolean }) {
  const { count, href: favoritesHref } = useHearts();
  const { favorites } = useDiscoveryFlags();
  const href = (patch: Partial<CatalogueCriteria>) => {
    const next = { ...criteria, ...patch } as CatalogueCriteria;
    for (const k of Object.keys(patch) as (keyof CatalogueCriteria)[]) if (patch[k] === undefined) delete next[k];
    delete next.page;
    return `/programmes${criteriaToSearch(next)}`;
  };
  const onMap = mapAvailable && criteria.vue === 'carte';
  const grouped = criteria.groupe === 'programme';
  return (
    <div className={s.viewTools}>
      {favorites && count > 0 ? (
        <Link href={favoritesHref} className={s.toolLink}>
          <Icon name="heart" size={20} />
          {t('ui.catalogue.tools.favorites', { n: count })}
        </Link>
      ) : null}
      {!onMap ? (
        <Link href={href({ groupe: grouped ? undefined : 'programme' })} className={s.toggle} aria-pressed={grouped} scroll={false}>
          <span className={s.switch} aria-hidden="true" />
          {t('ui.catalogue.group.toggle')}
        </Link>
      ) : null}
      {mapAvailable ? (
        <nav className={s.segmented} aria-label={t('ui.catalogue.map.toggle')}>
          <Link href={href({ vue: undefined, bbox: undefined })} className={s.segment} aria-current={!onMap ? 'true' : undefined} scroll={false}>
            <Icon name="menu" size={16} />
            {t('ui.catalogue.map.list')}
          </Link>
          <Link href={href({ vue: 'carte', groupe: undefined })} className={s.segment} aria-current={onMap ? 'true' : undefined} scroll={false}>
            <Icon name="map-pin" size={16} />
            {t('ui.catalogue.map.map')}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
