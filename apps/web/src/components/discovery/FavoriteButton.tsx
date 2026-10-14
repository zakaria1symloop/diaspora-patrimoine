'use client';
// SFA-020, SFA-021, D-103 — the heart, on every property card (top right of the photo, CAT-040 #4) and on the property
// page. With a client session one click adds or removes, without reloading, with « Ajouté à vos favoris » · « Retiré de
// vos favoris » and « Annuler » (EC-41, lib/account-favorites.ts). Without a session, adding opens the « Connectez-vous »
// window instead: the property joins the account right after sign-in. It never follows the card's link.
import { Icon } from '@dp/ui';
import { askSignInForFavorite, readFavorites, showToast, useFavorites } from '@/lib/discovery';
import { useHearts } from '@/lib/account-favorites';
import { t } from '@/lib/i18n';
import { useDiscoveryFlags } from './DiscoveryProvider';
import s from './discovery.module.css';

export function FavoriteButton({ reference, title, variant = 'card' }: { reference: string; title: string; variant?: 'card' | 'page' }) {
  const { favorites } = useDiscoveryFlags();
  const { restore } = useFavorites();
  const hearts = useHearts();
  if (!favorites) return null;
  const on = hearts.has(reference);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const account = hearts.mode === 'account';
    const before = account ? undefined : readFavorites().find((f) => f.ref === reference);
    const result = await hearts.toggle(reference);
    if (result === 'SIGN_IN') {
      askSignInForFavorite(reference);
      return;
    }
    if (result === 'ERROR') {
      showToast({ message: t('ui.clientTools.favorites.error'), tone: 'error' });
      return;
    }
    if (result === 'FULL') {
      showToast({ message: t('ui.favorites.toast.full', { n: hearts.max }), tone: 'info', link: { label: t('ui.favorites.toast.see'), href: hearts.href } });
      return;
    }
    if (result === 'REMOVED') {
      const undo = account ? () => void hearts.toggle(reference) : before ? () => restore(before) : undefined;
      showToast({ message: t('ui.favorites.toast.removed'), action: undo ? { label: t('ui.favorites.toast.undo'), onClick: undo } : undefined });
      return;
    }
    showToast({ message: t('ui.favorites.toast.added'), action: { label: t('ui.favorites.toast.undo'), onClick: () => void hearts.toggle(reference) }, link: { label: t('ui.favorites.toast.see'), href: hearts.href } });
  };

  const label = on ? t('ui.favorites.heart.remove', { titre: title }) : t('ui.favorites.heart.add', { titre: title });
  if (variant === 'page') {
    return (
      <button type="button" className={[s.pageTool, on && s.pageToolOn].filter(Boolean).join(' ')} aria-pressed={on} aria-label={label} onClick={(e) => void onClick(e)}>
        <Icon name="heart" size={20} />
        {t('ui.property.headerTools.favorite')}
      </button>
    );
  }
  return (
    <button type="button" className={[s.heart, on && s.heartOn].filter(Boolean).join(' ')} aria-pressed={on} aria-label={label} onClick={(e) => void onClick(e)}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />
      </svg>
    </button>
  );
}
