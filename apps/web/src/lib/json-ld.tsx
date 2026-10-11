// NAV-035 — structured data (JSON-LD). Each element only when it is filled in; never a monthly payment (an estimate,
// not a price); a property's place is its town and region only (TRV-045); a Café's place is its town only.
import 'server-only';
import type { CafeDetail, PropertyDetail, PublicImage, PublicSettings } from '@dp/contracts';
import logo from '@dp/ui/assets/logo.png';
import { env } from './env';

type Thing = Record<string, unknown>;

export function JsonLd({ data }: { data: Thing | Thing[] }) {
  // `<` escaped so a text can never close the script element
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

const base = () => env().WEB_URL.replace(/\/$/, '');
const abs = (path: string) => (path.startsWith('http') ? path : `${base()}${path}`);
const imageUrl = (img: PublicImage | null | undefined) =>
  img ? `${img.base}/${img.renditions.includes('og') ? 'og' : (img.renditions[img.renditions.length - 1] ?? 'large')}.jpg` : undefined;

/** Removes the keys whose value is empty, so that only filled-in elements are published. */
function compact<T extends Thing>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)),
  ) as T;
}

/** Every page: the organisation. */
export function organizationLd(s: PublicSettings): Thing {
  const social = (['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'] as const)
    .map((k) => s[`contact.social.${k}`])
    .filter((u): u is string => Boolean(u));
  const contactPoint =
    s['contact.phone'] || s['contact.email']
      ? compact({ '@type': 'ContactPoint', contactType: 'customer service', telephone: s['contact.phone'] || undefined, email: s['contact.email'] || undefined })
      : undefined;
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${base()}/#organisation`,
    name: s['contact.companyName'],
    url: `${base()}/`,
    logo: abs(logo.src),
    sameAs: social,
    contactPoint,
  });
}

/** Home page: the site and its search action towards the catalogue. */
export function websiteLd(s: PublicSettings): Thing {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: s['seo.siteName'],
    url: `${base()}/`,
    publisher: { '@id': `${base()}/#organisation` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${base()}/programmes?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** NAV-039 — the trail of a detail page; every level carries its address, the last one included. */
export function breadcrumbLd(items: { name: string; path: string }[]): Thing {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

const AVAILABILITY: Record<PropertyDetail['availability'], string> = {
  AVAILABLE: 'https://schema.org/InStock',
  RESERVED: 'https://schema.org/OutOfStock',
  SOLD: 'https://schema.org/SoldOut',
  WITHDRAWN: 'https://schema.org/Discontinued',
};

/** A property: price « from » in the property's own currency, availability, town and region. */
export function propertyLd(p: PropertyDetail): Thing {
  const scarce = p.availability === 'AVAILABLE' && (p.label?.kind === 'LAST_LOT' || p.label?.kind === 'LOW_STOCK');
  const withdrawn = p.availability === 'WITHDRAWN';
  const price = p.priceFrom ?? p.priceFromRef;
  const offer = compact({
    '@type': 'Offer',
    availability: scarce ? 'https://schema.org/LimitedAvailability' : AVAILABILITY[p.availability],
    price: withdrawn ? undefined : price?.amount,
    priceCurrency: withdrawn ? undefined : price?.currency,
    url: `${base()}/biens/${p.slug}`,
  });
  return compact({
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: p.title,
    description: p.description,
    url: `${base()}/biens/${p.slug}`,
    image: p.media.images.slice(0, 3).map((i) => imageUrl(i)).filter(Boolean),
    datePosted: p.firstPublishedAt ?? p.publishedAt ?? undefined,
    contentLocation: compact({
      '@type': 'Place',
      address: compact({ '@type': 'PostalAddress', addressLocality: p.location.city?.name, addressRegion: p.location.region.name }),
    }),
    offers: offer,
  });
}

/** A Café: dates with their time zone offset, in person, town only, free, scheduled or cancelled. */
export function cafeLd(c: CafeDetail, s: PublicSettings): Thing {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: c.title,
    description: c.description ?? undefined,
    startDate: zoned(c.startsAt, c.timezone),
    endDate: zoned(c.endsAt, c.timezone),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: c.state.kind === 'CANCELLED' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: c.cityName, address: { '@type': 'PostalAddress', addressLocality: c.cityName } },
    image: imageUrl(c.cover),
    organizer: { '@type': 'Organization', name: s['contact.companyName'], url: `${base()}/` },
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', url: `${base()}/le-cafe/${c.slug}`, availability: c.state.kind === 'FULL' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' },
  });
}

/** An instant written in its own time zone with the offset, e.g. 2026-10-17T10:00:00+02:00. */
function zoned(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const local = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  const offset = Math.round((local - d.getTime()) / 60_000);
  const sign = offset >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const mm = String(Math.abs(offset) % 60).padStart(2, '0');
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${hh}:${mm}`;
}
