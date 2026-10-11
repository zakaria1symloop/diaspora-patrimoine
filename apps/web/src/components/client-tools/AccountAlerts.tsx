'use client';
// EC-42 « Mes alertes et recherches » (SFA-030, SFA-031, CAT-093). Each card leads with what the alert watches (its
// criteria, CAT-022) and its state (« Active jusqu'au {date} » · « En pause » · « Expirée »), the last sending, the
// frequency as three choices saved at once (« Préférence enregistrée. »); ONE main action (« Voir les biens » /
// « Lancer »), then visibly secondary ones: Modifier les critères (the catalogue with its filters), Mettre en pause /
// Réactiver, Prolonger, and Supprimer (short confirmation: definitive). A saved search is renamed in place and becomes
// an alert with « Recevoir les nouveautés ». The lists are bounded (10 alerts, 20 searches): a filter by state with
// counters, kept in the address (`etat=`, TRV-101). « Créer une alerte » leads to the catalogue (CAT-070).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ALERT_FREQUENCIES, criteriaToSearch, type AccountAlert, type AccountAlertsResponse, type AlertSendFrequency } from '@dp/contracts';
import { Button, ButtonInner, Icon, buttonClass } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import { EmptyState } from '@/components/client-space/EmptyState';
import { useOptionalSpace } from '@/components/client-space/SpaceContext';
import { Encouragement } from '@/components/client-space/kit/Encouragement';
import { FilterChips, NoMatch, Toolbar, useListState } from '@/components/client-space/kit/ListControls';
import k from '@/components/client-space/kit/kit.module.css';
import space from '@/components/client-space/space.module.css';
import { ALERT_EDIT_KEY } from '@/components/alerts/AlertEditBanner';
import { Modal } from './Modal';
import { ConfirmDelete } from './SimulationsList';
import { longDate } from './format';
import s from './tools.module.css';

type Patch = { frequency: AlertSendFrequency } | { paused: boolean } | { extend: true } | { confirm: true } | { label: string };
type Filter = '' | 'actives' | 'pause' | 'expirees' | 'a-activer' | 'recherches';
const STATE_FILTER: Record<AccountAlert['state'], Filter> = { ACTIVE: 'actives', PAUSED: 'pause', EXPIRED: 'expirees', PENDING: 'a-activer' };
const SOON_DAYS = 14;

function errorMessage(reason: string | null | undefined): string {
  if (reason === 'ALERT_LIMIT') return t('ui.clientTools.alerts.limit');
  if (reason === 'SEARCH_LIMIT') return t('ui.clientTools.alerts.searchLimit');
  return t('ui.clientTools.alerts.error');
}

const endsSoon = (a: AccountAlert) => a.state === 'ACTIVE' && a.expiresAt !== null && new Date(a.expiresAt).getTime() - Date.now() < SOON_DAYS * 86_400_000;

