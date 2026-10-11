'use client';
// ECL-010 block 7, MSG-040, MSG-042, MSG-046, NOT-032, NOT-033 — « Dernières nouvelles », where the notifications are
// read until EC-31 (package 5.1): ten lines, unread first and highlighted, an icon by destination, the relative date;
// a click marks the line read and opens what it announces; « Tout marquer comme lu ». No « Tout voir » (ECL-006).
// D-098: a filter « Toutes » · « Non lues ({n}) » kept in the address (`nouvelles=non-lues`, TRV-101); each line is one
// whole button with its arrow.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ClientNotificationItem, NotificationTarget } from '@dp/contracts';
import { Icon, type IconName } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import { useSpace } from '../SpaceContext';
import { FilterChips, useListState } from '../kit/ListControls';
import k from '../kit/kit.module.css';
import { relativeTime } from '../texts';
import sp from '../space.module.css';
import s from './dashboard.module.css';

const ICON: Record<NotificationTarget, IconName> = {
  DOCUMENT: 'file',
  DOSSIER: 'folder',
  FINANCING: 'bank',
  MESSAGE: 'chat',
  APPOINTMENT: 'calendar',
  PROPERTY: 'home',
  CAFE: 'cafe-cup',
  OTHER: 'bell',
};

/** Links the space can open at livraison 2; anything else is « Cet élément n'est plus disponible » (NOT-033). */
function reachable(link: string | null): boolean {
  if (!link) return false;
  if (/^\/espace-client\/(notifications|rendez-vous|cafes|avis)/.test(link)) return false;
  return link.startsWith('/');
}

export function NewsBlock({ initial }: { initial: ClientNotificationItem[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const { summary, setUnread, refresh } = useSpace();
  const router = useRouter();
  const unread = items.filter((n) => !n.read).length;
  const list = useListState();
  const onlyUnread = list.get('nouvelles') === 'non-lues';
  const shown = onlyUnread ? items.filter((n) => !n.read) : items;

  async function open(n: ClientNotificationItem) {
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    if (!n.read) setUnread(summary.unreadNotifications - 1);
    const res = await apiCall<{ unread: number }>('/client/notifications/read', { method: 'POST', body: { ids: [n.id] }, retryOnAuth: true });
    if (res.ok) setUnread(res.data.unread);
    if (reachable(n.link)) router.push(n.link!);
    else showToast({ message: t('ui.client.dashboard.news.gone'), tone: 'info' });
  }

  async function markAll() {
    setBusy(true);
    const res = await apiCall<{ unread: number }>('/client/notifications/read-all', { method: 'POST', retryOnAuth: true });
    setBusy(false);
    if (res.ok) {
      setItems((list) => list.map((x) => ({ ...x, read: true })));
      setUnread(0);
      void refresh({ soft: true });
    }
  }

  return (
    <section id="dernieres-nouvelles" tabIndex={-1} className={`${sp.block} ${s.news}`} aria-labelledby="bloc-nouvelles">
      <div className={sp.blockHead}>
        <h2 id="bloc-nouvelles" className={sp.blockTitle}>
          {t('ui.client.dashboard.news.title')}
        </h2>
        {unread > 0 ? (
          <button type="button" className={k.quiet} onClick={() => void markAll()} disabled={busy}>
            <Icon name="check" size={20} />
            {t('ui.client.dashboard.news.markAll')}
          </button>
        ) : null}
      </div>
      {items.length > 0 && (unread > 0 || onlyUnread) ? (
        <div className={s.newsFilter}>
          <FilterChips
            label={t('ui.client.dashboard.news.filter')}
            value={onlyUnread ? 'non-lues' : ''}
            onChange={(v) => list.set({ nouvelles: v }, { push: true })}
            options={[
              { value: '', label: t('ui.client.dashboard.news.all'), count: items.length },
              { value: 'non-lues', label: t('ui.client.dashboard.news.unreadOnly'), count: unread },
            ]}
          />
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className={s.calm}>
          <span className={s.calmIcon} aria-hidden="true">
            <Icon name="bell" size={24} />
          </span>
          {t('ui.client.dashboard.news.none')}
        </p>
      ) : shown.length === 0 ? (
        <p className={s.calm}>
          <span className={s.calmIcon} aria-hidden="true">
            <Icon name="status-success" size={24} />
          </span>
          {t('ui.client.dashboard.news.allRead')}
        </p>
      ) : (
        <ul role="list" className={s.newsList}>
          {shown.map((n, i) => (
            <li key={n.id} className={k.enter} style={{ ['--i' as string]: i }}>
              <button type="button" className={[s.newsItem, !n.read && s.newsUnread].filter(Boolean).join(' ')} onClick={() => void open(n)}>
                <span className={s.newsIcon}>
                  <Icon name={ICON[n.target]} size={20} />
                </span>
                <span className={s.newsText}>
                  <span className={s.newsTitle}>{n.count > 1 && n.titlePlural ? n.titlePlural.replace('{n}', String(n.count)) : n.title}</span>
                  {n.body ? <span className={sp.help}>{n.body}</span> : null}
                  <time dateTime={n.updatedAt} suppressHydrationWarning title={new Date(n.updatedAt).toLocaleString('fr-FR', { timeZone: summary.timeZone })} className={s.newsTime}>
                    {relativeTime(n.updatedAt, summary.timeZone)}
                  </time>
                </span>
                {!n.read ? <span className="visually-hidden">{t('ui.client.dashboard.news.unread')}</span> : null}
                {!n.read ? <span className={s.dot} aria-hidden="true" /> : null}
                {reachable(n.link) ? <Icon name="chevron-right" size={16} className={s.newsGo} /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
