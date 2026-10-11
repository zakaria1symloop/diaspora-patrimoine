// ACC-090 — « Simulez votre projet » fallback of the projection form: two buttons to the simulators.
import Link from 'next/link';
import { buttonClass, ButtonInner } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './home.module.css';

export function SimulateBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className={s.simBlock}>
      <div>
        <h3 className={s.simTitle}>{title}</h3>
        <p className={s.simText}>{text}</p>
      </div>
      <div className={s.simButtons}>
        <Link href="/financements/simulateur-eligibilite" className={buttonClass('primary', 'L')}>
          <ButtonInner chevron size="L">
            {t('ui.home.financing.fallbackEligibility')}
          </ButtonInner>
        </Link>
        <Link href="/financements/simulateur-credit" className={buttonClass('secondary', 'L')}>
          <ButtonInner chevron size="L">
            {t('ui.home.financing.fallbackCredit')}
          </ButtonInner>
        </Link>
      </div>
    </div>
  );
}
