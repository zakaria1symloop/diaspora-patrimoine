'use client';
// CTL-043 — the completeness card, always visible on the right of a property (CAL-050, CAL-051): the score and its
// state (« Brouillon · {n} obligatoires manquants » · « Publiable · à améliorer » · « Fiche complète »); the actions that
// bring the most, three at most, missing mandatory fields first, each leading to the right place; « Publier », active as
// soon as the conditions of CYC-120 are met.
import Link from 'next/link';
import type { AdminPropertyDetail } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import { Surface } from '../shell/Page';
import { MissingList } from '../catalogue/parts';
import { propertyPath } from './PropertiesList';
import s from './properties.module.css';

/** Where each action of CAL-051 is done on the record. */
function target(p: AdminPropertyDetail, code: string): string {
  const base = propertyPath(p.id);
  if (code === 'ADD_PHOTOS' || code === 'ADD_PLAN' || code === 'ADD_TOUR_360') return `${base}?onglet=medias`;
  if (code === 'ADD_POIS') return `${base}?onglet=a-proximite`;
  if (code === 'FIELD_PRICE') return p.program ? `${base}?onglet=lots` : `${base}#prix`;
  if (code === 'ADD_FEATURES') return `${base}#caracteristiques`;
  if (code === 'ADD_COORDINATES') return p.program ? `/catalogue/programmes/${p.program.id}#localisation` : `${base}#localisation`;
  if (code === 'FIELD_DELIVERY') return `${base}#livraison`;
  if (code === 'FIELD_SURFACE') return `${base}#surfaces`;
  return `${base}#identite`;
}

export function CompletenessCard({ property, onPublish }: { property: AdminPropertyDetail; onPublish?: () => void }) {
  const c = property.completeness;
  const r = 34;
  const len = 2 * Math.PI * r;
  const tone = c.state === 'COMPLETE' ? 'good' : c.state === 'PUBLISHABLE' ? 'mid' : 'low';
  const published = property.publication === 'PUBLISHED';
  const canPublish = property.publicationMissing.length === 0;
  return (
    <Surface title={t('ui.admin-properties.completeness.title')}>
      <div className={s.card}>
        <div className={s.score} data-tone={tone}>
          <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
            <circle cx="42" cy="42" r={r} className={s.ringTrack} />
            <circle cx="42" cy="42" r={r} className={s.ringValue} strokeDasharray={`${(len * c.score) / 100} ${len}`} transform="rotate(-90 42 42)" />
            <circle cx="42" cy="42" r={r} className={s.ringMark} strokeDasharray={`2 ${len}`} strokeDashoffset={-((len * c.publishMinScore) / 100) + 1} transform="rotate(-90 42 42)" />
          </svg>
          <span className={s.scoreFigure}>
            <strong>{c.score}</strong>
            <span>/100</span>
          </span>
          <span className={s.scoreText}>
            <strong>{t(`ui.admin-properties.completeness.${c.state}`, { n: c.missingMandatory.length })}</strong>
            <span className={s.muted}>{t('ui.admin-properties.completeness.thresholds', { min: c.publishMinScore, complete: c.completeScore })}</span>
          </span>
        </div>
        {c.actions.length ? (
          <div className={s.actions}>
            <span className={s.actionsTitle}>{t('ui.admin-properties.completeness.next')}</span>
            <ul>
              {c.actions.map((a) => (
                <li key={a.code}>
                  <Link href={target(property, a.code)} className={s.action} data-mandatory={a.mandatory ? '1' : undefined}>
                    <Icon name={a.mandatory ? 'status-warning' : 'plus'} size={16} />
                    <span>{t(`ui.admin-properties.completeness.action.${a.code as 'ADD_PLAN'}`, { gain: a.gain, n: a.count ?? 1 })}</span>
                    {a.mandatory ? <span className={s.mandatory}>{t('ui.admin-properties.completeness.mandatory')}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!published ? (
          <>
            {!canPublish ? <MissingList codes={property.publicationMissing} minScore={c.publishMinScore} /> : null}
            {property.can.publish && property.publication !== 'ARCHIVED' ? (
              <Button variant="tool" size="M" icon="send" fullWidth disabled={!canPublish} onClick={onPublish}>
                {t('ui.admin-properties.completeness.publish')}
              </Button>
            ) : null}
          </>
        ) : (
          <span className={s.online}>
            <Icon name="status-success" size={16} />
            {t('ui.admin-properties.completeness.published')}
          </span>
        )}
      </div>
    </Surface>
  );
}
