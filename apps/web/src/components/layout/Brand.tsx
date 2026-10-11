// DSN-050 `Brand` — logo, wordmark (vector, from the Figma export) and tagline (block `brand.tagline`).
import Image from 'next/image';
import Link from 'next/link';
import logo from '@dp/ui/assets/logo.png';
import wordmark from '@dp/ui/assets/wordmark.svg';
import wordmarkDark from '@dp/ui/assets/wordmark-dark.svg';
import s from './Brand.module.css';

export interface BrandProps {
  tagline: string | null;
  homeLabel: string;
  tone?: 'light' | 'dark';
  compact?: boolean;
  asLink?: boolean;
  priority?: boolean;
}

export function Brand({ tagline, homeLabel, tone = 'light', compact, asLink = true, priority }: BrandProps) {
  const content = (
    <>
      <Image src={logo} alt="" className={s.logo} sizes="86px" priority={priority} />
      <span className={s.text}>
        <Image src={tone === 'dark' ? wordmarkDark : wordmark} alt="" className={s.wordmark} priority={priority} unoptimized />
        {tagline ? <span className={s.tagline}>{tagline}</span> : null}
      </span>
    </>
  );
  const cls = [s.brand, tone === 'dark' && s.dark, compact && s.compact].filter(Boolean).join(' ');
  return asLink ? (
    <Link href="/" className={cls} aria-label={homeLabel}>
      {content}
    </Link>
  ) : (
    <span className={cls}>{content}</span>
  );
}
