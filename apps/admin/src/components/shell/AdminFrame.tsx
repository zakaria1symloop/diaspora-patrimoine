'use client';
// BO-010, BO-011, BO-014, DSN-090 — the frame of the back office: a side menu (248 px, 64 folded to icons; a drawer on a
// narrow screen), a top bar of 64 px, and the work zone on the grey ground. The menu is built from ONE definition
// (`menu.ts`): an entry appears only when the role may read it and its screen is delivered. The frame also carries the
// permanent banners, the brief messages (5 s, TRV-081), the session (BO-004) and the guard of unsaved forms (TRV-093).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { AdminShell } from '@dp/contracts';
import { Banner, Button, Icon, Modal, ToastProvider } from '@dp/ui';
import logo from '@dp/ui/assets/logo.png';
import wordmarkDark from '@dp/ui/assets/wordmark-dark.svg';
import { shortDateTime, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { menuFor, type MenuEntry } from './menu';
import { SessionKeeper } from './SessionKeeper';
import { ShellProvider, useShell } from './ShellContext';
import { AccountMenu, Bell, CreateMenu, GlobalSearch, HelpButton } from './TopBar';
import s from './frame.module.css';

const FOLD_KEY = 'dp_admin_menu';

export function AdminFrame({ shell, children }: { shell: AdminShell; children: ReactNode }) {
  return (
    <ShellProvider initial={shell}>
      <ToastProvider duration={5000} closeLabel={t('ui.common.close')}>
        <Frame>{children}</Frame>
        <SessionKeeper email={shell.user.email} />
        <UnsavedGuard />
      </ToastProvider>
    </ShellProvider>
  );
}

function isCurrent(entry: MenuEntry, pathname: string, all: MenuEntry[]): boolean {
  if (pathname !== entry.href && !pathname.startsWith(`${entry.href}/`)) return false;
  // the longest matching address wins (`/dossiers/pipeline` over `/dossiers`)
  return !all.some((o) => o !== entry && o.href.length > entry.href.length && (pathname === o.href || pathname.startsWith(`${o.href}/`)));
}

function Frame({ children }: { children: ReactNode }) {
  const { shell } = useShell();
  const pathname = usePathname() ?? '/';
  const [folded, setFolded] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const main = useRef<HTMLElement>(null);
  const groups = menuFor(shell.permissions);
  const entries = groups.flatMap((g) => g.entries);

  useEffect(() => {
    try {
      setFolded(localStorage.getItem(FOLD_KEY) === 'folded');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggleFold = () => {
    setFolded((v) => {
      try {
        localStorage.setItem(FOLD_KEY, v ? 'open' : 'folded');
      } catch {
        /* storage unavailable */
      }
      return !v;
    });
  };
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  return (
    <div className={[s.frame, folded && s.folded, drawer && s.drawerOpen].filter(Boolean).join(' ')}>
      <aside className={`${s.side} icons-dark`}>
        <div className={s.brand}>
          <Image src={logo} alt="" className={s.logo} sizes="40px" priority />
          <Image src={wordmarkDark} alt={shell.contact.companyName} className={s.wordmark} unoptimized priority />
        </div>
        <nav className={s.nav} aria-label={t('ui.admin-shell.menu.label')}>
          {groups.map((g) => (
            <div key={g.key} className={s.group}>
              {g.label ? <p className={s.groupLabel}>{t(g.label)}</p> : null}
              <ul role="list" className={s.entries}>
                {g.entries.map((entry) => {
                  const current = isCurrent(entry, pathname, entries);
                  const count = entry.badge ? shell.badges[entry.badge] : undefined;
                  return (
                    <li key={entry.key}>
                      <Link href={entry.href} className={[s.entry, current && s.current].filter(Boolean).join(' ')} aria-current={current ? 'page' : undefined} title={folded ? t(entry.label) : undefined}>
                        <Icon name={entry.icon} size={20} />
                        <span className={s.entryLabel}>{t(entry.label)}</span>
                        {count ? (
                          <span className={s.badge}>
                            <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
                            <span className="visually-hidden">{t(`ui.admin-shell.menu.badge.${entry.badge!}`, { n: count })}</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <button type="button" className={s.fold} onClick={toggleFold} aria-pressed={folded}>
          <Icon name={folded ? 'chevron-right' : 'chevron-left'} size={16} />
          <span className={s.entryLabel}>{folded ? t('ui.admin-shell.menu.unfold') : t('ui.admin-shell.menu.fold')}</span>
        </button>
      </aside>
      {drawer ? <button type="button" className={s.veil} aria-label={t('ui.common.close')} onClick={() => setDrawer(false)} /> : null}

      <div className={s.column}>
        <header className={s.top}>
          <button type="button" className={`${s.iconButton} ${s.burger}`} onClick={() => setDrawer(true)} aria-label={t('ui.admin-shell.menu.open')} aria-expanded={drawer}>
            <Icon name="menu" size={20} />
          </button>
          <GlobalSearch />
          <div className={s.topTools}>
            <CreateMenu />
            <HelpButton />
            <Bell />
            <AccountMenu />
          </div>
        </header>
        <main className={s.main} id="contenu" ref={main} tabIndex={-1}>
          <Banners />
          <Connection />
          <div className={s.work} key={pathname}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/** BO-014 — permanent banners at the top of the work zone, when they apply. */
function Banners() {
  const { shell, timeZone } = useShell();
  const b = shell.banners;
  const lines: { key: string; tone: 'warning' | 'info'; text: string }[] = [];
  if (b.environment !== 'production') lines.push({ key: 'env', tone: 'warning', text: t(b.environment === 'local' ? 'ui.admin-shell.banner.local' : 'ui.admin-shell.banner.staging') });
  if (b.shiftedClockDate) lines.push({ key: 'clock', tone: 'warning', text: t('ui.admin-shell.banner.clock', { date: shortDay(b.shiftedClockDate) }) });
  if (b.elevatedUntil) lines.push({ key: 'elevated', tone: 'warning', text: t('ui.admin-shell.banner.elevated', { date: shortDateTime(b.elevatedUntil, timeZone) }) });
  if (b.maintenance) lines.push({ key: 'maintenance', tone: 'info', text: t('ui.admin-shell.banner.maintenance') });
  if (b.masked) lines.push({ key: 'masked', tone: 'info', text: t('ui.admin-shell.banner.masked') });
  if (!lines.length) return null;
  return (
    <div className={s.banners}>
      {lines.map((l) => (
        <p key={l.key} className={`${s.bannerLine} ${s[`banner-${l.tone}`]}`} role="status">
          <Icon name={l.tone === 'warning' ? 'status-warning' : 'status-info'} size={16} />
          {l.text}
        </p>
      ))}
    </div>
  );
}

/** TRV-082, TRV-114 — connection lost: a banner while it lasts; « Connexion rétablie. » for 3 seconds when it is back. */
function Connection() {
  const [state, setState] = useState<'online' | 'offline' | 'back'>('online');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = () => setState('offline');
    const on = () => {
      setState((s) => (s === 'offline' ? 'back' : s));
      timer = setTimeout(() => setState('online'), 3000);
    };
    if (!navigator.onLine) off();
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
      if (timer) clearTimeout(timer);
    };
  }, []);
  if (state === 'online') return null;
  return (
    <p className={`${s.bannerLine} ${state === 'offline' ? s['banner-warning'] : s['banner-info']}`} role="status" aria-live="polite">
      <Icon name={state === 'offline' ? 'status-warning' : 'status-success'} size={16} />
      {state === 'offline' ? t('ui.common.offline') : t('ui.common.online')}
    </p>
  );
}

/**
 * TRV-093 — leaving a modified, unsaved form inside the application: « Vous avez des modifications non enregistrées.
 * Quitter sans enregistrer ? » — « Rester » / « Quitter ». A form declares itself with `useUnsavedGuard(dirty)`.
 */
function UnsavedGuard() {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!document.documentElement.dataset.unsaved || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return (
    <Modal
      open={target !== null}
      onClose={() => setTarget(null)}
      title={t('ui.common.unsaved.title')}
      closeLabel={t('ui.common.close')}
      footer={
        <>
          <Button
            variant="secondary"
            size="M"
            onClick={() => {
              const to = target;
              delete document.documentElement.dataset.unsaved;
              setTarget(null);
              if (to) router.push(to);
            }}
          >
            {t('ui.common.unsaved.leave')}
          </Button>
          <Button variant="tool" size="M" onClick={() => setTarget(null)} autoFocus>
            {t('ui.common.unsaved.stay')}
          </Button>
        </>
      }
    >
      <p>{t('ui.common.unsaved.text')}</p>
    </Modal>
  );
}

/** For a page outside any list or record (an error state of the frame). */
export function FrameNotice({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return <Banner tone={tone}>{children}</Banner>;
}
