// ACC-040 … ACC-043 — two columns « À ALGER » / « EN FRANCE », the gap pill, the hypotheses line, the footnote.
// A side with duration and rate shows its CALCULATED monthly payment (CAL-040), rounded to the ten (CAL-022).
import Link from 'next/link';
import type { ComparisonBlock as Block, PublicImage } from '@dp/contracts';
import { monthlyPayment, roundIndicativeMonthly } from '@dp/domain';
import { formatMoney } from '@dp/i18n';
import { Icon } from '@dp/ui';
import { Picture } from '@/components/Picture';
import { t } from '@/lib/i18n';
import s from './home.module.css';

export type ComparisonValue = Block & { title1?: string; title2?: string; gapLabel?: string; leftPlace?: string; rightPlace?: string };

type Column = Block['left'];

function monthlyOf(c: Column): number {
  if (c.durationMonths && c.annualRateBps !== null && c.annualRateBps !== undefined) {
    const financed = Math.max(0, Number(c.price) - Number(c.downPayment));
    return roundIndicativeMonthly(monthlyPayment(financed, c.durationMonths, c.annualRateBps, 'AMORTIZED_RATE')).toNumber();
  }
  return Number(c.monthly);
}

function rate(bps: number): string {
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bps / 100)} %`;
}

function duration(months: number): string {
  return months % 12 === 0 ? t('ui.home.comparison.years', { n: months / 12 }) : t('ui.home.comparison.months', { n: months });
}

export function Comparison({
  value,
  footnote,
  propertySlug,
  cover,
}: {
  value: ComparisonValue;
  footnote: string;
  propertySlug: string | null;
  /** The linked property's cover, shown on both sides (two equivalent properties); none: the sky gradient. */
  cover: PublicImage | null;
}) {
  const cur = value.currency;
  const euros = (n: number) => formatMoney(n, cur, 'fr-FR', 0);
  const left = monthlyOf(value.left);
  const right = monthlyOf(value.right);
  const gap = Math.round((right - left) / 10) * 10;
  const hasHypotheses =
    value.left.durationMonths && value.left.annualRateBps !== null && value.right.durationMonths && value.right.annualRateBps !== null;

  const column = (c: Column, monthly: number, side: 'left' | 'right') => (
    <div className={`${s.cmpCol} ${side === 'left' ? s.cmpLeft : s.cmpRight}`}>
      <div className={s.cmpBand}>
        <span className={side === 'left' ? s.flagDz : s.flagFr} aria-hidden="true" />
        {c.label}
      </div>
      <div className={s.cmpPhoto} aria-hidden="true">
        {cover ? <Picture image={cover} sizes="20rem" alt="" className={s.cmpPhotoImg} /> : null}
      </div>
      <div className={s.cmpPanel}>
        <h3 className={s.cmpTitle}>
          {side === 'left' && propertySlug ? <Link href={`/biens/${propertySlug}`}>{c.title}</Link> : c.title}
        </h3>
        <dl className={s.cmpValues}>
          <div>
            <Icon name="diamond" size={24} />
            <span>
              <dt>{t('ui.home.comparison.price')}</dt>
              <dd>{euros(Number(c.price))}</dd>
            </span>
          </div>
          <div>
            <Icon name="coins" size={24} />
            <span>
              <dt>{t('ui.home.comparison.downPayment')}</dt>
              <dd>{euros(Number(c.downPayment))}</dd>
            </span>
          </div>
        </dl>
      </div>
      <div className={s.cmpMonthly}>
        <span>{t('ui.home.comparison.monthly')}</span>
        <strong>
          {euros(monthly)} <span className={s.cmpUnit}>{t('ui.home.comparison.perMonth')}</span>
        </strong>
      </div>
    </div>
  );

  return (
    <section className={s.comparison} aria-labelledby="comparatif-titre">
      <h2 id="comparatif-titre" className={s.cmpHeading}>
        <span className={s.cmpHeading1}>{value.title1}</span> <span className={s.cmpHeading2}>{value.title2}</span>
      </h2>
      <div className={s.cmpGrid}>
        {column(value.left, left, 'left')}
        {gap > 0 ? (
          <div className={s.cmpGap}>
            <strong>{`− ${euros(gap)}`}</strong>
            <span>{value.gapLabel}</span>
          </div>
        ) : null}
        {column(value.right, right, 'right')}
      </div>
      {hasHypotheses ? (
        <p className={s.cmpNote}>
          {t('ui.home.comparison.hypotheses', {
            left: value.leftPlace ?? value.left.label,
            leftDuration: duration(value.left.durationMonths!),
            leftRate: rate(value.left.annualRateBps!),
            right: value.rightPlace ?? value.right.label,
            rightDuration: duration(value.right.durationMonths!),
            rightRate: rate(value.right.annualRateBps!),
          })}
        </p>
      ) : null}
      <p className={s.cmpNote}>{footnote}</p>
    </section>
  );
}
