'use client';
// BO-010, BO-012, BO-013, BO-030, BO-060, BO-080, BO-081 — the top bar: the global search (`/` or Ctrl + K), « + Créer »,
// the « ? » help window, the bell, the account menu. An element whose function is not delivered is ABSENT, not greyed.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SearchHit, SearchResponse, StaffNotificationItem, StaffNotificationList } from '@dp/contracts';
import { Button, EmptyState, Icon, Menu, Modal, SearchSuggest, StatusTag, useDismiss, useToast, type IconName, type SearchSuggestHandle, type SuggestGroup, type SuggestItem } from '@dp/ui';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { adminCall, signOut } from '@/lib/admin-client';
import { longDay, relativeTime, shortDate, shortDateTime, shortDay } from '@/lib/format';
import { errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { createActionsFor, isDeliveredPath, OBJECT_PATHS, searchTypes } from './menu';
import { signalShellChanged, useShell } from './ShellContext';
import s from './frame.module.css';

const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// ─── Global search (BO-030, EA-106) ─────────────────────────────────────────

type HitItem = SuggestItem & { hit: SearchHit };

export function GlobalSearch() {
  const router = useRouter();
  const { timeZone } = useShell();
  const ref = useRef<SearchSuggestHandle>(null);
  const [value, setValue] = useState('');
  const [groups, setGroups] = useState<SuggestGroup<HitItem>[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const types = searchTypes();

  // BO-080 — `/` or Ctrl + K reach the field from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === '/' && !typing(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // TRV-103 — from 2 characters, 300 ms after the last key; TRV-107 — only the last request's answer is shown.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setGroups([]);
      setReady(false);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      const r = await adminCall<SearchResponse>('/admin/search', { query: { q, types: types.join(',') }, signal: controller.signal });
      if (controller.signal.aborted) return;
      setLoading(false);
      if (!r.ok) return;
      setGroups(
        r.data.groups
          .filter((g) => OBJECT_PATHS[g.type])
          .map((g) => ({
            key: g.type,
            label: t(`ui.admin-shell.search.type.${g.type}`),
            items: g.hits.map((hit) => {
              const statusKey = hit.status ? `ui.enum.${hit.status.enum}.${hit.status.value}` : null;
              const status = statusKey && hasMessage(statusKey) ? t(statusKey as MessageKey) : null;
              return {
                id: `${hit.type}:${hit.id}`,
                hit,
                icon: OBJECT_PATHS[hit.type]!.icon,
                primary: hit.title,
                secondary: [hit.subtitle, status, hit.date ? shortDate(hit.date, timeZone) : null].filter(Boolean).join(' · ') || null,
                trailing: hit.exact ? <StatusTag tone="info">{t('ui.admin-shell.search.exact')}</StatusTag> : undefined,
              };
            }),
            more: g.more ? { label: t('ui.admin-shell.search.seeAll'), onSelect: () => router.push(`${OBJECT_PATHS[g.type]!.list}?q=${encodeURIComponent(q)}`) } : null,
          })),
      );
      setReady(true);
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const open = useCallback(
    (item: HitItem, opts: { newTab: boolean }) => {
      const path = OBJECT_PATHS[item.hit.type]?.page(item.hit.key);
      if (!path) return;
      if (opts.newTab) window.open(path, '_blank', 'noopener');
      else {
        setValue('');
        router.push(path);
      }
    },
    [router],
  );

  if (types.length === 0) return null;
  return (
    <div className={s.search} role="search">
      <SearchSuggest<HitItem>
        ref={ref}
        value={value}
        onChange={setValue}
        groups={groups}
        ready={ready}
        loading={loading}
        onPick={open}
        // BO-030 — an exact reference comes first: Enter opens it directly
        onSubmit={() => {
          const first = groups[0]?.items[0];
          if (first?.hit.exact) open(first, { newTab: false });
        }}
        size="S"
        hint="/"
        labels={{
          label: t('ui.admin-shell.search.label'),
          placeholder: t('ui.admin-shell.search.placeholder'),
          count: (n) => t('ui.common.search.suggestions', { n }),
          noResult: (query) => t('ui.admin-shell.search.noResult', { saisie: query }),
          clear: t('ui.admin-shell.search.clear'),
          loading: t('ui.common.loading'),
        }}
      />
    </div>
  );
}

// ─── « + Créer » (BO-012) ───────────────────────────────────────────────────

export function CreateMenu() {
  const { shell } = useShell();
  const router = useRouter();
  const actions = createActionsFor(shell.permissions);
  if (actions.length === 0) return null; // nothing leads to a form that is not delivered
  return (
    <Menu
      label={t('ui.admin-shell.create.label')}
      triggerClassName={s.create}
      trigger={
        <>
          <Icon name="plus" size={16} />
          {t('ui.admin-shell.create.label')}
        </>
      }
      items={actions.map((a) => ({ key: a.key, label: t(a.label), icon: a.icon, onSelect: () => router.push(a.href) }))}
    />
  );
}

// ─── Help (BO-080, BO-081) ──────────────────────────────────────────────────

const SHORTCUTS: { keys: string[]; label: MessageKey }[] = [
  { keys: ['/', 'Ctrl + K'], label: 'ui.admin-shell.help.shortcut.search' },
  { keys: ['Échap'], label: 'ui.admin-shell.help.shortcut.escape' },
  { keys: ['↑', '↓'], label: 'ui.admin-shell.help.shortcut.rows' },
  { keys: ['Entrée'], label: 'ui.admin-shell.help.shortcut.open' },
  { keys: ['N'], label: 'ui.admin-shell.help.shortcut.note' },
  { keys: ['?'], label: 'ui.admin-shell.help.shortcut.help' },
];

export function HelpButton() {
  const { shell } = useShell();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !typing(e.target) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const { email, phone } = shell.contact;
  return (
    <>
      <button type="button" className={s.iconButton} onClick={() => setOpen(true)} aria-label={t('ui.admin-shell.help.open')} title={t('ui.admin-shell.help.open')}>
        <span className={s.helpGlyph} aria-hidden="true">
          ?
        </span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('ui.admin-shell.help.title')} closeLabel={t('ui.common.close')} width={560}>
        <section className={s.helpSection}>
          <h3 className={s.helpHeading}>{t('ui.admin-shell.help.shortcuts')}</h3>
          <dl className={s.shortcuts}>
            {SHORTCUTS.map((sc) => (
              <div key={sc.label} className={s.shortcut}>
                <dt>
                  {sc.keys.map((k, i) => (
                    <span key={k}>
                      {i > 0 ? <span className={s.or}>{t('ui.admin-shell.help.or')}</span> : null}
                      <kbd>{k}</kbd>
                    </span>
                  ))}
                </dt>
                <dd>{t(sc.label)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className={s.helpSection}>
          <h3 className={s.helpHeading}>{t('ui.admin-shell.help.support')}</h3>
          <p>{t('ui.admin-shell.help.supportText')}</p>
          {email || phone ? (
            <p className={s.helpContact}>
              {email ? <a href={`mailto:${email}`}>{email}</a> : null}
              {phone ? <a href={`tel:${phone}`}>{phone}</a> : null}
            </p>
          ) : null}
        </section>
      </Modal>
    </>
  );
}

// ─── The bell (BO-060, EA-105) ──────────────────────────────────────────────

export const NOTIFICATION_ICON: Record<StaffNotificationItem['target'], IconName> = {
  LEAD: 'mail',
  DOSSIER: 'folder',
  SUBMISSION: 'bank',
  TASK: 'check',
  RECORD: 'user',
  THREAD: 'chat',
  PARTNER: 'partners',
  OTHER: 'bell',
};

/** NOT-016 — from two events on, the plural form with its counter. */
export function notificationTitle(n: Pick<StaffNotificationItem, 'title' | 'titlePlural' | 'count'>): string {
  return n.count > 1 && n.titlePlural ? n.titlePlural.replace('{n}', String(n.count)) : n.title;
}

export function NotificationLine({ item, onOpen, now }: { item: StaffNotificationItem; onOpen: (item: StaffNotificationItem) => void; now: number }) {
  const { timeZone } = useShell();
  const link = item.link && isDeliveredPath(item.link) ? item.link : null;
  const body = (
    <>
      <span className={s.notifIcon} aria-hidden="true">
        <Icon name={NOTIFICATION_ICON[item.target]} size={20} />
      </span>
      <span className={s.notifText}>
        <span className={s.notifTitle}>{notificationTitle(item)}</span>
        {item.body ? <span className={s.notifBody}>{item.body}</span> : null}
        <time className={s.notifTime} dateTime={item.updatedAt} title={shortDateTime(item.updatedAt, timeZone)}>
          {relativeTime(item.updatedAt, now, timeZone)}
        </time>
      </span>
      {item.read ? null : <span className={s.unreadDot} role="img" aria-label={t('ui.admin-shell.bell.unread')} />}
    </>
  );
  const className = [s.notif, !item.read && s.notifUnread].filter(Boolean).join(' ');
  // NOT-032 — a click opens the notification and marks it read; without a delivered page, the click only marks it read.
  return link ? (
    <Link href={link} className={className} onClick={() => onOpen(item)}>
      {body}
    </Link>
  ) : (
    <button type="button" className={className} onClick={() => onOpen(item)}>
      {body}
    </button>
  );
}

export function Bell() {
  const { shell, refresh } = useShell();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StaffNotificationItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const known = useRef(shell.unreadNotifications);
  const unread = shell.unreadNotifications;

  const load = useCallback(async () => {
    setFailed(false);
    const r = await adminCall<StaffNotificationList>('/admin/notifications', { query: { pageSize: 10 } });
    if (r.ok) setItems(r.data.data);
    else if (!r.aborted) setFailed(true);
    return r.ok ? r.data.data : null;
  }, []);

  // NOT-019, MSG-043 — a new notification is announced by a brief message while the application is open.
  useEffect(() => {
    if (unread > known.current) {
      void load().then((list) => {
        const latest = list?.find((n) => !n.read);
        if (latest) toast({ tone: 'info', text: notificationTitle(latest) });
      });
    }
    known.current = unread;
  }, [unread, load, toast]);

  const close = useCallback((restore: boolean) => {
    setOpen(false);
    if (restore) button.current?.focus();
  }, []);
  useDismiss(open, close, [wrap]);

  const openItem = async (item: StaffNotificationItem) => {
    setOpen(false);
    if (item.read) return;
    setItems((list) => list?.map((n) => (n.id === item.id ? { ...n, read: true } : n)) ?? null); // TRV-116: shown ahead
    const r = await adminCall('/admin/notifications/read', { body: { ids: [item.id] } });
    if (!r.ok) toast({ tone: 'error', text: t('ui.admin-shell.bell.readFailed'), action: { label: t('ui.common.retry'), run: () => void openItem(item) } });
    await refresh();
  };

  const readAll = async () => {
    const before = items;
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
    const r = await adminCall('/admin/notifications/read-all', { method: 'POST' });
    if (!r.ok) {
      setItems(before);
      toast({ tone: 'error', text: t('ui.admin-shell.bell.readFailed'), action: { label: t('ui.common.retry'), run: () => void readAll() } });
    }
    signalShellChanged();
  };

  const label = unread > 0 ? t('ui.admin-shell.bell.labelCount', { n: unread }) : t('ui.admin-shell.bell.label');
  const now = Date.now();
  return (
    <div className={s.bellWrap} ref={wrap}>
      <button
        ref={button}
        type="button"
        className={s.iconButton}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
      >
        <Icon name="bell" size={20} />
        {unread > 0 ? (
          <span className={s.bellCount} aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className={s.bellPanel} role="dialog" aria-label={t('ui.admin-shell.bell.title')}>
          <header className={s.bellHead}>
            <h2>{t('ui.admin-shell.bell.title')}</h2>
          </header>
          <div className={s.bellList}>
            {failed ? (
              <EmptyState
                compact
                icon="status-error"
                title={t('ui.common.error.block')}
                actions={
                  <Button variant="secondary" size="S" onClick={() => void load()}>
                    {t('ui.common.retry')}
                  </Button>
                }
              />
            ) : items === null ? (
              <p className={s.bellLoading} role="status">
                {t('ui.common.loading')}
              </p>
            ) : items.length === 0 ? (
              <EmptyState compact icon="bell" title={t('ui.admin-shell.bell.emptyTitle')} text={t('ui.admin-shell.bell.emptyText')} />
            ) : (
              items.map((n) => <NotificationLine key={n.id} item={n} onOpen={(item) => void openItem(item)} now={now} />)
            )}
          </div>
          <footer className={s.bellFoot}>
            <button type="button" className={s.bellAction} onClick={() => void readAll()} disabled={unread === 0}>
              {t('ui.admin-shell.bell.readAll')}
            </button>
            <Link href="/notifications" className={s.bellAction} onClick={() => setOpen(false)}>
              {t('ui.common.seeAll')}
            </Link>
          </footer>
        </div>
      ) : null}
    </div>
  );
}

// ─── Account menu (BO-013) ──────────────────────────────────────────────────

/** BO-013, CRM-021 — « Je suis absent » from the account menu: the last day of the absence. */
function AbsenceDialog({ open, close }: { open: boolean; close: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [day, setDay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const min = new Intl.DateTimeFormat('en-CA').format(new Date());
  const save = async () => {
    if (!day) return setError(t('ui.validation.REQUIRED'));
    setPending(true);
    setError(null);
    const r = await adminCall('/admin/me', { method: 'PATCH', body: { absentUntil: day } });
    setPending(false);
    if (!r.ok) return setError(errorText(r));
    toast({ text: t('ui.admin-shell.account.absentSaved', { date: longDay(day) }) });
    signalShellChanged();
    router.refresh();
    close();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={t('ui.admin-shell.account.absentTitle')}
      closeLabel={t('ui.common.close')}
      footer={
        <>
          <Button variant="secondary" size="M" onClick={close}>
            {t('ui.common.cancel')}
          </Button>
          <Button variant="tool" size="M" pending={pending} onClick={() => void save()}>
            {t('ui.admin-shell.account.absentSubmit')}
          </Button>
        </>
      }
    >
      <div className={s.absenceForm}>
        <p>{t('ui.admin-shell.account.absentText')}</p>
        <label className={s.absenceLabel}>
          {t('ui.admin-shell.account.absentUntil')}
          <input type="date" className={s.absenceInput} value={day} min={min} onChange={(e) => setDay(e.target.value)} aria-invalid={error ? true : undefined} />
        </label>
        {error ? <p className={s.absenceError}>{error}</p> : null}
      </div>
    </Modal>
  );
}

export function AccountMenu() {
  const { shell } = useShell();
  const router = useRouter();
  const toast = useToast();
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const absentUntil = shell.user.absentUntil;
  const back = async () => {
    const r = await adminCall('/admin/me', { method: 'PATCH', body: { absentUntil: null } });
    if (!r.ok) return toast({ tone: 'error', text: errorText(r) });
    toast({ text: t('ui.admin-shell.account.backSaved') });
    signalShellChanged();
    router.refresh();
  };
  const name = [shell.user.firstName, shell.user.lastName].filter(Boolean).join(' ') || shell.user.email;
  const initials = [shell.user.firstName, shell.user.lastName]
    .map((p) => p?.charAt(0) ?? '')
    .join('')
    .toUpperCase();
  return (
    <>
    <Menu
      label={t('ui.admin-shell.account.label')}
      triggerClassName={s.account}
      trigger={
        <>
          <span className={[s.avatar, absentUntil && s.avatarAway].filter(Boolean).join(' ')} aria-hidden="true">
            {initials || <Icon name="user" size={16} />}
          </span>
          <span className={s.accountText}>
            <span className={s.accountName}>{name}</span>
            <span className={absentUntil ? s.accountAway : s.accountRole}>{absentUntil ? t('ui.admin-shell.account.absentShort', { date: shortDay(absentUntil) }) : t(`ui.enum.MembershipRole.${shell.role}`)}</span>
          </span>
          <Icon name="chevron-down" size={16} />
        </>
      }
      header={
        <>
          <strong className={s.accountName}>{name}</strong>
          <span className={s.accountRole}>{t(`ui.enum.MembershipRole.${shell.role}`)}</span>
        </>
      }
      items={[
        { key: 'preferences', label: t('ui.admin-shell.account.preferences'), icon: 'sliders', onSelect: () => router.push('/preferences') },
        absentUntil
          ? { key: 'back', label: t('ui.admin-shell.account.back'), icon: 'check', onSelect: () => void back() }
          : { key: 'absent', label: t('ui.admin-shell.account.absent'), icon: 'calendar', onSelect: () => setAbsenceOpen(true) },
        { key: 'signOut', label: t('ui.admin-shell.account.signOut'), icon: 'logout', onSelect: () => void signOut(), separated: true },
      ]}
    />
    <AbsenceDialog open={absenceOpen} close={() => setAbsenceOpen(false)} />
    </>
  );
}
