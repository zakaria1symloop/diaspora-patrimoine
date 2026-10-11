'use client';
// EC-12 — « Les biens qui m'intéressent » (INT-001) and « Mes demandes » (INT-003), as two smart lists (D-098): each
// has its filter by state with counters, the properties also a search and a sort; the state of both is kept in the
// address (`etat`, `tri`, `q`, `demandes` — TRV-101). Both lists are bounded (the properties envisaged of a client,
// his hundred last requests): filtered here, with the counters of the complete lists. On a wide screen the requests
// sit beside the properties; below, under them.
import Link from 'next/link';
import type { CandidateCard as Card, ClientRequestRow, LeadKind } from '@dp/contracts';
import { buttonClass, ButtonInner, Icon, type IconName } from '@dp/ui';
import type { MessageKey } from '@dp/i18n';
import { t } from '@/lib/i18n';
import { writeToAdvisorHref } from '../advisor-link';
import { EmptyState } from '../EmptyState';
import { dossierPath } from '../menu';
import { advisorName, longDate } from '../texts';
import { Encouragement } from '../kit/Encouragement';
import { FilterChips, matches, NoMatch, ResultLine, SearchBox, SortSelect, Toolbar, useListState } from '../kit/ListControls';
import k from '../kit/kit.module.css';
import sp from '../space.module.css';
import { CandidateCard } from './CandidateCard';
import s from './properties.module.css';

type Bucket = 'attente' | 'visite' | 'retenu' | 'clos';
function bucketOf(c: Card): Bucket {
  if (c.unavailable || c.status === 'DECLINED' || c.status === 'UNAVAILABLE') return 'clos';
  if (c.status === 'SELECTED') return 'retenu';
  if (['VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED'].includes(c.status)) return 'visite';
  return 'attente';
}
const amount = (c: Card) => (c.property.price ? Number(c.property.price.amount) : Number.POSITIVE_INFINITY);

const REQUEST_TONE: Record<string, string> = { NEW: sp.tagInfo!, IN_PROGRESS: sp.tagWarning!, CLOSED: sp.tagNeutral! };
const REQUEST_ICON: Partial<Record<LeadKind, IconName>> = {
  PROPERTY_INTEREST: 'heart',
  PROJECTION_REQUEST: 'calculator',
  CALLBACK_REQUEST: 'phone',
  CONTACT_MESSAGE: 'chat',
  GUIDED_SEARCH: 'search',
  SIMULATION_FOLLOWUP: 'calculator',
};

