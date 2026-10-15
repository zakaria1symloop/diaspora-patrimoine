// FIC-120 — a property or a programme opened by the back office's signed link (« Aperçu »): a fixed band says it is not
// online, and every button and field of the page is inactive (no request is accepted; the links still lead). Outside a
// preview it renders its children as they are.
import type { ReactNode } from 'react';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './property.module.css';

export function PreviewFrame({ preview, children }: { preview: boolean; children: ReactNode }) {
  if (!preview) return <>{children}</>;
  return (
    <>
      <p className={s.previewBand} role="status">
        <Icon name="eye" size={20} />
        {t('ui.property.preview.band')}
      </p>
      <fieldset disabled className={s.previewFrame} data-preview="">
        {children}
      </fieldset>
    </>
  );
}
