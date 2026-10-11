'use client';
// ECL-033 — several dossiers (rare, CYC-002): one card per dossier, the most recent active one first. Each card is ONE
// link (D-098): the property with its photo, the state, the displayed step with its six marks, the completeness when
// the dossier is at the pieces, the last activity. Filter by state kept in the address (`etat=`, TRV-101); the list
// is short (a client has a handful of dossiers), filtered here with the counters of the complete list.
import Link from 'next/link';
import type { DossierListItem } from '@dp/contracts';
import { Icon } from '@dp/ui';
import type { MessageKey } from '@dp/i18n';
import { Picture } from '@/components/Picture';
import { t } from '@/lib/i18n';
import { dossierPath } from '../menu';
import { longDate } from '../texts';
import { FilterChips, NoMatch, Toolbar, useListState } from '../kit/ListControls';
import { Progress, StepDots } from '../kit/Progress';
import k from '../kit/kit.module.css';
import sp from '../space.module.css';
import s from './dossier.module.css';

const TONE: Record<DossierListItem['status'], string> = { OPEN: sp.tagInfo!, ON_HOLD: sp.tagWarning!, WON: sp.tagSuccess!, LOST: sp.tagNeutral! };
const LIVE = ['OPEN', 'ON_HOLD'];

export function DossierList({ items, timeZone, shownReference }: { items: DossierListItem[]; timeZone: string; shownReference: string | null }) {
  const list = useListState();
  const state = list.get('etat');
  const live = items.filter((d) => LIVE.includes(d.status));
  const done = items.filter((d) => !LIVE.includes(d.status));
  const shown = state === 'en-cours' ? live : state === 'termines' ? done : items;
  return (
    <>
      {live.length && done.length ? (
        <Toolbar>
          <FilterChips
            label={t('ui.client.dossier.list.filter')}
            value={state}
            onChange={(v) => list.set({ etat: v }, { push: true })}
            options={[
              { value: '', label: t('ui.client.dossier.list.all'), count: items.length },
              { value: 'en-cours', label: t('ui.client.dossier.list.live'), count: live.length },
              { value: 'termines', label: t('ui.client.dossier.list.done'), count: done.length },
            ]}
          />
        </Toolbar>
      ) : null}
      {shown.length === 0 ? (
        <NoMatch onClear={() => list.clear(['etat'])} />
      ) : (
        <ul role="list" className={s.cards}>
          {shown.map((d, i) => {
            const p = d.property;
            const place = p ? [p.city, p.region].filter(Boolean).join(', ') : null;
            const stepLabel = t(`ui.client.steps.${d.step}.label` as MessageKey);
            return (
              <li key={d.reference} className={k.enter} style={{ ['--i' as string]: i }}>
                <Link href={dossierPath(d.reference)} className={`${s.card} ${k.linkCard}`} aria-label={t('ui.client.dossier.list.open', { reference: d.reference })}>
                  <span className={s.cardPhoto}>{p?.photo ? <Picture image={p.photo} sizes="(max-width: 639px) 30vw, 180px" alt="" /> : <Icon name="building" size={32} />}</span>
                  <span className={s.cardBody}>
                    <span className={s.cardTop}>
                      <span className={s.cardRef}>{t('ui.client.dossier.title', { reference: d.reference })}</span>
                      <span className={`${sp.tag} ${TONE[d.status]}`}>{t(`ui.enum.DossierStatus.${d.status}` as MessageKey)}</span>
                    </span>
                    <span className={s.cardTitle}>{d.propertyTitle ?? t('ui.client.dossier.list.noProperty')}</span>
                    {place ? (
                      <span className={s.cardPlace}>
                        <Icon name="map-pin" size={16} />
                        {place}
                      </span>
                    ) : null}
                    <span className={s.cardStep}>
                      <span>{t('ui.client.dossier.list.step', { n: d.step, etape: stepLabel })}</span>
                      <StepDots total={6} current={d.step} done={d.status === 'WON'} />
                    </span>
                    {d.completenessPct !== null ? (
                      <Progress value={d.completenessPct} label={t('ui.client.dashboard.project.completeness', { n: d.completenessPct })} legend={t('ui.client.dossier.list.completeness', { n: d.completenessPct })} tone={d.completenessPct >= 100 ? 'green' : 'gold'} />
                    ) : null}
                    <span className={s.cardFoot}>
                      <span>{t('ui.client.dossier.list.lastActivity', { date: longDate(d.lastActivityAt, timeZone) })}</span>
                      {d.reference === shownReference ? <span className={s.cardCurrent}>{t('ui.client.dossier.list.current')}</span> : null}
                    </span>
                  </span>
                  <span className={`${k.go} ${s.cardGo}`} aria-hidden="true">
                    <Icon name="chevron-right" size={20} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
