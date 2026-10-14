'use client';
// Page-wide pieces of the discovery tools: the « Connectez-vous » window of the hearts (D-103), the short messages (TRV-081: 8 s on the site, paused under the pointer or
// the focus, with « Annuler » when reversible) and the comparison tray (CAT-092: sticky at the bottom, thumbnails,
// « Comparer ({n}) » active from two properties, « Tout retirer »). D-095: one fixed element at the bottom at a time —
// the cookie banner first; on phones the tray shrinks to a « Comparer ({n}) » pill above the page's action bar.
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { COMPARE_MAX, type FavoritesResponse, type PropertyCard } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { PENDING_FAVORITE_KEY, useCompare, type ToastInput } from '@/lib/discovery';
import { QueryDialog } from '@/components/forms/QueryDialog';
import { t } from '@/lib/i18n';
import s from './discovery.module.css';

const TOAST_MS = 8000;

function Toasts() {
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const hold = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onToast = (e: Event) => setToast({ ...(e as CustomEvent<ToastInput>).detail, id: Date.now() });
    window.addEventListener('dp:toast', onToast);
    return () => window.removeEventListener('dp:toast', onToast);
  }, []);

  useEffect(() => {
    if (!toast || toast.tone === 'error') return; // an error stays until closed (TRV-114)
    const arm = () => {
      timer.current = setTimeout(() => (hold.current ? arm() : setToast(null)), TOAST_MS);
    };
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  return (
    <div className={s.toastZone} role="status" aria-live="polite">
      {toast ? (
        <div
          key={toast.id}
          className={[s.toast, toast.tone === 'error' && s.toastError].filter(Boolean).join(' ')}
          onMouseEnter={() => (hold.current = true)}
          onMouseLeave={() => (hold.current = false)}
          onFocus={() => (hold.current = true)}
          onBlur={() => (hold.current = false)}
        >
          <Icon name={toast.tone === 'error' ? 'status-error' : toast.tone === 'info' ? 'status-info' : 'status-success'} size={20} className={s.toastIcon} />
          <span className={s.toastText}>{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              className={s.toastAction}
              onClick={() => {
                toast.action!.onClick();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
          {toast.link ? (
            <Link href={toast.link.href} className={s.toastAction} onClick={() => setToast(null)}>
              {toast.link.label}
            </Link>
          ) : null}
          <button type="button" className={s.toastClose} onClick={() => setToast(null)} aria-label={t('ui.common.close')}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * D-103 — a heart touched without a session: the visitor is asked to sign in (or to create the space), and comes back to
 * the page he was on; the property joins his favourites right after (lib/after-sign-in.ts). « Plus tard » forgets it.
 */
function FavoriteSignIn() {
  const pathname = usePathname() ?? '/';
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onAsk = () => setOpen(true);
    window.addEventListener('dp:favorite-sign-in', onAsk);
    return () => window.removeEventListener('dp:favorite-sign-in', onAsk);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  const dismiss = () => {
    try {
      localStorage.removeItem(PENDING_FAVORITE_KEY);
    } catch {
      /* storage unavailable */
    }
    setOpen(false);
  };
  const qs = params.toString();
  const back = encodeURIComponent(`${pathname}${qs ? `?${qs}` : ''}`);
  return (
    <QueryDialog open={open} onClose={dismiss} title={t('ui.favorites.signIn.title')} closeLabel={t('ui.common.close')} width={480}>
      <div className={s.signIn}>
        <span className={s.signInHeart} aria-hidden="true">
          <Icon name="heart" size={32} />
        </span>
        <p className={s.signInText}>{t('ui.favorites.signIn.text')}</p>
        <div className={s.signInButtons}>
          <Link href={`/connexion?suite=${back}`} className={buttonClass('primary', 'L', true)}>
            <ButtonInner size="L">{t('ui.favorites.signIn.login')}</ButtonInner>
          </Link>
          <Link href={`/inscription?suite=${back}`} className={buttonClass('secondary', 'L', true)}>
            <ButtonInner size="L">{t('ui.favorites.signIn.signup')}</ButtonInner>
          </Link>
          <button type="button" className={buttonClass('tertiary', 'M', true)} onClick={dismiss}>
            <ButtonInner size="M">{t('ui.favorites.signIn.later')}</ButtonInner>
          </button>
        </div>
      </div>
    </QueryDialog>
  );
}

/** Cards of the compared references, read once per reference (thumbnails of the tray). */
const cardCache = new Map<string, PropertyCard | null>();

function useCards(refs: string[]): Map<string, PropertyCard | null> {
  const [, force] = useState(0);
  const key = refs.join(',');
  useEffect(() => {
    const missing = refs.filter((r) => !cardCache.has(r));
    if (!missing.length) return;
    let alive = true;
    fetch(`/api/v1/public/properties/cards?refs=${encodeURIComponent(missing.join(','))}`, { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<FavoritesResponse>) : null))
      .then((body) => {
        for (const e of body?.data ?? []) cardCache.set(e.reference, e.state === 'ONLINE' ? e.card : null);
        if (alive) force((n) => n + 1);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return cardCache;
}

function CompareTray() {
  const pathname = usePathname() ?? '/';
  const { refs, remove, clear } = useCompare();
  const cards = useCards(refs);
  if (!refs.length || pathname.startsWith('/comparer')) return null;
  const href = `/comparer?biens=${refs.join(',')}`;
  const ready = refs.length >= 2;
  return (
    <>
      <aside className={s.tray} aria-label={t('ui.compare.tray.label')} data-compare-tray>
        <ul className={s.traySlots} role="list">
          {Array.from({ length: COMPARE_MAX }, (_, i) => refs[i]).map((ref, i) => {
            if (!ref) {
              return (
                <li key={`free-${i}`} className={s.trayFree}>
                  <Icon name="plus" size={16} />
                  {t('ui.compare.tray.free')}
                </li>
              );
            }
            const card = cards.get(ref);
            const img = card?.cover ? `${card.cover.base}/thumb.${card.cover.formats.includes('webp') ? 'webp' : 'jpg'}` : null;
            const title = card?.title ?? ref;
            return (
              <li key={ref} className={s.trayItem}>
                {img ? <img src={img} alt="" className={s.trayThumb} width={56} height={42} /> : <span className={s.trayThumb} aria-hidden="true" />}
                <span className={s.trayTitle}>{title}</span>
                <button type="button" className={s.trayRemove} onClick={() => remove(ref)} aria-label={t('ui.compare.tray.remove', { titre: title })}>
                  <Icon name="close" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
        <div className={s.trayActions}>
          {ready ? (
            <Link href={href} className={buttonClass('primary', 'M')}>
              <ButtonInner chevron size="M">
                {t('ui.compare.tray.compare', { n: refs.length })}
              </ButtonInner>
            </Link>
          ) : (
            <span className={s.trayHint}>{t('ui.compare.tray.hint')}</span>
          )}
          <button type="button" className={s.trayClear} onClick={clear}>
            {t('ui.compare.tray.clear')}
          </button>
        </div>
      </aside>
      {/* Phones (D-095): a pill instead of the tray. */}
      <Link href={href} className={s.trayPill} aria-label={t('ui.compare.tray.compare', { n: refs.length })}>
        <Icon name="scale" size={20} />
        {t('ui.compare.tray.compare', { n: refs.length })}
      </Link>
    </>
  );
}

export function DiscoveryHost() {
  return (
    <>
      <CompareTray />
      <Toasts />
      <Suspense fallback={null}>
        <FavoriteSignIn />
      </Suspense>
    </>
  );
}