export function AccountAlerts({ initial }: { initial: AccountAlertsResponse }) {
  const [alerts, setAlerts] = useState(initial.alerts);
  const [searches, setSearches] = useState(initial.searches);
  const [deleting, setDeleting] = useState<AccountAlert | null>(null);
  const tz = useOptionalSpace()?.summary.timeZone ?? 'Europe/Paris';
  const list = useListState();
  useEffect(() => {
    setAlerts(initial.alerts);
    setSearches(initial.searches);
  }, [initial.alerts, initial.searches]);
  const filter = list.get('etat') as Filter;
  const count = (f: Filter) => alerts.filter((a) => STATE_FILTER[a.state] === f).length;
  const activeCount = count('actives');
  const expiring = alerts.filter(endsSoon).length;
  const shownAlerts = filter === 'recherches' ? [] : alerts.filter((a) => !filter || STATE_FILTER[a.state] === filter);
  const shownSearches = filter && filter !== 'recherches' ? [] : searches;

  const replace = (a: AccountAlert) => {
    if (a.kind === 'ALERT') {
      setSearches((l) => l.filter((x) => x.id !== a.id));
      setAlerts((l) => (l.some((x) => x.id === a.id) ? l.map((x) => (x.id === a.id ? a : x)) : [a, ...l]));
    } else setSearches((l) => l.map((x) => (x.id === a.id ? a : x)));
  };

  const patch = async (a: AccountAlert, body: Patch, done: string | ((updated: AccountAlert) => string)): Promise<boolean> => {
    const r = await apiCall<AccountAlert>(`/client/alerts/${a.id}`, { method: 'PATCH', body, retryOnAuth: true });
    if (!r.ok) {
      showToast({ message: errorMessage(r.error?.reason), tone: 'error' });
      return false;
    }
    replace(r.data);
    showToast({ message: typeof done === 'string' ? done : done(r.data), tone: 'success' });
    return true;
  };

  const createButton = (size: 'M' | 'L') => (
    <Link href="/programmes?alerte=1" className={buttonClass('tool', size)}>
      <ButtonInner size={size} icon="bell">
        {t('ui.clientTools.alerts.create')}
      </ButtonInner>
    </Link>
  );

  const total = alerts.length + searches.length;
  return (
    <div className={s.stack}>
      {expiring > 0 ? (
        <Encouragement tone="attention" icon="clock" title={t('ui.clientTools.alerts.encourage.expiring.title', { n: expiring })} text={t('ui.clientTools.alerts.encourage.expiring.text')} />
      ) : activeCount > 0 ? (
        <Encouragement tone="calm" icon="bell" title={t('ui.clientTools.alerts.encourage.watching.title', { n: activeCount })} text={t('ui.clientTools.alerts.encourage.watching.text')} />
      ) : alerts.some((a) => a.state === 'PAUSED') ? (
        <Encouragement tone="calm" icon="pause" title={t('ui.clientTools.alerts.encourage.paused.title')} text={t('ui.clientTools.alerts.encourage.paused.text')} />
      ) : null}

      {total > 1 ? (
        <Toolbar>
          <FilterChips
            label={t('ui.clientTools.alerts.filter.label')}
            value={filter}
            onChange={(v) => list.set({ etat: v }, { push: true })}
            options={[
              { value: '', label: t('ui.clientTools.alerts.filter.all'), count: total },
              { value: 'actives', label: t('ui.clientTools.alerts.filter.active'), count: activeCount },
              { value: 'pause', label: t('ui.clientTools.alerts.filter.paused'), count: count('pause') },
              { value: 'a-activer', label: t('ui.clientTools.alerts.filter.pending'), count: count('a-activer') },
              { value: 'expirees', label: t('ui.clientTools.alerts.filter.expired'), count: count('expirees') },
              { value: 'recherches', label: t('ui.clientTools.alerts.filter.searches'), count: searches.length },
            ].filter((o) => o.value === '' || o.count > 0 || o.value === filter)}
          />
        </Toolbar>
      ) : null}

      {filter !== 'recherches' ? (
        <section aria-labelledby="mes-alertes">
          <div className={k.sectionHead}>
            <h2 id="mes-alertes" className={k.sectionTitle}>
              {t('ui.clientTools.alerts.alertsTitle')}
            </h2>
            <span className={k.sectionAside}>{t('ui.clientTools.alerts.alertsCount', { n: activeCount, max: initial.limits.alerts })}</span>
          </div>
          {alerts.length === 0 ? (
            <EmptyState compact icon="bell" title={t('ui.clientTools.alerts.empty')} text={t('ui.clientTools.alerts.emptyText')} actions={createButton('M')} />
          ) : shownAlerts.length === 0 ? (
            <NoMatch onClear={() => list.clear(['etat'])} />
          ) : (
            <ul className={s.cards}>
              {shownAlerts.map((a, i) => (
                <li key={a.id} className={[s.alert, k.enter, a.state !== 'ACTIVE' && s.alertMuted].filter(Boolean).join(' ')} style={{ ['--i' as string]: i }} data-alert={a.state}>
                  <div className={s.simHead}>
                    <span className={s.simIcon} aria-hidden="true">
                      <Icon name="bell" size={20} />
                    </span>
                    <span className={[space.tag, a.state === 'ACTIVE' ? space.tagSuccess : a.state === 'EXPIRED' ? space.tagNeutral : space.tagWarning].join(' ')}>
                      {a.state === 'ACTIVE'
                        ? t('ui.clientTools.alerts.state.ACTIVE', { date: longDate(a.expiresAt!, tz) })
                        : a.state === 'PAUSED' && a.pausedAt
                          ? t('ui.clientTools.alerts.state.PAUSED_SINCE', { date: longDate(a.pausedAt, tz) })
                          : t(`ui.clientTools.alerts.state.${a.state}`)}
                    </span>
                  </div>
                  <Criteria alert={a} />
                  <p className={s.meta}>
                    <Icon name="mail" size={16} />
                    {a.lastSentAt ? t('ui.clientTools.alerts.lastSent', { date: longDate(a.lastSentAt, tz) }) : t('ui.clientTools.alerts.neverSent')}
                  </p>
                  {endsSoon(a) ? <p className={s.soon}>{t('ui.clientTools.alerts.extendHint')}</p> : null}
                  {a.state !== 'EXPIRED' && a.state !== 'PENDING' ? (
                    <fieldset className={s.frequency}>
                      <legend>
                        <span aria-hidden="true">{t('ui.clientTools.alerts.frequencyLabel')}</span>
                        <span className="visually-hidden">{t('ui.clientTools.alerts.frequencyOf', { libelle: a.label })}</span>
                      </legend>
                      <div className={s.segments}>
                        {ALERT_FREQUENCIES.map((f) => (
                          <button
                            key={f}
                            type="button"
                            className={s.segment}
                            aria-pressed={(a.frequency ?? 'DAILY') === f}
                            onClick={() => (a.frequency === f ? undefined : void patch(a, { frequency: f }, t('ui.clientTools.alerts.done.saved')))}
                          >
                            {t(`ui.alerts.dialog.frequencies.${f}`)}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                  <div className={s.simActions}>
                    {a.state === 'PENDING' ? (
                      <Button variant="tool" size="M" icon="check" onClick={() => void patch(a, { confirm: true }, t('ui.clientTools.alerts.done.activated'))}>
                        {t('ui.clientTools.alerts.actions.activate')}
                      </Button>
                    ) : a.state === 'EXPIRED' || endsSoon(a) ? (
                      <Button variant="tool" size="M" icon="clock" onClick={() => void patch(a, { extend: true }, (u) => t('ui.clientTools.alerts.done.extended', { date: longDate(u.expiresAt!, tz) }))}>
                        {t('ui.clientTools.alerts.actions.extend')}
                      </Button>
                    ) : null}
                    <Link href={a.resultsPath} className={buttonClass(a.state === 'PENDING' || a.state === 'EXPIRED' || endsSoon(a) ? 'secondary' : 'tool', 'M')}>
                      <ButtonInner size="M" icon="search">
                        {t('ui.clientTools.alerts.actions.see')}
                      </ButtonInner>
                    </Link>
                  </div>
                  <div className={s.simTools}>
                    <Link href={editHref(a)} className={k.quiet} onClick={() => markEditing(a)}>
                      <Icon name="sliders" size={20} />
                      {t('ui.clientTools.alerts.actions.edit')}
                    </Link>
                    {a.state === 'ACTIVE' ? (
                      <button type="button" className={k.quiet} onClick={() => void patch(a, { paused: true }, t('ui.clientTools.alerts.done.paused'))}>
                        <Icon name="pause" size={20} />
                        {t('ui.clientTools.alerts.actions.pause')}
                      </button>
                    ) : null}
                    {a.state === 'PAUSED' ? (
                      <button type="button" className={k.quiet} onClick={() => void patch(a, { paused: false }, t('ui.clientTools.alerts.done.resumed'))}>
                        <Icon name="play" size={20} />
                        {t('ui.clientTools.alerts.actions.resume')}
                      </button>
                    ) : null}
                    {a.state === 'ACTIVE' && !endsSoon(a) ? (
                      <button type="button" className={k.quiet} onClick={() => void patch(a, { extend: true }, (u) => t('ui.clientTools.alerts.done.extended', { date: longDate(u.expiresAt!, tz) }))}>
                        <Icon name="clock" size={20} />
                        {t('ui.clientTools.alerts.actions.extend')}
                      </button>
                    ) : null}
                    {a.state === 'PAUSED' ? (
                      <button type="button" className={k.quiet} onClick={() => void patch(a, { extend: true }, (u) => t('ui.clientTools.alerts.done.extended', { date: longDate(u.expiresAt!, tz) }))}>
                        <Icon name="clock" size={20} />
                        {t('ui.clientTools.alerts.actions.extend')}
                      </button>
                    ) : null}
                    <button type="button" className={`${k.quiet} ${k.quietDanger} ${s.toEnd}`} onClick={() => setDeleting(a)}>
                      <Icon name="trash" size={20} />
                      {t('ui.clientTools.alerts.actions.delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {!filter || filter === 'recherches' ? (
        <section aria-labelledby="mes-recherches">
          <div className={k.sectionHead}>
            <h2 id="mes-recherches" className={k.sectionTitle}>
              {t('ui.clientTools.alerts.searchesTitle')}
            </h2>
            <span className={k.sectionAside}>{t('ui.clientTools.alerts.searchesCount', { n: searches.length, max: initial.limits.searches })}</span>
          </div>
          {shownSearches.length ? (
            <ul className={s.cards}>
              {shownSearches.map((a, i) => (
                <SearchCard key={a.id} alert={a} index={i} tz={tz} onPatch={patch} onDelete={() => setDeleting(a)} />
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon="star"
              title={t('ui.clientTools.alerts.emptySearches')}
              text={t('ui.clientTools.alerts.emptySearchesText')}
              actions={
                <Link href="/programmes" className={buttonClass('secondary', 'M')}>
                  <ButtonInner size="M" icon="search">
                    {t('ui.clientTools.favorites.discover')}
                  </ButtonInner>
                </Link>
              }
            />
          )}
        </section>
      ) : null}

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={deleting?.kind === 'SEARCH' ? t('ui.clientTools.alerts.delete.searchTitle') : t('ui.clientTools.alerts.delete.title')}
        closeLabel={t('ui.clientTools.simulations.actions.close')}
      >
        {deleting ? (
          <ConfirmDelete
            text={deleting.kind === 'SEARCH' ? t('ui.clientTools.alerts.delete.searchText') : t('ui.clientTools.alerts.delete.text')}
            confirmLabel={t('ui.clientTools.alerts.delete.confirm')}
            cancelLabel={t('ui.clientTools.alerts.delete.cancel')}
            onCancel={() => setDeleting(null)}
            onConfirm={async () => {
              const r = await apiCall(`/client/alerts/${deleting.id}`, { method: 'DELETE', retryOnAuth: true });
              if (!r.ok) return false;
              setAlerts((l) => l.filter((x) => x.id !== deleting.id));
              setSearches((l) => l.filter((x) => x.id !== deleting.id));
              showToast({ message: deleting.kind === 'SEARCH' ? t('ui.clientTools.alerts.done.searchDeleted') : t('ui.clientTools.alerts.done.deleted'), tone: 'success' });
              setDeleting(null);
              return true;
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

/** CAT-022 — what the alert watches: its label, one criterion per pill. */
function Criteria({ alert }: { alert: AccountAlert }) {
  const parts = alert.label.split(' · ').filter(Boolean);
  return (
    <div className={s.criteria}>
      <h3 className={s.simTitle}>{alert.label || t('ui.clientTools.alerts.noCriteria')}</h3>
      {parts.length > 1 ? (
        <ul className={s.chips} aria-label={t('ui.clientTools.alerts.criteria')}>
          {parts.map((p) => (
            <li key={p} className={s.chip}>
              {p}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SearchCard({ alert: a, index, tz, onPatch, onDelete }: { alert: AccountAlert; index: number; tz: string; onPatch: (a: AccountAlert, body: Patch, done: string) => Promise<boolean>; onDelete: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(a.label);
  const [pending, setPending] = useState(false);
  const id = `nom-${a.id}`;
  return (
    <li className={`${s.alert} ${k.enter}`} style={{ ['--i' as string]: index }} data-alert="SEARCH">
      <div className={s.simHead}>
        <span className={s.simIcon} aria-hidden="true">
          <Icon name="search" size={20} />
        </span>
        <span className={`${space.tag} ${space.tagNeutral}`}>{t('ui.clientTools.alerts.kind.SEARCH')}</span>
        <span className={s.simDate}>{t('ui.clientTools.alerts.savedOn', { date: longDate(a.createdAt, tz) })}</span>
      </div>
      {renaming ? (
        <form
          className={s.rename}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!value.trim()) return;
            setPending(true);
            const ok = await onPatch(a, { label: value.trim() }, t('ui.clientTools.alerts.done.renamed'));
            setPending(false);
            if (ok) setRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setRenaming(false);
            }
          }}
        >
          <label htmlFor={id} className={s.renameLabel}>
            {t('ui.clientTools.alerts.renameInline')}
          </label>
          <input id={id} className={s.renameInput} value={value} maxLength={120} autoFocus onChange={(e) => setValue(e.target.value)} />
          <div className={s.renameActions}>
            <Button variant="tool" size="S" type="submit" pending={pending}>
              {t('ui.clientTools.alerts.rename.save')}
            </Button>
            <Button variant="tertiary" size="S" onClick={() => setRenaming(false)}>
              {t('ui.clientTools.alerts.rename.cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <Criteria alert={a} />
      )}
      <div className={s.simActions}>
        <Link href={a.resultsPath} className={buttonClass('tool', 'M')}>
          <ButtonInner size="M" icon="search">
            {t('ui.clientTools.alerts.actions.run')}
          </ButtonInner>
        </Link>
        <Button variant="secondary" size="M" icon="bell" onClick={() => void onPatch(a, { frequency: 'DAILY' }, t('ui.clientTools.alerts.done.toAlert'))}>
          {t('ui.clientTools.alerts.actions.toAlert')}
        </Button>
      </div>
      <div className={s.simTools}>
        <Link href={editHref(a)} className={k.quiet} onClick={() => markEditing(a)}>
          <Icon name="sliders" size={20} />
          {t('ui.clientTools.alerts.actions.edit')}
        </Link>
        <button
          type="button"
          className={k.quiet}
          disabled={renaming}
          onClick={() => {
            setValue(a.label);
            setRenaming(true);
          }}
        >
          <Icon name="edit" size={20} />
          {t('ui.clientTools.alerts.actions.rename')}
        </button>
        <button type="button" className={`${k.quiet} ${k.quietDanger} ${s.toEnd}`} onClick={onDelete}>
          <Icon name="trash" size={20} />
          {t('ui.clientTools.alerts.actions.delete')}
        </button>
      </div>
    </li>
  );
}

/** SFA-031 « Modifier les critères » — the catalogue with these criteria and the banner « Mettre à jour l'alerte ». */
function editHref(a: AccountAlert): string {
  return `/programmes${criteriaToSearch(a.criteria)}`;
}

/** The catalogue keeps only its own criteria in the address: the alert being changed travels in the tab session. */
function markEditing(a: AccountAlert): void {
  try {
    sessionStorage.setItem(ALERT_EDIT_KEY, a.id);
  } catch {
    /* storage refused: the catalogue opens with the criteria, without the banner */
  }
}
