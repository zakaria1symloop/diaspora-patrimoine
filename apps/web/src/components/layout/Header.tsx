'use client';
// NAV-010 … NAV-016 — header: brand, six entries (« Les biens » first, D-095), « Se connecter » / « Mon espace ».
// Sticky, one height; background and shadow once the page has scrolled; transparent over the home hero; full-screen menu under 1024px.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, TextSizeControl, buttonClass, ButtonInner } from '@dp/ui';
import { SimpleModeSwitch } from './SimpleMode';
import { t } from '@/lib/i18n';
import { Brand } from './Brand';
import { mainNav, mobileNav } from './nav';
import { useClientSession } from '@/lib/session-client';
import { signOut } from '@/lib/auth-client';
import s from './Header.module.css';

export interface HeaderProps {
  tagline: string | null;
  cafeEnabled: boolean;
}

export function Header({ tagline, cafeEnabled }: HeaderProps) {
  const pathname = usePathname() ?? '/';
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const session = useClientSession();
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const isHome = pathname === '/';

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    menuButton.current?.focus();
  }, []);

  // NAV-014: Escape closes, page scroll is locked while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // NAV-013 — the « Mon espace » menu closes on Escape and on a click outside.
  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAccountOpen(false);
    const onDown = (e: PointerEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [accountOpen]);

  const logout = useCallback(async () => {
    setAccountOpen(false);
    setOpen(false);
    await signOut('WEB');
    router.push('/');
  }, [router]);

  const entries = mainNav.filter((e) => cafeEnabled || !e.cafe);
  const accountHref = session.status === 'authenticated' ? '/espace-client' : '/connexion';
  const accountLabel = session.status === 'authenticated' ? t('ui.nav.header.mySpace') : t('ui.nav.header.login');

  return (
    <header className={[s.header, isHome && s.transparent, compact && s.compact].filter(Boolean).join(' ')}>
      <div className={`container ${s.inner}`}>
        <Brand tagline={tagline} homeLabel={t('ui.nav.header.home')} compact={compact} priority />

        <nav className={s.nav} aria-label={t('ui.nav.header.mainNav')}>
          <ul className={s.navList} role="list">
            {entries.map((e) => {
              const current = e.match.test(pathname);
              return (
                <li key={e.href} className={s.navItem}>
                  <Link
                    href={e.href}
                    className={[s.navLink, e.cafe && s.cafe].filter(Boolean).join(' ')}
                    aria-current={current ? 'page' : undefined}
                  >
                    <Icon name={e.icon} size={32} className={s.navIcon} />
                    {t(e.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={s.actions}>
          {session.status === 'authenticated' ? (
            // NAV-013 — « Mon espace », with a badge for unread notifications; its menu lists the delivered pages only:
            // Tableau de bord · Messages · Mon dossier · Mon profil · Se déconnecter (package 2.8).
            <div className={s.account} ref={accountRef} onMouseEnter={() => setAccountOpen(true)} onMouseLeave={() => setAccountOpen(false)}>
              <button
                type="button"
                className={`${buttonClass('primary', 'M')} ${s.login}`}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-controls="menu-espace"
                onClick={() => setAccountOpen((v) => !v)}
              >
                <ButtonInner chevron size="M">
                  {accountLabel}
                  {session.unread > 0 ? (
                    <span className={s.badge} aria-label={t('ui.nav.header.unread', { n: session.unread })}>
                      {session.unread > 99 ? '99+' : session.unread}
                    </span>
                  ) : null}
                </ButtonInner>
              </button>
              {accountOpen ? (
                <ul id="menu-espace" className={s.accountMenu} role="menu">
                  <li role="none">
                    <Link role="menuitem" href="/espace-client" className={s.accountItem}>
                      <Icon name="home" size={20} />
                      {t('ui.nav.header.spaceMenu.dashboard')}
                    </Link>
                  </li>
                  {/* NAV-013 — Messages (its page is the form of MSG-021), Mon dossier (if he has one), Mon profil. */}
                  <li role="none">
                    <Link role="menuitem" href="/espace-client/messages" className={s.accountItem}>
                      <Icon name="chat" size={20} />
                      {t('ui.client.menu.messages')}
                    </Link>
                  </li>
                  {session.status === 'authenticated' && session.hasDossier ? (
                    <li role="none">
                      <Link role="menuitem" href="/espace-client/dossiers" className={s.accountItem}>
                        <Icon name="folder" size={20} />
                        {t('ui.client.menu.dossier')}
                      </Link>
                    </li>
                  ) : null}
                  <li role="none">
                    <Link role="menuitem" href="/espace-client/profil" className={s.accountItem}>
                      <Icon name="user" size={20} />
                      {t('ui.client.shell.myProfile')}
                    </Link>
                  </li>
                  <li role="none">
                    <button role="menuitem" type="button" className={s.accountItem} onClick={() => void logout()}>
                      <Icon name="logout" size={20} />
                      {t('ui.nav.header.spaceMenu.logout')}
                    </button>
                  </li>
                </ul>
              ) : null}
            </div>
          ) : (
            <Link href={accountHref} className={`${buttonClass('primary', 'M')} ${s.login}`}>
              <ButtonInner chevron size="M">
                {accountLabel}
              </ButtonInner>
            </Link>
          )}
          <button
            ref={menuButton}
            type="button"
            className={s.menuButton}
            aria-expanded={open}
            aria-controls="menu-mobile"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" label={t('ui.nav.header.menu')} />
          </button>
        </div>
      </div>

      {open ? (
        <div id="menu-mobile" className={s.sheet} role="dialog" aria-modal="true" aria-label={t('ui.nav.header.menu')}>
          <div className={`container ${s.sheetTop}`}>
            <Brand tagline={null} homeLabel={t('ui.nav.header.home')} compact />
            <button type="button" className={s.menuButton} style={{ display: 'inline-flex' }} onClick={close} autoFocus>
              <Icon name="close" label={t('ui.nav.header.closeMenu')} />
            </button>
          </div>
          <nav className="container" aria-label={t('ui.nav.header.mainNav')}>
            <ul className={s.sheetList} role="list">
              {mobileNav
                .filter((e) => cafeEnabled || !e.cafe)
                .map((e) => (
                  <li key={e.href}>
                    <Link
                      href={e.href}
                      className={[s.sheetLink, e.cafe && s.sheetCafe].filter(Boolean).join(' ')}
                      aria-current={pathname === e.href || pathname.startsWith(`${e.href}/`) ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <Icon name={e.icon} size={24} className={s.sheetIcon} />
                      <span className={s.sheetLabel}>{t(e.label)}</span>
                      <Icon name="chevron-right" size={20} />
                    </Link>
                  </li>
                ))}
            </ul>
            <div className={s.sheetFooter}>
              <Link href={accountHref} className={buttonClass('primary', 'L', true)} onClick={() => setOpen(false)}>
                <ButtonInner chevron size="L">
                  {accountLabel}
                </ButtonInner>
              </Link>
              {session.status === 'authenticated' ? (
                <button type="button" className={buttonClass('secondary', 'L', true)} onClick={() => void logout()}>
                  <ButtonInner size="L">{t('ui.nav.header.spaceMenu.logout')}</ButtonInner>
                </button>
              ) : null}
              <TextSizeControl
                labels={{
                  title: t('ui.common.textSize.title'),
                  normal: t('ui.common.textSize.normal'),
                  large: t('ui.common.textSize.large'),
                  xlarge: t('ui.common.textSize.xlarge'),
                  sample: t('ui.common.textSize.sample'),
                }}
              />
              <SimpleModeSwitch />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
