// CAT-091 — « Grouper par programme »: one card per programme — photo, name, town, « {n} biens · de {min} à {max} » —
// unfolding into its properties (compact cards). A native disclosure: works without script, keyboard and screen reader
// included. An isolated property keeps its ordinary card. Sort and filters unchanged; the pagination counts programmes.
import Link from 'next/link';
import type { CatalogueGroup } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { Picture } from '@/components/Picture';
import { PropertyCard } from '@/components/vitrine/PropertyCard';
import { money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { CompactCard } from './CompactCard';
import s from './views.module.css';

export function GroupedResults({ groups, downPaymentPct, monthlyEnabled, illustrationNote }: { groups: CatalogueGroup[]; downPaymentPct: string; monthlyEnabled: boolean; illustrationNote: string }) {
  return (
    <ul className={s.groups} role="list">
      {groups.map((g) => {
        if (g.kind === 'PROPERTY') {
          return (
            <li key={g.property.id} className={s.groupSingle} id={`bien-${g.property.reference}`}>
              <PropertyCard card={g.property} downPaymentPct={downPaymentPct} monthlyEnabled={monthlyEnabled} illustrationNote={illustrationNote} />
            </li>
          );
        }
        const min = money(g.priceMin);
        const max = money(g.priceMax);
        const range = min && max ? (min === max ? t('ui.catalogue.group.from', { prix: min }) : t('ui.catalogue.group.range', { min, max })) : null;
        return (
          <li key={g.program.slug} className={s.group} id={`programme-${g.program.slug}`}>
            <details className={s.groupDetails}>
              <summary className={s.groupSummary}>
                <span className={s.groupPhoto}>
                  {g.program.cover ? <Picture image={g.program.cover} sizes="(max-width: 639px) 100vw, 320px" className={s.groupImg} alt="" /> : <Icon name="building" size={32} />}
                </span>
                <span className={s.groupText}>
                  <span className={s.groupName}>{g.program.name}</span>
                  <span className={s.groupPlace}>
                    <Icon name="map-pin" size={16} />
                    {g.program.city ? `${g.program.city}, ${g.program.region}` : g.program.region}
                  </span>
                  <span className={s.groupFacts}>{[t('ui.catalogue.group.count', { n: g.count }), range].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={s.groupToggle}>
                  <span className={s.groupShow}>{t('ui.catalogue.group.show', { n: g.count })}</span>
                  <span className={s.groupHide}>{t('ui.catalogue.group.hide')}</span>
                  <Icon name="chevron-down" size={20} className={s.groupChevron} />
                </span>
              </summary>
              <div className={s.groupBody}>
                <ul className={s.compactList} role="list">
                  {g.properties.map((c) => (
                    <li key={c.id} id={`bien-${c.reference}`}>
                      <CompactCard card={c} monthlyEnabled={monthlyEnabled} />
                    </li>
                  ))}
                </ul>
                <Link href={`/programmes/${g.program.slug}`} className={s.groupLink}>
                  {t('ui.catalogue.group.seeProgram')}
                  <Icon name="chevron-right" size={16} />
                </Link>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
