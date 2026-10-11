'use client';
// NAV-050 — consent banner (EP-30), only when a consent-based service is active (analytics.enabled).
// Three buttons of equal weight; nothing consent-based loads before a « yes »; choice kept 6 months (dp_consent);
// « Personnaliser » opens a two-line window; closing it without choosing is neither yes nor no.
// Global Privacy Control counts as a refusal (NAV-052). One fixed bottom element at a time (D-095): the banner wins.
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './CookieConsent.module.css';

const COOKIE = 'dp_consent';
const MAX_AGE = 60 * 60 * 24 * 182; // 6 months

export interface Consent {
  analytics: boolean;
}

export function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  return { analytics: raw.slice(COOKIE.length + 1) === 'analytics' };
}

function writeConsent(c: Consent): void {
  document.cookie = `${COOKIE}=${c.analytics ? 'analytics' : 'none'}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${
    location.protocol === 'https:' ? '; Secure' : ''
  }`;
  window.dispatchEvent(new CustomEvent('dp:consent', { detail: c }));
}

/** Lets the rest of the page know whether the banner is on screen (one bottom element at a time). */
function setBannerOpen(open: boolean): void {
  document.documentElement.toggleAttribute('data-consent-open', open);
}

export function ManageCookiesButton({ className, label }: { className?: string; label: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event('dp:consent-open'))}>
      {label}
    </button>
  );
}

export function CookieConsent({ enabled }: { enabled: boolean }) {
  const [banner, setBanner] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
    const existing = readConsent();
    if (!existing && gpc) writeConsent({ analytics: false });
    else if (!existing) setBanner(true);
    const reopen = () => {
      opener.current = document.activeElement as HTMLElement | null;
      setAnalytics(readConsent()?.analytics ?? false);
      setBanner(true);
    };
    window.addEventListener('dp:consent-open', reopen);
    return () => window.removeEventListener('dp:consent-open', reopen);
  }, [enabled]);

  useEffect(() => setBannerOpen(banner), [banner]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (customize && !d.open) d.showModal();
    if (!customize && d.open) d.close();
  }, [customize]);

  const decide = useCallback((c: Consent) => {
    writeConsent(c);
    setCustomize(false);
    setBanner(false);
    opener.current?.focus();
  }, []);

  if (!enabled || !banner) return null;

  return (
    <>
      <section className={s.banner} data-consent aria-label={t('ui.pages.cookies.title')} role="region">
        <div className={`container ${s.inner}`}>
          <p className={s.text}>{t('ui.pages.cookies.text')}</p>
          <div className={s.buttons}>
            <Button variant="secondary" size="M" onClick={() => decide({ analytics: false })}>
              {t('ui.pages.cookies.refuseAll')}
            </Button>
            <Button variant="secondary" size="M" onClick={() => setCustomize(true)} aria-haspopup="dialog">
              {t('ui.pages.cookies.customize')}
            </Button>
            <Button variant="secondary" size="M" onClick={() => decide({ analytics: true })}>
              {t('ui.pages.cookies.acceptAll')}
            </Button>
          </div>
        </div>
      </section>

      <dialog
        ref={dialog}
        className={s.dialog}
        aria-labelledby="cookies-title"
        onClose={() => setCustomize(false)}
        onCancel={() => setCustomize(false)}
      >
        <h2 id="cookies-title" className={s.dialogTitle}>
          {t('ui.pages.cookies.title')}
        </h2>
        <div className={s.row}>
          <div>
            <p className={s.rowTitle}>{t('ui.pages.cookies.necessary')}</p>
            <p className={s.rowText}>
              {t('ui.pages.cookies.necessaryText')}{' '}
              <Link href="/cookies" className={s.link}>
                {t('ui.pages.cookies.necessaryLink')}
              </Link>
            </p>
          </div>
        </div>
        <div className={s.row}>
          <label className={s.switchRow}>
            <span>
              <span className={s.rowTitle}>{t('ui.pages.cookies.analytics')}</span>
              <span className={s.rowText}>{t('ui.pages.cookies.analyticsText')}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className={s.switch}
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
            />
          </label>
        </div>
        <div className={s.dialogButtons}>
          <Button variant="tool" size="M" onClick={() => decide({ analytics })}>
            {t('ui.pages.cookies.save')}
          </Button>
          <Button variant="secondary" size="M" onClick={() => decide({ analytics: false })}>
            {t('ui.pages.cookies.refuseAll')}
          </Button>
          <Button variant="secondary" size="M" onClick={() => decide({ analytics: true })}>
            {t('ui.pages.cookies.acceptAll')}
          </Button>
        </div>
        <button type="button" className={s.close} onClick={() => setCustomize(false)}>
          <Icon name="close" label={t('ui.common.close')} />
        </button>
      </dialog>
    </>
  );
}
