// EP-05 / EP-04 building blocks (FIC-010 … FIC-070). Server components; interactive parts are separate client files.
import Link from 'next/link';
import type {
  ConstructionProgress,
  PropertyDetail,
  PublicImage,
  PublicListItem,
  PublicLocation,
  PublicMediaSet,
  PublicPromoter,
} from '@dp/contracts';
import { Icon, buttonClass, ButtonInner, type IconName } from '@dp/ui';
import { formatDate } from '@dp/i18n';
import { Picture } from '@/components/Picture';
import { icons } from '@dp/ui';
import { t } from '@/lib/i18n';
import { LocationMap } from './LocationMap';
import s from './property.module.css';

export function iconOr(name: string | null | undefined, fallback: IconName = 'check'): IconName {
  return name && name in icons ? (name as IconName) : fallback;
}

// ---------- Gallery mosaic (FIC-010, FIC-020 … FIC-022) ----------

export function Mosaic({
  media,
  basePath,
  render3dNote,
  illustrationNote,
  title,
}: {
  media: PublicMediaSet;
  basePath: string;
  render3dNote: string;
  illustrationNote: string;
  title: string;
}) {
  const images = media.images;
  if (images.length === 0) {
    return (
      <div className={s.noPhotos}>
        <Icon name="camera" size={32} />
        <p className={s.noPhotosTitle}>{t('ui.property.gallery.emptyTitle')}</p>
        <p>{t('ui.property.gallery.emptyText')}</p>
        {media.plans.length ? (
          <Link href={`${basePath}?galerie=plans`} scroll={false} className={buttonClass('secondary', 'M')}>
            <ButtonInner size="M">{t('ui.property.gallery.seePlan')}</ButtonInner>
          </Link>
        ) : null}
      </div>
    );
  }
  const thumbs = images.slice(1, 5);
  const rest = images.length - 5;
  const note = (img: PublicImage) =>
    img.isRender3d ? render3dNote : img.isIllustration ? illustrationNote : null;
  return (
    <div className={[s.mosaic, images.length === 1 && s.mosaicSingle].filter(Boolean).join(' ')} data-thumbs={thumbs.length}>
      <Link href={`${basePath}?galerie=photos&i=0`} scroll={false} className={s.mosaicMain} aria-label={t('ui.property.gallery.open')}>
        <Picture image={images[0]!} sizes="(max-width: 1023px) 100vw, 860px" className={s.mosaicImg} priority alt={images[0]!.alt || title} />
        {note(images[0]!) ? <span className={s.imgNote}>{note(images[0]!)}</span> : null}
      </Link>
      {thumbs.map((img, i) => (
        <Link key={img.id} href={`${basePath}?galerie=photos&i=${i + 1}`} scroll={false} className={s.mosaicThumb}>
          <Picture image={img} sizes="280px" className={s.mosaicImg} />
          {note(img) ? <span className={s.imgNote}>{note(img)}</span> : null}
          {i === thumbs.length - 1 && rest > 0 ? <span className={s.more}>{t('ui.property.gallery.more', { n: rest })}</span> : null}
        </Link>
      ))}
      <Link href={`${basePath}?galerie=photos&i=0`} scroll={false} className={s.counter}>
        <Icon name="camera" size={20} />
        {media.plans.length
          ? t('ui.property.gallery.counterPlans', { photos: images.length, plans: media.plans.length })
          : t('ui.property.gallery.counter', { photos: images.length })}
      </Link>
    </div>
  );
}

// ---------- Key facts (FIC-030) ----------

export interface Fact {
  icon: IconName;
  label: string;
  value: string;
}

