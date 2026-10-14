'use client';
// EC-13 — Biens proposés (INT-010 … INT-023): the properties the advisor sent, most recent sending first, each sending
// with who proposed, when, and his note. A filter by state with counters (`etat=` in the address, TRV-101) and an
// encouragement that says what is waiting (D-098). The list is bounded (what one advisor proposes to one client):
// filtered here. Each card carries its answers (« Ce bien m'intéresse », « Ce bien ne me convient pas », INT-020),
// « Voir le bien » and « Écrire à mon conseiller » (`CandidateCard`).
import Link from 'next/link';
import type { CandidateCard as Card, ProposalGroup } from '@dp/contracts';
import { buttonClass, ButtonInner } from '@dp/ui';
import { t } from '@/lib/i18n';
import { Avatar } from '../Avatar';
import { writeToAdvisorHref } from '../advisor-link';
import { advisorName, inSentence, longDate } from '../texts';
import { Encouragement } from '../kit/Encouragement';
import { FilterChips, NoMatch, ResultLine, Toolbar, useListState } from '../kit/ListControls';
import k from '../kit/kit.module.css';
import { CandidateCard } from './CandidateCard';
import s from './properties.module.css';

type Bucket = 'nouveaux' | 'consultes' | 'suivis' | 'clos';
function bucketOf(c: Card): Bucket {
  if (c.unavailable || c.status === 'DECLINED' || c.status === 'UNAVAILABLE') return 'clos';
  if (c.status === 'PROPOSED' && !c.viewedAt) return 'nouveaux';
  if (c.status === 'PROPOSED' || c.status === 'VIEWED') return 'consultes';
  return 'suivis';
}

export function ProposalsBoard({ groups, timeZone, footnote }: { groups: ProposalGroup[]; timeZone: string; footnote: string }) {
  const list = useListState();
  const state = list.get('etat') as Bucket | '';
  const all = groups.flatMap((g) => g.items);
  const count = (b: Bucket) => all.filter((c) => bucketOf(c) === b).length;
  const fresh = count('nouveaux');
  const pending = count('consultes');
  const shownGroups = groups.map((g) => ({ ...g, items: g.items.filter((c) => !state || bucketOf(c) === state) })).filter((g) => g.items.length);
  const shownCount = shownGroups.reduce((n, g) => n + g.items.length, 0);
  const conseiller = advisorName(groups[0]?.advisor ?? null) ?? t('ui.client.nextStep.advisorFallback');
  const anyMonthly = shownGroups.some((g) => g.items.some((c) => c.property.monthly));
  let index = 0;
  return (
    <>
      {fresh > 0 ? (
        <div className={s.encourage}>
          <Encouragement tone="attention" icon="sparkles" title={t('ui.client.proposals.encourage.new.title', { n: fresh })} text={inSentence(t('ui.client.proposals.encourage.new.text', { n: fresh, conseiller }))} />
        </div>
      ) : pending > 0 ? (
        <div className={s.encourage}>
          <Encouragement
            tone="calm"
            icon="chat"
            title={t('ui.client.proposals.encourage.seen.title')}
            text={inSentence(t('ui.client.proposals.encourage.seen.text', { conseiller }))}
            actions={
              <Link href={writeToAdvisorHref({ from: 'ADVISOR' })} className={buttonClass('tool', 'M')}>
                <ButtonInner size="M" icon="chat">
                  {t('ui.client.proposals.encourage.seen.action')}
                </ButtonInner>
              </Link>
            }
          />
        </div>
      ) : null}
      {all.length > 1 ? (
        <Toolbar>
          <FilterChips
            label={t('ui.client.proposals.filter.label')}
            value={state}
            onChange={(v) => list.set({ etat: v }, { push: true })}
            options={[
              { value: '', label: t('ui.client.proposals.filter.all'), count: all.length },
              { value: 'nouveaux', label: t('ui.client.proposals.filter.new'), count: fresh },
              { value: 'consultes', label: t('ui.client.proposals.filter.viewed'), count: pending },
              { value: 'suivis', label: t('ui.client.proposals.filter.followed'), count: count('suivis') },
              { value: 'clos', label: t('ui.client.proposals.filter.closed'), count: count('clos') },
            ].filter((o) => o.value === '' || o.count > 0 || o.value === state)}
          />
        </Toolbar>
      ) : null}
      <ResultLine shown={shownCount} total={all.length} filtered={Boolean(state)} onClear={() => list.clear(['etat'])} />
      {shownGroups.length === 0 ? (
        <NoMatch onClear={() => list.clear(['etat'])} />
      ) : (
        shownGroups.map((g) => {
          const name = advisorName(g.advisor);
          const date = longDate(g.sentAt, timeZone);
          return (
            <section key={`${g.sentAt}-${name ?? ''}`} className={s.group}>
              <div className={s.groupHead}>
                <Avatar advisor={g.advisor} size="M" />
                <div className={s.groupHeadText}>
                  <h2 className={s.groupTitle}>{name ? t('ui.client.proposals.group', { conseiller: name, date }) : t('ui.client.proposals.groupTeam', { date })}</h2>
                  <p className={s.groupCount}>{t('ui.client.proposals.groupCount', { n: g.items.length })}</p>
                </div>
              </div>
              {g.message ? (
                <figure className={s.groupMessage}>
                  <figcaption>{name ? t('ui.client.proposals.note', { conseiller: name }) : t('ui.client.proposals.noteTeam')}</figcaption>
                  <blockquote>{g.message}</blockquote>
                </figure>
              ) : null}
              <ul role="list" className={s.grid}>
                {g.items.map((c) => (
                  <li key={c.id}>
                    <CandidateCard card={c} context="proposals" index={index++} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      {anyMonthly ? <p className={k.footnote}>{footnote}</p> : null}
    </>
  );
}
