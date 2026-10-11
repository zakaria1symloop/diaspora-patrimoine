'use client';
// EDI-040 — questions grouped by category; each opens in place (several may be open); `#q-{slug}` opens it; the
// search field filters while typing, without any server call. The placement pages use it without the search.
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './interactive.module.css';

export interface FaqGroup {
  category: string;
  label: string;
  items: { slug: string; question: string; html: string; text: string }[];
}

const normalise = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function FaqList({ groups, search = false, headingLevel = 2 }: { groups: FaqGroup[]; search?: boolean; headingLevel?: 2 | 3 }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  // D-100 — themes as chips with their counts; the chosen theme is kept in the address (?theme=…), like every list
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => {
    if (!search) return;
    const v = new URLSearchParams(window.location.search).get('theme');
    if (v && groups.some((g) => g.category === v)) setTheme(v);
  }, [search, groups]);
  const chooseTheme = (v: string | null) => {
    setTheme(v);
    const url = new URL(window.location.href);
    if (v) url.searchParams.set('theme', v);
    else url.searchParams.delete('theme');
    window.history.replaceState(window.history.state, '', url);
  };

  // A direct link opens its question (and keeps working when the hash changes on the same page).
  useEffect(() => {
    const fromHash = () => {
      const m = window.location.hash.match(/^#q-(.+)$/);
      if (!m) return;
      const slug = decodeURIComponent(m[1]!);
      setOpen((prev) => new Set(prev).add(slug));
      requestAnimationFrame(() => document.getElementById(`q-${slug}`)?.scrollIntoView({ block: 'start' }));
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  const shown = useMemo(() => {
    const q = normalise(query.trim());
    const base = theme ? groups.filter((g) => g.category === theme) : groups;
    if (!q) return base;
    return base
      .map((g) => ({ ...g, items: g.items.filter((i) => normalise(`${i.question} ${i.text}`).includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, query, theme]);
  const count = shown.reduce((n, g) => n + g.items.length, 0);
  const toggle = (slug: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const Q = headingLevel === 2 ? 'h3' : 'h4';

  return (
    <div className={s.faq}>
      {search ? (
        <div className={s.faqSearch} role="search">
          <label htmlFor="faq-recherche" className={s.faqSearchLabel}>
            {t('ui.editorial.faq.searchLabel')}
          </label>
          <div className={s.faqSearchField}>
            <Icon name="search" size={20} />
            <input id="faq-recherche" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            {query ? (
              <button type="button" onClick={() => setQuery('')} className={s.faqClear} aria-label={t('ui.editorial.faq.clear')}>
                <Icon name="close" size={20} />
              </button>
            ) : null}
          </div>
          {groups.length > 1 ? (
            <div className={s.faqThemes} role="group" aria-label={t('ui.editorial.faq.categories')}>
              {[{ category: null as string | null, label: t('ui.editorial.faq.all'), n: groups.reduce((k, g) => k + g.items.length, 0) }, ...groups.map((g) => ({ category: g.category as string | null, label: g.label, n: g.items.length }))].map((c) => (
                <button key={c.category ?? 'all'} type="button" className={s.faqTheme} aria-pressed={theme === c.category} onClick={() => chooseTheme(c.category)}>
                  {c.label}
                  <span className={s.faqThemeCount}>{c.n}</span>
                </button>
              ))}
            </div>
          ) : null}
          <p className={s.faqCount} aria-live="polite">
            {query.trim() ? t('ui.editorial.faq.count', { n: count }) : ''}
          </p>
        </div>
      ) : null}
      {count === 0 && query.trim() ? <p className={s.faqNoResult}>{t('ui.editorial.faq.noResult', { saisie: query.trim() })}</p> : null}
      {shown.map((g) => (
        <section key={g.category} className={s.faqGroup} aria-labelledby={`cat-${g.category}`}>
          {groups.length > 1 || search ? (
            <H id={`cat-${g.category}`} className={s.faqCategory}>
              {g.label}
            </H>
          ) : null}
          <ul role="list" className={s.faqItems}>
            {g.items.map((i) => {
              const isOpen = open.has(i.slug);
              return (
                <li key={i.slug} id={`q-${i.slug}`} className={s.faqItem} data-open={isOpen || undefined}>
                  <Q className={s.faqQuestion}>
                    <button type="button" aria-expanded={isOpen} aria-controls={`r-${i.slug}`} onClick={() => toggle(i.slug)}>
                      <span>{i.question}</span>
                      <span className={s.faqToggle} aria-hidden="true">
                        <Icon name="chevron-down" size={20} className={s.chevron} />
                      </span>
                    </button>
                  </Q>
                  <div id={`r-${i.slug}`} className={s.disclosureBody} inert={!isOpen}>
                    <div className={s.disclosureInner}>
                      <div className={s.faqAnswer} dangerouslySetInnerHTML={{ __html: i.html }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
