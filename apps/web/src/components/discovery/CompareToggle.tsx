'use client';
// CAT-092 — the « Comparer » box on every card and on the property page; three properties at most (`dp_compare`).
// A fourth: « Vous comparez déjà trois biens : retirez-en un pour ajouter celui-ci. ». Never follows the card's link.
import { Icon } from '@dp/ui';
import { showToast, useCompare } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import s from './discovery.module.css';

export function CompareToggle({ reference, title, variant = 'card' }: { reference: string; title: string; variant?: 'card' | 'page' }) {
  const { has, add, remove } = useCompare();
  const on = has(reference);
  const onChange = () => {
    if (on) {
      remove(reference);
      return;
    }
    if (add(reference) === 'FULL') showToast({ message: t('ui.compare.tray.full'), tone: 'info' });
  };
  return (
    <label
      className={[variant === 'page' ? s.pageTool : s.compare, on && (variant === 'page' ? s.pageToolOn : s.compareOn)].filter(Boolean).join(' ')}
      onClick={(e) => e.stopPropagation()}
    >
      <input type="checkbox" className={s.compareInput} checked={on} onChange={onChange} aria-label={t('ui.compare.toggle.aria', { titre: title })} />
      <span className={s.compareBox} aria-hidden="true">
        {on ? <Icon name="check" size={16} /> : null}
      </span>
      {t('ui.compare.toggle.label')}
    </label>
  );
}
