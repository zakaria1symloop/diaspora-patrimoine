'use client';
// SFA-021, SFA-022 — « Mes favoris » without an account (`/favoris`): the properties kept in this browser, most recent
// first, each with its date added, « Exprimer mon intérêt » and the heart. Reserved or sold: still there, veiled.
// Archived: kept 30 days with « Ce bien n'est plus proposé », then dropped; unknown references are dropped at once.
// The reminder « Créez votre espace… » sits above the list. Empty: « Touchez le cœur d'un bien pour le retrouver ici. »
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { FavoriteEntry, FavoritesResponse } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { formatDate } from '@dp/i18n';
import { PropertyCard } from '@/components/vitrine/PropertyCard';
import { useFavorites } from '@/lib/discovery';
import { useClientSession } from '@/lib/session-client';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import { LineArt } from './LineArt';
import p from './pages.module.css';

const GONE_KEEP_MS = 30 * 86_400_000;

export function FavoritesList({ monthlyEnabled, illustrationNote }: { monthlyEnabled: boolean; illustrationNote: string }) {
  const { items, remove, toggle } = useFavorites();
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<{ entries: Map<string, FavoriteEntry>; pct: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = items.map((i) => i.ref).sort().join(',');

  useEffect(() => setHydrated(true), []);
  // EC-41 — a signed-in client's favourites are on his account: « Mes favoris » is the page of his space.
  const session = useClientSession();
  const router = useRouter();
  useEffect(() => {
    if (session.status === 'authenticated') router.replace('/espace-client/favoris');
  }, [session.status, router]);

  useEffect(() => {
    if (!hydrated) return;
    if (!key) {
      setData({ entries: new Map(), pct: '20' });
      return;
    }
    let alive = true;
    setFailed(false);
    fetch(`/api/v1/public/properties/cards?refs=${encodeURIComponent(key)}`, { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<FavoritesResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((body) => {
        if (!alive) return;
        const entries = new Map(body.data.map((e) => [e.reference, e]));
        // Unknown, or archived for more than 30 days: dropped from the browser (SFA-022).
        const drop = body.data
          .filter((e) => e.state === 'UNKNOWN' || (e.state === 'GONE' && e.archivedAt && Date.now() - Date.parse(e.archivedAt) > GONE_KEEP_MS))
          .map((e) => e.reference);
        if (drop.length) remove(drop);
        setData({ entries, pct: body.referenceDownPaymentPct });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated, attempt]);

  const list = useMemo(() => [...items].sort((a, b) => b.at - a.at), [items]);

  if (!hydrated || (!data && !failed)) {
    return (
      <p className={p.loading} role="status">
        {t('ui.favorites.page.loading')}
      </p>
    );
  }
  if (failed) {
    return (
      <div className={p.notice} role="alert">
        <Icon name="status-error" size={20} />
        {t('ui.favorites.page.error')}
        <button type="button" className={p.linkButton} onClick={() => setAttempt((n) => n + 1)}>
          {t('ui.favorites.page.retry')}
        </button>
      </div>
    );
  }
  if (!list.length) {
    return (
      <section className={p.empty}>
        <LineArt name="heart" className={p.art} />
        <div className={p.emptyText}>
          <h2 className={p.h2}>{t('ui.favorites.page.emptyTitle')}</h2>
          <p>{t('ui.favorites.page.emptyText')}</p>
          <Link href="/programmes" className={buttonClass('primary', 'L')}>
            <ButtonInner chevron size="L">
              {t('ui.favorites.page.discover')}
            </ButtonInner>
          </Link>
        </div>
      </section>
    );
  }

  const online = list.filter((f) => data!.entries.get(f.ref)?.state === 'ONLINE');
  return (
    <>
      <div className={p.nudge}>
        <Icon name="user" size={20} />
        <span>{t('ui.favorites.nudge.text')}</span>
        <Link href="/inscription?suite=%2Ffavoris" className={p.nudgeLink}>
          {t('ui.favorites.nudge.cta')}
        </Link>
      </div>
      <div className={p.listHead}>
        <p className={p.count}>{t('ui.favorites.page.count', { n: list.length })}</p>
        {online.length >= 2 ? (
          <Link href={`/comparer?biens=${online.slice(0, 3).map((f) => f.ref).join(',')}`} className={p.cta}>
            <Icon name="scale" size={20} />
            {t('ui.favorites.page.compare')}
          </Link>
        ) : null}
      </div>
      <ul className={p.favGrid} role="list">
        {list.map((f) => {
          const e = data!.entries.get(f.ref);
          if (!e || e.state === 'UNKNOWN') return null;
          const added = t('ui.favorites.page.addedOn', { date: formatDate(new Date(f.at), 'long') });
          if (e.state === 'GONE') {
            return (
              <li key={f.ref} className={p.favItem}>
                <article className={p.goneCard}>
                  <Icon name="home" size={32} />
                  <h2 className={p.goneTitle}>{e.title}</h2>
                  <p className={p.goneText}>{t('ui.favorites.page.gone')}</p>
                  <p className={p.muted}>{t('ui.favorites.page.goneHint')}</p>
                  <button type="button" className={buttonClass('secondary', 'S')} onClick={() => toggle(f.ref)}>
                    <ButtonInner size="S" icon="trash">
                      {t('ui.favorites.page.remove')}
                    </ButtonInner>
                  </button>
                </article>
                <p className={p.added}>{added}</p>
              </li>
            );
          }
          return (
            <li key={f.ref} className={p.favItem}>
              <PropertyCard card={e.card} downPaymentPct={data!.pct} monthlyEnabled={monthlyEnabled} illustrationNote={illustrationNote} headingLevel="h2" />
              <div className={p.favFoot}>
                <span className={p.added}>{added}</span>
                {e.card.availability === 'AVAILABLE' ? (
                  <Link href={`/biens/${e.card.slug}?interet=1`} className={buttonClass('primary', 'S')}>
                    <ButtonInner size="S">{t('ui.favorites.page.interest')}</ButtonInner>
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
