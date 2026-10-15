'use client';
// ECL-001, ECL-002, ECL-005, NAV-021, TRV-124, DSN-073 — the frame of every page of the client space, its own door
// (D-091…D-093: one door per actor, not the public chrome): on a computer, a side menu and a top bar (logo back to the
// site, « Voir les programmes », « Écrire à mon conseiller », the bell, « Aa », the account menu); on a phone, a
// compact top bar, five tabs at the bottom and « Écrire à mon conseiller » just above them; the footer is reduced to
// the legal line. The content fades in rising 8 px on each change of screen; the frame stays still.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { LocalKeys } from '@dp/contracts';
import { Icon, TextSizeControl } from '@dp/ui';
import { signOut } from '@/lib/auth-client';
import { refreshClientSession } from '@/lib/session-client';
import { t } from '@/lib/i18n';
import { Brand } from '@/components/layout/Brand';
import { MORE_KEYS, PHONE_TABS, SPACE_ROOT, visibleMenu, type MenuEntry } from './menu';
import { useSpace } from './SpaceContext';
import { SpaceToasts } from './SpaceToasts';
import { writeToAdvisorHref } from './advisor-link';
import s from './shell.module.css';

const badgeText = (n: number) => (n > 99 ? '99+' : String(n));

function initials(first: string | null, last: string | null, email: string): string {
  const a = (first ?? '').trim().charAt(0);
  const b = (last ?? '').trim().charAt(0);
  return (a + b || email.charAt(0)).toUpperCase();
}

/** Closes a popover on Escape and on a click outside. */
function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, close, ref]);
}

function MenuLink({ entry, pathname, ctx, nested }: { entry: MenuEntry; pathname: string; ctx: ReturnType<typeof useSpace>['menu']; nested?: boolean }) {
  const current = entry.match.test(pathname);
  const n = entry.badge?.(ctx) ?? 0;
  return (
    <Link href={entry.href(ctx)} className={[s.navLink, nested && s.navNested].filter(Boolean).join(' ')} aria-current={current ? 'page' : undefined}>
      <Icon name={entry.icon} size={nested ? 20 : 24} className={s.navIcon} />
      <span className={s.navLabel}>{t(entry.label)}</span>
      {n > 0 ? (
        <span className={s.badge} aria-label={t('ui.client.shell.badgeNew', { n })}>
          {badgeText(n)}
        </span>
      ) : null}
    </Link>
  );
}

/** TRV-122 — « Affichage simplifié », kept in the browser (`dp_simple_mode`); the frame carries `data-simple`. */
function useSimpleMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(localStorage.getItem(LocalKeys.simpleMode) === '1');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const change = useCallback((next: boolean) => {
    setOn(next);
    try {
      if (next) localStorage.setItem(LocalKeys.simpleMode, '1');
      else localStorage.removeItem(LocalKeys.simpleMode);
    } catch {
      /* storage unavailable: the choice lasts for the page */
    }
  }, []);
  return [on, change];
}

function SimpleSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const id = useId();
  return (
    <div className={s.simple}>
      <button type="button" role="switch" aria-checked={on} aria-describedby={id} className={s.switch} onClick={() => onChange(!on)}>
        <span className={s.switchTrack} aria-hidden="true">
          <span className={s.switchThumb} />
        </span>
        <span className={s.switchLabel}>{t('ui.common.simpleMode.label')}</span>
      </button>
      <p id={id} className={s.simpleHelp}>
        {t('ui.common.simpleMode.help')}
      </p>
    </div>
  );
}

