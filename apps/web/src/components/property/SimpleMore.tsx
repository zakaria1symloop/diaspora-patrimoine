'use client';
// TRV-122 — in « Affichage simplifié » the property page keeps the gallery, the price, the key facts, the description
// and the buttons; the rest waits behind « Voir tous les détails » (shown only in that mode, by CSS).
import { useState } from 'react';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './property.module.css';

export function SimpleMore() {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className={s.simpleMore}
      aria-expanded={open}
      onClick={(e) => {
        setOpen(true);
        e.currentTarget.closest('article')?.setAttribute('data-all', '');
      }}
      hidden={open}
    >
      {t('ui.common.simpleMode.more')}
      <Icon name="chevron-down" size={20} />
    </button>
  );
}
