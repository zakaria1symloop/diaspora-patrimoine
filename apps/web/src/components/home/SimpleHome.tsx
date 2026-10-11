// TRV-122 — the home page in « Affichage simplifié »: the title, the search, three big buttons (« Chercher un bien »,
// « Simuler mon financement », « Parler à un conseiller ») and the reminder that nothing is taken away. Rendered with
// the page and shown by CSS when <html data-simple> is set (before paint: no jump); the full home is hidden then.
import Link from 'next/link';
import type { SearchOptions } from '@dp/contracts';
import { Icon, type IconName } from '@dp/ui';
import { SearchBar } from '@/components/vitrine/SearchBar';
import { t } from '@/lib/i18n';
import s from './home.module.css';

export function SimpleHome({
  title,
  search,
  monthlyEnabled,
  roomsPrefix,
  callbackHref,
}: {
  title: string;
  search: SearchOptions;
  monthlyEnabled: boolean;
  roomsPrefix: string;
  callbackHref: string;
}) {
  const doors: { href: string; icon: IconName; title: string; text: string; scroll?: boolean }[] = [
    { href: '/programmes', icon: 'search', title: t('ui.home.simple.search'), text: t('ui.home.simple.searchText') },
    { href: '/financements/simulateur-eligibilite', icon: 'calculator', title: t('ui.home.simple.simulate'), text: t('ui.home.simple.simulateText') },
    { href: callbackHref, icon: 'phone', title: t('ui.home.simple.advisor'), text: t('ui.home.simple.advisorText'), scroll: false },
  ];
  return (
    <section className={`container ${s.simpleHome}`} aria-labelledby="accueil-simple">
      <h1 id="accueil-simple" className={s.simpleTitle}>
        {title}
      </h1>
      <p className={s.simpleLead}>{t('ui.home.simple.lead')}</p>
      <div className={s.simpleSearch}>
        <SearchBar options={search} monthlyEnabled={monthlyEnabled} roomsPrefix={roomsPrefix} stacked />
      </div>
      <ul className={s.simpleDoors} role="list">
        {doors.map((d) => (
          <li key={d.href}>
            <Link href={d.href} className={s.simpleDoor} scroll={d.scroll}>
              <span className={s.simpleIcon}>
                <Icon name={d.icon} size={24} />
              </span>
              <span className={s.simpleText}>
                <strong>{d.title}</strong>
                <span>{d.text}</span>
              </span>
              <Icon name="chevron-right" size={24} />
            </Link>
          </li>
        ))}
      </ul>
      <p className={s.simpleNote}>{t('ui.home.simple.note')}</p>
    </section>
  );
}
