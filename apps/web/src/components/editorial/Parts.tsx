// Building blocks shared by the editorial pages: page head with its drawing, section titles, rich text, the EDI-004
// call card, logo tiles, empty states. Every sentence comes from a content block or a message key (TRV-002).
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PublicImage } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner, type IconName } from '@dp/ui';
import { t } from '@/lib/i18n';
import { Picture } from '@/components/Picture';
import { Drawing, type DrawingName } from './Drawing';
import s from './editorial.module.css';

export interface Crumb {
  href?: string;
  label: string;
}

export function PageHead({
  title,
  heading,
  intro,
  drawing,
  crumbs = [],
  aside,
  children,
}: {
  title: string;
  /** Two-line heading (line 2 in gold) when the h1 differs from the breadcrumb label (Financements). */
  heading?: { line1: string | null; line2: string | null };
  intro?: string | null;
  drawing?: DrawingName;
  crumbs?: Crumb[];
  /** Replaces the drawing (the express calculation on Financements). */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className={s.head}>
      <div className={`container ${s.headGrid} ${aside ? s.headGridAside : ''}`}>
        <div className={s.headText}>
          <nav aria-label={t('ui.nav.breadcrumb')} className={s.breadcrumb}>
            <Link href="/">{t('ui.editorial.common.home')}</Link>
            {crumbs.map((c) => (
              <span key={c.label} className={s.crumb}>
                <Icon name="chevron-right" size={16} />
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
            <Icon name="chevron-right" size={16} />
            <span aria-current="page">{title}</span>
          </nav>
          <h1 className={s.title}>
            {heading ? (
              <>
                {heading.line1 ? <span className={s.titleText}>{heading.line1}</span> : null}{' '}
                {heading.line2 ? <span className={s.titleGold}>{heading.line2}</span> : null}
              </>
            ) : (
              <span className={s.titleText}>{title}</span>
            )}
            <svg className={s.titleStroke} viewBox="0 0 320 18" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path d="M4 14C70 6 190 2 316 6" stroke="var(--bo-fond-champagne)" strokeWidth="5" strokeLinecap="round" fill="none" />
              <path d="M4 14C60 8 130 5 200 4" stroke="var(--bo-accent-or)" strokeWidth="4" strokeLinecap="round" fill="none" />
            </svg>
          </h1>
          {intro ? <p className={s.intro}>{intro}</p> : null}
          {children}
        </div>
        {aside ? <div className={s.headAside}>{aside}</div> : drawing ? <Drawing name={drawing} className={s.headDrawing} /> : null}
      </div>
    </header>
  );
}

export function SectionHeading({ id, title, icon, align = 'start' }: { id: string; title: string; icon?: IconName; align?: 'start' | 'center' }) {
  return (
    <h2 id={id} className={`${s.h2} ${align === 'center' ? s.h2Center : ''}`}>
      {icon ? (
        <span className={s.h2Icon}>
          <Icon name={icon} size={20} />
        </span>
      ) : null}
      {title}
    </h2>
  );
}

/** EDI-003 — HTML already sanitised on the server by `sanitizeRich` / `richOrText`. */
export function RichText({ html, className }: { html: string; className?: string }) {
  return <div className={[s.rich, className].filter(Boolean).join(' ')} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** EDI-004 — « Parlons de votre projet » · « Être rappelé » (fallback ACC-090 decided by the caller). */
export function CallCard({ href, secondary }: { href: string; secondary?: { href: string; label: string } }) {
  return (
    <section className={s.call} aria-labelledby="appel">
      <div className={`container`}>
        <div className={`${s.callCard} icons-dark`}>
          <span className={s.callIcon}>
            <Icon name="phone" size={32} />
          </span>
          <div className={s.callText}>
            <h2 id="appel" className={s.callTitle}>
              {t('ui.editorial.common.callTitle')}
            </h2>
            <p>{t('ui.editorial.common.callText')}</p>
          </div>
          <div className={s.callButtons}>
            {secondary ? (
              <Link href={secondary.href} className={buttonClass('secondary', 'L')}>
                <ButtonInner chevron size="L">
                  {secondary.label}
                </ButtonInner>
              </Link>
            ) : null}
            <Link href={href} className={buttonClass('primary', 'L')} scroll={false}>
              <ButtonInner chevron size="L">
                {t('ui.editorial.common.callButton')}
              </ButtonInner>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A logo, or the initial of the name in a medallion when there is none. */
export function Logo({ image, name, size = 'm' }: { image: PublicImage | null; name: string; size?: 's' | 'm' | 'l' }) {
  return (
    <span className={`${s.logo} ${s[`logo_${size}`]}`}>
      {image ? (
        <Picture image={image} sizes="160px" alt="" className={s.logoImg} />
      ) : (
        <span className={s.logoInitial} aria-hidden="true">
          {name.charAt(0)}
        </span>
      )}
    </span>
  );
}

/** A list without data: the sentence of the spec beside a drawn scene, never an empty zone. */
export function EmptyState({ text, drawing, children }: { text: string; drawing: DrawingName; children?: ReactNode }) {
  return (
    <div className={s.empty}>
      <Drawing name={drawing} className={s.emptyDrawing} />
      <div className={s.emptyText}>
        <p>{text}</p>
        {children}
      </div>
    </div>
  );
}
