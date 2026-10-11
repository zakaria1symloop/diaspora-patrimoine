'use client';
// EP-06, FIC-014 … FIC-019 — full-screen gallery opened by ?galerie=photos&i=3. Tabs only when they have content;
// arrows, keyboard, swipe, and a click on the right or left half of the image (an older visitor clicks « the next »);
// zoom only by the « + » button, never by a simple click; Escape closes; the tab and image live in the address.
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicMediaSet } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { Picture } from '@/components/Picture';
import { t } from '@/lib/i18n';
import s from './lightbox.module.css';

type Tab = 'photos' | 'plans' | '360' | 'video';

export interface LightboxProps {
  media: PublicMediaSet;
  title: string;
  subtitle: string;
  primary: { label: string; href: string } | null;
  visioHref: string | null;
  render3dNote: string;
  illustrationNote: string;
}

export function Lightbox({ media, title, subtitle, primary, visioHref, render3dNote, illustrationNote }: LightboxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get('galerie') as Tab | null;
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);
  const touchX = useRef<number | null>(null);

  const available: Tab[] = [
    ...(media.images.length ? (['photos'] as Tab[]) : []),
    ...(media.plans.length ? (['plans'] as Tab[]) : []),
    ...(media.panos.length ? (['360'] as Tab[]) : []),
    ...(media.videos.length ? (['video'] as Tab[]) : []),
  ];
  // FIC-019: a direct link to an empty tab opens Photos; the absent 360 shows its empty state.
  const tab: Tab | null = raw === null ? null : available.includes(raw) ? raw : raw === '360' ? '360' : available[0] ?? null;
  const list = tab === 'plans' ? media.plans : tab === '360' ? media.panos : media.images;
  const count = list.length;
  const index = Math.min(Math.max(Number(params.get('i') ?? 0) || 0, 0), Math.max(count - 1, 0));

  const go = useCallback(
    (next: { tab?: Tab; i?: number } | null) => {
      const qs = new URLSearchParams(params.toString());
      if (next === null) {
        qs.delete('galerie');
        qs.delete('i');
      } else {
        qs.set('galerie', next.tab ?? tab ?? 'photos');
        qs.set('i', String(next.i ?? 0));
      }
      const str = qs.toString();
      router.replace(`${pathname}${str ? `?${str}` : ''}`, { scroll: false });
      setZoom(1);
    },
    [params, pathname, router, tab],
  );

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (tab && !d.open) d.showModal();
    if (!tab && d.open) d.close();
  }, [tab]);

  useEffect(() => {
    if (!tab) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && count > 1) go({ i: (index + 1) % count });
      if (e.key === 'ArrowLeft' && count > 1) go({ i: (index - 1 + count) % count });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tab, index, count, go]);

  if (available.length === 0 && raw !== '360') return null;
  const current = list[index];
  const note = current && 'isRender3d' in current ? (current.isRender3d ? render3dNote : current.isIllustration ? illustrationNote : null) : null;
  const caption = current ? [('roomLabel' in current ? current.roomLabel : null), current.caption].filter(Boolean).join(' · ') : '';

  return (
    <dialog
      ref={dialog}
      className={s.dialog}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        go(null);
      }}
    >
      <header className={s.header}>
        <div className={s.titles}>
          <p className={s.title}>{title}</p>
          <p className={s.subtitle}>{subtitle}</p>
        </div>
        <div className={s.headerActions}>
          {visioHref ? (
            <Link href={visioHref} className={s.secondary} scroll={false}>
              {t('ui.property.gallery.visio')}
            </Link>
          ) : null}
          {primary ? (
            <Link href={primary.href} className={s.primary} scroll={false}>
              {primary.label}
            </Link>
          ) : null}
          <button type="button" className={s.close} onClick={() => go(null)}>
            <Icon name="close" label={t('ui.property.gallery.close')} />
          </button>
        </div>
      </header>

      {available.length > 1 ? (
        <nav className={s.tabs} role="tablist">
          {available.map((tb) => (
            <button key={tb} type="button" role="tab" aria-selected={tab === tb} className={s.tab} onClick={() => go({ tab: tb, i: 0 })}>
              {tb === 'photos'
                ? t('ui.property.gallery.tabs.photos', { n: media.images.length })
                : tb === 'plans'
                  ? t('ui.property.gallery.tabs.plans', { n: media.plans.length })
                  : tb === '360'
                    ? t('ui.property.gallery.tabs.tour', { n: media.panos.length })
                    : t('ui.property.gallery.tabs.video', { n: media.videos.length })}
            </button>
          ))}
        </nav>
      ) : null}

      <div className={s.stage}>
        {tab === '360' && media.panos.length === 0 ? (
          <div className={s.empty}>
            <p className={s.emptyTitle}>{t('ui.property.gallery.tourEmptyTitle')}</p>
            <p>{t('ui.property.gallery.tourEmptyText')}</p>
            {visioHref ? (
              <Link href={visioHref} className={s.primary} scroll={false}>
                {t('ui.property.gallery.visio')}
              </Link>
            ) : null}
          </div>
        ) : tab === 'video' ? (
          <div className={s.videos}>
            {media.videos.map((v) => (
              <a key={v.id} href={v.url} target="_blank" rel="noopener" className={s.video}>
                <Icon name="play" size={32} />
                {v.caption ?? t('ui.property.gallery.videoPlay')}
              </a>
            ))}
          </div>
        ) : current ? (
          <>
            <div
              className={s.frame}
              onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
              onTouchEnd={(e) => {
                const start = touchX.current;
                const end = e.changedTouches[0]?.clientX;
                if (start !== null && end !== undefined && Math.abs(end - start) > 40 && count > 1) {
                  go({ i: end < start ? (index + 1) % count : (index - 1 + count) % count });
                }
                touchX.current = null;
              }}
            >
              <div className={s.zoomBox} style={{ transform: `scale(${zoom})` }}>
                <Picture image={current} sizes="100vw" className={s.image} />
              </div>
              {count > 1 && zoom === 1 ? (
                <>
                  <button type="button" className={s.halfLeft} onClick={() => go({ i: (index - 1 + count) % count })} aria-label={t('ui.property.gallery.previous')} />
                  <button type="button" className={s.halfRight} onClick={() => go({ i: (index + 1) % count })} aria-label={t('ui.property.gallery.next')} />
                </>
              ) : null}
              {note ? <span className={s.note}>{note}</span> : null}
            </div>
            <div className={s.bar}>
              <span className={s.position}>{t('ui.property.gallery.position', { i: index + 1, n: count })}</span>
              {caption ? <span className={s.caption}>{caption}</span> : null}
              <span className={s.zoom}>
                <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1}>
                  <Icon name="minus" label={t('ui.property.gallery.zoomOut')} size={20} />
                </button>
                <button type="button" onClick={() => setZoom((z) => Math.min(tab === 'plans' ? 4 : 3, z + 0.5))}>
                  <Icon name="plus" label={t('ui.property.gallery.zoomIn')} size={20} />
                </button>
              </span>
            </div>
            {tab === 'plans' ? <p className={s.notice}>{t('ui.property.gallery.plansNotice')}</p> : null}
            {count > 1 ? (
              <ol className={s.thumbs}>
                {list.map((m, i) => (
                  <li key={m.id}>
                    <button type="button" className={s.thumb} aria-current={i === index || undefined} onClick={() => go({ i })}>
                      <Picture image={m} sizes="96px" className={s.thumbImg} alt="" />
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
            {media.brochure && tab === 'photos' ? (
              <a href={media.brochure.url} className={s.brochure} download>
                <Icon name="download" size={20} />
                {t('ui.property.gallery.brochure', {
                  taille: media.brochure.sizeBytes ? `${(media.brochure.sizeBytes / 1_048_576).toFixed(1).replace('.', ',')} Mo` : '',
                })}
              </a>
            ) : null}
          </>
        ) : null}
      </div>
    </dialog>
  );
}