export function SpaceShell({ children, tagline, readOnly = false }: { children: ReactNode; tagline: string | null; readOnly?: boolean }) {
  const pathname = usePathname() ?? SPACE_ROOT;
  const router = useRouter();
  const { summary, settings, menu } = useSpace();
  const entries = visibleMenu(menu);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [simple, setSimple] = useSimpleMode();
  const accountRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const accountId = useId();
  const sizeId = useId();

  const closeAccount = useCallback(() => setAccountOpen(false), []);
  const closeSize = useCallback(() => setSizeOpen(false), []);
  useDismiss(accountOpen, closeAccount, accountRef);
  useDismiss(sizeOpen, closeSize, sizeRef);

  useEffect(() => {
    setAccountOpen(false);
    setSizeOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  // « Plus » — a sheet: Escape closes it, the page does not scroll behind it.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false);
        moreButton.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [moreOpen]);

  const logout = useCallback(async () => {
    setLeaving(true);
    await signOut('WEB');
    refreshClientSession();
    router.push('/');
  }, [router]);

  // TRV-126 — « Revoir la visite »: the dashboard listens; from another page, go there first.
  const replayTour = useCallback(() => {
    setAccountOpen(false);
    try {
      localStorage.removeItem('dp_tour_space');
    } catch {
      /* storage unavailable */
    }
    if (pathname === SPACE_ROOT) window.dispatchEvent(new Event('dp:tour'));
    else router.push(`${SPACE_ROOT}?visite=1`);
  }, [pathname, router]);

  // ECL-002 — until EC-31, the bell leads to « Dernières nouvelles » on the dashboard.
  const bellHref = `${SPACE_ROOT}#dernieres-nouvelles`;
  const onBell = (e: React.MouseEvent) => {
    if (pathname === SPACE_ROOT) {
      e.preventDefault();
      const el = document.getElementById('dernieres-nouvelles');
      el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      el?.focus({ preventScroll: true });
    }
  };
  const unread = summary.unreadNotifications;
  const onMessages = /^\/espace-client\/messages(\/|$)/.test(pathname);
  const sizeLabels = {
    title: t('ui.common.textSize.title'),
    normal: t('ui.common.textSize.normal'),
    large: t('ui.common.textSize.large'),
    xlarge: t('ui.common.textSize.xlarge'),
    sample: t('ui.common.textSize.sample'),
  };
  const firstName = summary.firstName?.trim() || null;
  const more = entries.filter((e) => MORE_KEYS.includes(e.key));
  const year = new Date().getFullYear();

  return (
    <div className={s.frame} data-space-frame data-simple={simple ? '' : undefined}>
      <a href="#contenu" className="skip-link">
        {t('ui.nav.skipToContent')}
      </a>

      <aside className={s.side} aria-label={t('ui.client.shell.menu')}>
        <div className={s.sideBrand}>
          <Brand tagline={tagline} homeLabel={t('ui.client.shell.backToSite')} compact />
        </div>
        <nav className={s.nav} aria-label={t('ui.client.shell.menu')}>
          <ul role="list" className={s.navList}>
            {entries.map((e) => (
              <li key={e.key}>
                <MenuLink entry={e} pathname={pathname} ctx={menu} />
                {e.children?.length ? (
                  <ul role="list" className={s.navChildren}>
                    {e.children.map((c) => (
                      <li key={c.key}>
                        <MenuLink entry={c} pathname={pathname} ctx={menu} nested />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
        <div className={s.sideHelp}>
          <p className={s.sideHelpTitle}>{t('ui.client.shell.helpTitle')}</p>
          <p className={s.sideHelpText}>{t('ui.client.shell.helpText')}</p>
          <Link href={writeToAdvisorHref({ from: 'ADVISOR' })} className={s.sideHelpLink}>
            <Icon name="chat" size={20} />
            {t('ui.common.writeToAdvisor')}
          </Link>
        </div>
      </aside>

      <div className={s.column}>
        <header className={s.top}>
          <div className={s.topBrand}>
            <Brand tagline={null} homeLabel={t('ui.client.shell.backToSite')} compact />
          </div>
          <Link href="/programmes" className={s.topLink}>
            <Icon name="search" size={20} />
            {t('ui.client.shell.browse')}
          </Link>
          <div className={s.topActions}>
            <Link href={writeToAdvisorHref({ from: 'ADVISOR' })} className={s.writeButton} aria-current={onMessages ? 'page' : undefined}>
              <Icon name="chat" size={20} />
              {t('ui.common.writeToAdvisor')}
            </Link>
            <Link
              href={bellHref}
              onClick={onBell}
              className={s.iconButton}
              aria-label={unread > 0 ? t('ui.client.shell.bellUnread', { n: unread }) : t('ui.client.shell.bell')}
            >
              <Icon name="bell" size={24} />
              {unread > 0 ? (
                <span className={s.bellCount} aria-hidden="true">
                  {badgeText(unread)}
                </span>
              ) : null}
            </Link>
            <div className={s.popWrap} ref={sizeRef}>
              <button
                type="button"
                className={`${s.iconButton} ${s.aa}`}
                aria-expanded={sizeOpen}
                aria-controls={sizeId}
                aria-label={t('ui.common.textSize.title')}
                onClick={() => setSizeOpen((v) => !v)}
              >
                <span aria-hidden="true">Aa</span>
              </button>
              {sizeOpen ? (
                <div id={sizeId} className={`${s.popover} ${s.sizePop}`}>
                  <TextSizeControl labels={sizeLabels} />
                  <SimpleSwitch on={simple} onChange={setSimple} />
                </div>
              ) : null}
            </div>
            <div className={s.popWrap} ref={accountRef}>
              <button
                type="button"
                className={s.account}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-controls={accountId}
                onClick={() => setAccountOpen((v) => !v)}
              >
                <span className={s.avatar} aria-hidden="true">
                  {initials(summary.firstName, summary.lastName, summary.email)}
                </span>
                <span className={s.accountName}>{firstName ?? t('ui.client.shell.account')}</span>
                <Icon name="chevron-down" size={16} className={s.accountChevron} />
              </button>
              {accountOpen ? (
                <ul id={accountId} role="menu" className={`${s.popover} ${s.accountMenu}`}>
                  <li role="none">
                    <Link role="menuitem" href={`${SPACE_ROOT}/profil`} className={s.menuItem}>
                      <Icon name="user" size={20} />
                      {t('ui.client.shell.myProfile')}
                    </Link>
                  </li>
                  <li role="none">
                    <button role="menuitem" type="button" className={s.menuItem} onClick={replayTour}>
                      <Icon name="sparkles" size={20} />
                      {t('ui.common.tour.replay')}
                    </button>
                  </li>
                  <li role="none">
                    <button role="menuitem" type="button" className={s.menuItem} disabled={leaving} onClick={() => void logout()}>
                      <Icon name="logout" size={20} />
                      {leaving ? t('ui.client.shell.loggingOut') : t('ui.client.shell.logout')}
                    </button>
                  </li>
                </ul>
              ) : null}
            </div>
          </div>
        </header>

        <main id="contenu" tabIndex={-1} className={s.main}>
          <div key={pathname} className={s.screen}>
            {/* ROL-017, ECL-004 — in a preview every button and field is disabled; the links still lead (reading only) */}
            {readOnly ? (
              <fieldset disabled className={s.readOnly} data-preview="">
                {children}
              </fieldset>
            ) : (
              children
            )}
          </div>
        </main>

        {/* NAV-021 — reduced to the legal line. */}
        <footer className={s.footer}>
          <ul role="list" className={s.legal}>
            <li>{t('ui.nav.footer.copyright', { annee: String(year), societe: settings.companyName })}</li>
            <li>
              <Link href="/mentions-legales">{t('ui.nav.footer.legal')}</Link>
            </li>
            <li>
              <Link href="/confidentialite">{t('ui.nav.footer.privacy')}</Link>
            </li>
            <li>
              <Link href="/conditions-generales">{t('ui.nav.footer.terms')}</Link>
            </li>
            <li>
              <Link href="/cookies">{t('ui.nav.footer.cookies')}</Link>
            </li>
          </ul>
        </footer>
      </div>

      {/* ECL-002 — on a phone, « Écrire à mon conseiller » sits just above the tabs (absent on its own page). */}
      {!onMessages ? (
        <Link href={writeToAdvisorHref({ from: 'ADVISOR' })} className={s.writeFab}>
          <Icon name="chat" size={20} />
          {t('ui.common.writeToAdvisor')}
        </Link>
      ) : null}

      <nav className={s.tabs} aria-label={t('ui.client.shell.tabs')}>
        <ul role="list" className={s.tabList}>
          {PHONE_TABS.map((tab) => {
            const current = tab.match.test(pathname) || (tab.key === 'more' && moreOpen);
            const n = tab.badge?.(menu) ?? 0;
            const inner = (
              <>
                <span className={s.tabIcon}>
                  <Icon name={tab.icon} size={24} />
                  {n > 0 ? (
                    <span className={s.tabBadge} aria-hidden="true">
                      {badgeText(n)}
                    </span>
                  ) : null}
                </span>
                <span className={s.tabLabel}>{t(tab.label)}</span>
                {n > 0 ? <span className="visually-hidden">{t('ui.client.shell.badgeNew', { n })}</span> : null}
              </>
            );
            return (
              <li key={tab.key} className={s.tabItem}>
                {tab.href ? (
                  <Link href={tab.href(menu)} className={s.tab} aria-current={current ? 'page' : undefined}>
                    {inner}
                  </Link>
                ) : (
                  <button
                    ref={moreButton}
                    type="button"
                    className={s.tab}
                    aria-expanded={moreOpen}
                    aria-controls="espace-plus"
                    aria-current={current ? 'page' : undefined}
                    onClick={() => setMoreOpen((v) => !v)}
                  >
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {moreOpen ? (
        <div className={s.sheetBackdrop} onClick={() => setMoreOpen(false)}>
          <div id="espace-plus" className={s.sheet} role="dialog" aria-modal="true" aria-label={t('ui.client.tabs.more')} onClick={(e) => e.stopPropagation()}>
            <div className={s.sheetHead}>
              <span className={s.sheetTitle}>{t('ui.client.tabs.more')}</span>
              <button type="button" className={s.iconButton} onClick={() => setMoreOpen(false)} autoFocus>
                <Icon name="close" size={24} label={t('ui.client.shell.close')} />
              </button>
            </div>
            <ul role="list" className={s.sheetList}>
              {more.map((e) => (
                <li key={e.key}>
                  <MenuLink entry={e} pathname={pathname} ctx={menu} />
                </li>
              ))}
              <li>
                <Link href={`${SPACE_ROOT}/profil`} className={s.navLink} aria-current={/^\/espace-client\/profil/.test(pathname) ? 'page' : undefined}>
                  <Icon name="user" size={24} className={s.navIcon} />
                  <span className={s.navLabel}>{t('ui.client.shell.myProfile')}</span>
                </Link>
              </li>
              <li>
                <button type="button" className={s.navLink} onClick={replayTour}>
                  <Icon name="sparkles" size={24} className={s.navIcon} />
                  <span className={s.navLabel}>{t('ui.common.tour.replay')}</span>
                </button>
              </li>
              <li>
                <button type="button" className={s.navLink} disabled={leaving} onClick={() => void logout()}>
                  <Icon name="logout" size={24} className={s.navIcon} />
                  <span className={s.navLabel}>{leaving ? t('ui.client.shell.loggingOut') : t('ui.client.shell.logout')}</span>
                </button>
              </li>
            </ul>
            <div className={s.sheetSize}>
              <TextSizeControl labels={sizeLabels} />
              <SimpleSwitch on={simple} onChange={setSimple} />
            </div>
          </div>
        </div>
      ) : null}

      <SpaceToasts />
    </div>
  );
}
