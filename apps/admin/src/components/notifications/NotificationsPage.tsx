'use client';
// EA-105 — the page « Notifications » (BO-060): all of them, 25 lines per page (TRV-100), with the filter « Non
// lues » and « Tout marquer comme lu ». The state lives in the address (`page`, `unread`, TRV-101). A click opens the
// notification and marks it read (NOT-032); one whose page is not delivered is only marked read.
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { StaffNotificationItem, StaffNotificationList } from '@dp/contracts';
import { Banner, Button, EmptyState, Pagination, SkeletonRows } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { PageHeader } from '../shell/Page';
import { signalShellChanged, useShell } from '../shell/ShellContext';
import { NotificationLine } from '../shell/TopBar';
import s from './notifications.module.css';

export function NotificationsPage() {
  const params = useSearchParams();
  const { shell } = useShell();
  const page = Math.max(1, Number(params?.get('page')) || 1);
  const unreadOnly = params?.get('unread') === '1';
  const [data, setData] = useState<StaffNotificationList | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const go = (next: { page?: number; unread?: boolean }) => {
    const p = new URLSearchParams();
    if (next.unread ?? unreadOnly) p.set('unread', '1');
    if ((next.page ?? 1) > 1) p.set('page', String(next.page));
    const qs = p.toString();
    window.history.pushState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  };

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const r = await adminCall<StaffNotificationList>('/admin/notifications', { query: { page, pageSize: 25, unread: unreadOnly ? '1' : undefined }, signal });
      if (!r.ok && r.aborted) return;
      setLoading(false);
      if (r.ok) {
        setData(r.data);
        setFailed(null);
      } else setFailed(errorText(r));
    },
    [page, unreadOnly],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
    // the bell counter changed elsewhere (a new notification): read again
  }, [load, shell.unreadNotifications]);

  const open = async (item: StaffNotificationItem) => {
    if (item.read) return;
    setData((d) => (d ? { ...d, data: d.data.map((n) => (n.id === item.id ? { ...n, read: true } : n)) } : d));
    await adminCall('/admin/notifications/read', { body: { ids: [item.id] } });
    signalShellChanged();
  };
  const readAll = async () => {
    const r = await adminCall('/admin/notifications/read-all', { method: 'POST' });
    if (r.ok) {
      signalShellChanged();
      void load();
    } else setFailed(errorText(r));
  };

  const now = Date.now();
  const href = (p: number) => `?${new URLSearchParams({ ...(unreadOnly ? { unread: '1' } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`;
  return (
    <div className={s.page}>
      <PageHeader
        title={t('ui.admin-shell.bell.title')}
        actions={
          <Button variant="secondary" size="M" icon="check" onClick={() => void readAll()} disabled={!data || data.unread === 0}>
            {t('ui.admin-shell.bell.readAll')}
          </Button>
        }
      />
      <div className={s.card}>
        <div className={s.filters} role="group" aria-label={t('ui.common.filters')}>
          <button type="button" className={[s.filter, !unreadOnly && s.filterOn].filter(Boolean).join(' ')} aria-pressed={!unreadOnly} onClick={() => go({ unread: false })}>
            {t('ui.admin-shell.bell.all')}
          </button>
          <button type="button" className={[s.filter, unreadOnly && s.filterOn].filter(Boolean).join(' ')} aria-pressed={unreadOnly} onClick={() => go({ unread: true })}>
            {t('ui.admin-shell.bell.unreadOnly')}
            {data ? <span className={s.count}>{data.unread}</span> : null}
          </button>
          {data && data.meta.total > 0 ? (
            <span className={s.range}>{t('ui.common.list.range', { debut: (data.meta.page - 1) * data.meta.pageSize + 1, fin: Math.min(data.meta.total, data.meta.page * data.meta.pageSize), total: data.meta.total })}</span>
          ) : null}
        </div>
        {failed && !data ? (
          <div className={s.pad}>
            <Banner tone="error" action={<Button variant="secondary" size="S" onClick={() => void load()}>{t('ui.common.retry')}</Button>}>
              {failed}
            </Banner>
          </div>
        ) : !data ? (
          <SkeletonRows rows={6} columns={2} label={t('ui.common.loading')} />
        ) : data.data.length === 0 ? (
          <EmptyState
            icon="bell"
            title={unreadOnly ? t('ui.admin-shell.bell.emptyUnread') : t('ui.admin-shell.bell.emptyTitle')}
            text={unreadOnly ? undefined : t('ui.admin-shell.bell.emptyText')}
            actions={
              unreadOnly ? (
                <Button variant="secondary" size="S" onClick={() => go({ unread: false })}>
                  {t('ui.admin-shell.bell.seeAll')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className={[s.list, loading && s.reloading].filter(Boolean).join(' ')}>
            {data.data.map((n) => (
              <NotificationLine key={n.id} item={n} onOpen={(item) => void open(item)} now={now} />
            ))}
          </div>
        )}
        {data && data.meta.totalPages > 1 ? (
          <div className={s.foot}>
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              onPage={(p) => go({ page: p })}
              hrefFor={href}
              labels={{ nav: t('ui.admin-shell.list.pagination'), previous: t('ui.admin-shell.list.previous'), next: t('ui.admin-shell.list.next'), page: (n) => t('ui.admin-shell.list.page', { n }) }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