export function InterestsBoard({ properties, requests, timeZone, footnote }: { properties: Card[]; requests: ClientRequestRow[]; timeZone: string; footnote: string }) {
  const list = useListState({ tri: 'recent' });
  const state = list.get('etat') as Bucket | '';
  const sort = list.get('tri');
  const q = list.get('q');
  const count = (b: Bucket) => properties.filter((c) => bucketOf(c) === b).length;
  let shown = properties.filter((c) => (!state || bucketOf(c) === state) && matches([c.property.title, c.property.city, c.property.region, c.property.reference], q));
  if (sort === 'prix') shown = [...shown].sort((a, b) => amount(a) - amount(b));
  if (sort === 'prix-desc') shown = [...shown].sort((a, b) => (amount(b) === Number.POSITIVE_INFINITY ? -1 : amount(b)) - (amount(a) === Number.POSITIVE_INFINITY ? -1 : amount(a)));
  const filtered = list.active(['etat', 'q']);
  const selected = properties.find((c) => c.status === 'SELECTED' && !c.unavailable);
  const waiting = properties.filter((c) => c.status === 'INTERESTED' && c.promise && !c.promise.breached).length;
  const anyMonthly = shown.some((c) => c.property.monthly);

  const reqState = list.get('demandes');
  const open = requests.filter((r) => r.status !== 'CLOSED');
  const closed = requests.filter((r) => r.status === 'CLOSED');
  const shownRequests = reqState === 'en-cours' ? open : reqState === 'traitees' ? closed : requests;

  return (
    <div className={s.board}>
      <section className={s.boardMain} aria-labelledby="biens-interets">
        <div className={k.sectionHead}>
          <h2 id="biens-interets" className={k.sectionTitle}>
            {t('ui.client.interests.propertiesTitle')}
            {properties.length ? <span className={k.sectionCount}>{properties.length}</span> : null}
          </h2>
        </div>
        {properties.length === 0 ? (
          <EmptyState
            icon="heart"
            title={t('ui.client.interests.empty')}
            text={t('ui.client.interests.emptyText')}
            actions={
              <Link href="/programmes" className={buttonClass('tool', 'L')}>
                <ButtonInner chevron size="L">
                  {t('ui.client.interests.browse')}
                </ButtonInner>
              </Link>
            }
          />
        ) : (
          <>
            {selected ? (
              <div className={s.encourage}>
                <Encouragement
                  tone="done"
                  icon="key"
                  title={t('ui.client.interests.encourage.selected.title')}
                  text={t('ui.client.interests.encourage.selected.text', { bien: selected.property.title })}
                  actions={
                    <Link href={dossierPath(selected.dossierReference)} className={buttonClass('tool', 'M')}>
                      <ButtonInner size="M" chevron>
                        {t('ui.client.interests.encourage.selected.action')}
                      </ButtonInner>
                    </Link>
                  }
                />
              </div>
            ) : waiting ? (
              <div className={s.encourage}>
                <Encouragement tone="calm" icon="status-success" title={t('ui.client.interests.encourage.waiting.title', { n: waiting })} text={t('ui.client.interests.encourage.waiting.text')} />
              </div>
            ) : null}
            {properties.length > 1 ? (
              <Toolbar
                end={
                  <>
                    {properties.length > 4 ? <SearchBox label={t('ui.client.properties.search')} value={q} onChange={(v) => list.set({ q: v })} /> : null}
                    <SortSelect
                      value={sort}
                      onChange={(v) => list.set({ tri: v }, { push: true })}
                      options={[
                        { value: 'recent', label: t('ui.client.properties.sort.recent') },
                        { value: 'prix', label: t('ui.client.properties.sort.priceAsc') },
                        { value: 'prix-desc', label: t('ui.client.properties.sort.priceDesc') },
                      ]}
                    />
                  </>
                }
              >
                <FilterChips
                  label={t('ui.client.properties.filter.label')}
                  value={state}
                  onChange={(v) => list.set({ etat: v }, { push: true })}
                  options={[
                    { value: '', label: t('ui.client.properties.filter.all'), count: properties.length },
                    { value: 'attente', label: t('ui.client.properties.filter.waiting'), count: count('attente') },
                    { value: 'visite', label: t('ui.client.properties.filter.visit'), count: count('visite') },
                    { value: 'retenu', label: t('ui.client.properties.filter.selected'), count: count('retenu') },
                    { value: 'clos', label: t('ui.client.properties.filter.closed'), count: count('clos') },
                  ].filter((o) => o.value === '' || o.count > 0 || o.value === state)}
                />
              </Toolbar>
            ) : null}
            <ResultLine shown={shown.length} total={properties.length} filtered={filtered} onClear={() => list.clear(['etat', 'q'])} />
            {shown.length === 0 ? (
              <NoMatch onClear={() => list.clear(['etat', 'q'])} />
            ) : (
              <ul role="list" className={s.grid}>
                {shown.map((c, i) => (
                  <li key={c.id}>
                    <CandidateCard card={c} context="interests" index={i} />
                  </li>
                ))}
              </ul>
            )}
            {anyMonthly ? <p className={k.footnote}>{footnote}</p> : null}
          </>
        )}
      </section>

      <section className={s.boardSide} aria-labelledby="mes-demandes" id="demandes">
        <div className={k.sectionHead}>
          <h2 id="mes-demandes" className={k.sectionTitle}>
            {t('ui.client.interests.requestsTitle')}
            {requests.length ? <span className={k.sectionCount}>{requests.length}</span> : null}
          </h2>
        </div>
        {requests.length === 0 ? (
          <EmptyState
            compact
            icon="chat"
            title={t('ui.client.interests.requestsEmpty')}
            actions={
              <Link href={writeToAdvisorHref({ from: 'ADVISOR' })} className={buttonClass('secondary', 'M')}>
                <ButtonInner size="M" icon="chat">
                  {t('ui.common.writeToAdvisor')}
                </ButtonInner>
              </Link>
            }
          />
        ) : (
          <>
            {open.length && closed.length ? (
              <Toolbar>
                <FilterChips
                  label={t('ui.client.interests.request.filter')}
                  value={reqState}
                  onChange={(v) => list.set({ demandes: v }, { push: true })}
                  options={[
                    { value: '', label: t('ui.client.interests.request.all'), count: requests.length },
                    { value: 'en-cours', label: t('ui.client.interests.request.open'), count: open.length },
                    { value: 'traitees', label: t('ui.client.interests.request.closed'), count: closed.length },
                  ]}
                />
              </Toolbar>
            ) : null}
            {shownRequests.length === 0 ? (
              <NoMatch onClear={() => list.clear(['demandes'])} />
            ) : (
              <ul role="list" className={s.requests}>
                {shownRequests.map((r, i) => {
                  const name = advisorName(r.advisor);
                  const stateLabel =
                    r.status === 'IN_PROGRESS'
                      ? name
                        ? t('ui.client.interests.request.IN_PROGRESS', { conseiller: name })
                        : t('ui.client.interests.request.IN_PROGRESS_team')
                      : t(`ui.client.interests.request.${r.status}` as MessageKey);
                  return (
                    <li key={r.reference} className={`${s.request} ${k.enter}`} id={`demande-${r.reference}`} style={{ ['--i' as string]: i }}>
                      <span className={s.requestIcon} aria-hidden="true">
                        <Icon name={REQUEST_ICON[r.kind] ?? 'chat'} size={20} />
                      </span>
                      <div className={s.requestBody}>
                        <p className={s.requestKind}>
                          {t(`ui.enum.LeadKind.${r.kind}` as MessageKey)}
                          {r.subject ? ` · ${r.subject}` : ''}
                        </p>
                        <p className={s.requestMeta}>
                          {t('ui.client.interests.request.sentOn', { date: longDate(r.createdAt, timeZone) })} · {t('ui.client.interests.request.reference', { reference: r.reference })}
                          {r.fromSpace ? ` · ${t('ui.client.interests.request.fromSpace')}` : ''}
                        </p>
                        {r.noCandidate ? <p className={s.requestMeta}>{t('ui.client.interests.request.noCandidate')}</p> : null}
                        <div className={s.requestFoot}>
                          <span className={`${sp.tag} ${REQUEST_TONE[r.status]}`}>{stateLabel}</span>
                          {r.status !== 'CLOSED' ? (
                            <Link href={writeToAdvisorHref({ from: 'ADVISOR' })} className={k.quiet} aria-label={t('ui.client.interests.request.writeAbout', { reference: r.reference })}>
                              <Icon name="chat" size={20} />
                              {t('ui.client.interests.request.write')}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