export function KeyFacts({ facts, title = t('ui.property.facts.title') }: { facts: Fact[]; title?: string }) {
  return (
    <section className={s.block} aria-labelledby="chiffres-cles">
      <h2 id="chiffres-cles" className={s.h2}>
        {title}
      </h2>
      <dl className={s.facts}>
        {facts.map((f) => (
          <div key={f.label} className={s.fact}>
            <span className={s.factIcon}>
              <Icon name={f.icon} size={24} />
            </span>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------- Lists (FIC-032, programme amenities) ----------

export function ItemList({ id, title, items }: { id: string; title: string; items: PublicListItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className={s.block} aria-labelledby={id}>
      <h2 id={id} className={s.h2}>
        {title}
      </h2>
      <ul className={s.items} role="list">
        {items.map((i) => (
          <li key={i.code}>
            <span className={s.itemIcon}>
              <Icon name={iconOr(i.icon)} size={20} />
            </span>
            {i.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Construction progress (FIC-042) ----------

const STAGES = ['FOUNDATIONS', 'STRUCTURE', 'SECONDARY_WORKS', 'FINISHES', 'DELIVERY'] as const;

export function Progress({ progress }: { progress: ConstructionProgress | null }) {
  if (!progress) return null;
  const current = STAGES.indexOf(progress.stage as (typeof STAGES)[number]);
  const dateOf = (stage: string) => progress.history.find((h) => h.stage === stage)?.publishedAt;
  return (
    <section className={s.block} aria-labelledby="chantier">
      <h2 id="chantier" className={s.h2}>
        {t('ui.property.progress.title')}
      </h2>
      <ol className={s.timeline}>
        {STAGES.map((st, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          const date = dateOf(st);
          return (
            <li key={st} data-state={state}>
              <span className={s.dot}>{state === 'done' ? <Icon name="check" size={16} /> : null}</span>
              <span className={s.stage}>{t(`ui.enum.ConstructionStage.${st}`)}</span>
              <span className={s.stageMeta}>
                {state === 'current' ? t('ui.property.progress.current') : date && state === 'done' ? formatDate(date, 'short') : null}
              </span>
            </li>
          );
        })}
      </ol>
      <div className={s.progressBar} aria-hidden="true">
        <span style={{ inlineSize: `${progress.percent}%` }} />
      </div>
      <p className={s.muted}>
        {`${progress.percent} %`} · {t('ui.property.progress.updated', { date: formatDate(progress.publishedAt, 'long') })}
      </p>
    </section>
  );
}

// ---------- Promoter (FIC-043) ----------

export function PromoterCard({ promoter, guarantees }: { promoter: PublicPromoter; guarantees: string | null }) {
  return (
    <section className={`${s.block} ${s.promoterBlock}`} aria-labelledby="promoteur">
      <h2 id="promoteur" className={s.h2}>
        {t('ui.property.promoter.title')}
      </h2>
      <div className={s.promoter}>
        {promoter.logo ? (
          <Picture image={promoter.logo} sizes="80px" className={s.promoterLogo} alt="" />
        ) : (
          <span className={s.promoterInitial} aria-hidden="true">
            {promoter.name.charAt(0)}
          </span>
        )}
        <div className={s.promoterText}>
          <p className={s.promoterName}>{promoter.name}</p>
          <p className={s.badge}>
            <Icon name="badge" size={16} />
            {t('ui.property.promoter.selected')}
          </p>
          {promoter.referencesPublic ? <p>{promoter.referencesPublic}</p> : null}
          <p className={s.muted}>{t('ui.property.promoter.programs', { n: promoter.programCount })}</p>
          <Link href={`/promoteurs/${promoter.slug}`} className={s.standalone}>
            {t('ui.property.promoter.see')}
            <Icon name="chevron-right" size={16} />
          </Link>
        </div>
      </div>
      {guarantees ? (
        <div className={s.guarantees}>
          <h3 className={s.h3}>{t('ui.property.promoter.guarantees')}</h3>
          <p className={s.prewrap}>{guarantees}</p>
        </div>
      ) : null}
    </section>
  );
}

// ---------- Location (FIC-060 … FIC-065) ----------

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`;
}

/** `mapStyleUrl`: ENV-040 MAP_STYLE_URL, read by the page on the server; null → the place in text (FIC-061). */
export function LocationSection({ location, mapStyleUrl = null }: { location: PublicLocation; mapStyleUrl?: string | null }) {
  const place = location.city ? t('ui.property.header.location', { ville: location.city.name, region: location.region.name }) : location.region.name;
  return (
    <section className={s.block} aria-labelledby="localisation">
      <h2 id="localisation" className={s.h2}>
        {t('ui.property.location.title')}
      </h2>
      {/* FIC-060 map; FIC-061: without a map style (MAP_STYLE_URL) or if it fails, the place as text, never an empty zone. */}
      <LocationMap
        location={location}
        styleUrl={mapStyleUrl}
        fallback={
          <div className={s.mapFallback}>
            <Icon name="map-pin" size={32} className={s.gold} />
            <p className={s.mapPlace}>{location.city ? t('ui.property.location.area', { ville: location.city.name }) : place}</p>
            <p className={s.muted}>{place}</p>
          </div>
        }
      />
      <p className={s.muted}>{t('ui.property.location.notice')}</p>
      {location.pois.length ? (
        <div>
          <h3 className={s.h3}>{t('ui.property.location.nearby')}</h3>
          <ul className={s.items} role="list">
            {location.pois.map((p) => (
              <li key={p.label}>
                <span className={s.itemIcon}>
                  <Icon name="map-pin" size={20} />
                </span>
                {t('ui.property.location.poi', {
                  label: p.label,
                  minutes: p.minutes,
                  mode: t(`ui.property.location.modes.${p.mode as 'CAR' | 'WALK' | 'TRANSIT'}`),
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {location.travelTimes.length ? (
        <div>
          <h3 className={s.h3}>{t('ui.property.location.abroad')}</h3>
          <ul className={s.items} role="list">
            {location.travelTimes.map((tt) => (
              <li key={tt.fromCity}>
                <span className={s.itemIcon}>
                  <Icon name="globe" size={20} />
                </span>
                {tt.via
                  ? t('ui.property.location.via', { ville: tt.fromCity, duree: duration(tt.minutes), via: tt.via })
                  : t('ui.property.location.flight', { ville: tt.fromCity, duree: duration(tt.minutes) })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function headerFlight(location: PublicLocation): string | null {
  const paris = location.travelTimes.find((tt) => tt.fromCity === 'Paris') ?? location.travelTimes[0];
  return paris ? t('ui.property.header.flight', { duree: duration(paris.minutes), ville: paris.fromCity }) : null;
}

export function descriptionLines(p: PropertyDetail): string {
  return p.description;
}
