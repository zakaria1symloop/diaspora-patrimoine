'use client';
// ECL-031 — « Suivi »: the dossier's history as the client may read it, most recent first, each line with its date and
// the icon of its family; 20 lines, then « Afficher plus » (cursor, API-010). A filter by family — Tout · Demandes ·
// Bien · Pièces · Financement · Étapes — with the counters the SERVER computed (this list can grow long: TRV-100,
// TRV-106); the family is kept in the address (`suivi=`, TRV-101) and the lines are replaced in place (TRV-107).
// The sentence is composed here from `kind` and frozen `params`.
import { useEffect, useRef, useState } from 'react';
import { TIMELINE_FAMILY_KEYS, timelineFamilyOf, type TimelineEntry, type TimelineFamily, type TimelinePage } from '@dp/contracts';
import { Button, Icon, type IconName } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import { EmptyState } from '../EmptyState';
import { longDate, timelineSentence } from '../texts';
import { FilterChips, NoMatch, useListState } from '../kit/ListControls';
import k from '../kit/kit.module.css';
import s from './dossier.module.css';

const ICON: Record<TimelineFamily, IconName> = { REQUESTS: 'chat', PROPERTY: 'home', DOCUMENTS: 'file', FINANCING: 'bank', PROJECT: 'key' };

export function Timeline({ reference, initial, initialFamily, timeZone }: { reference: string; initial: TimelinePage; initialFamily: TimelineFamily | null; timeZone: string }) {
  const list = useListState();
  const asked = list.get('suivi').toUpperCase();
  const family = (TIMELINE_FAMILY_KEYS as string[]).includes(asked) ? (asked as TimelineFamily) : null;
  const [page, setPage] = useState({ family: initialFamily, items: initial.data, cursor: initial.meta.nextCursor, meta: initial.meta });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const base = `/client/dossiers/${encodeURIComponent(reference)}/timeline`;

  // The address changed (a chip, « Retour »): read that family from the server; the lines stay, dimmed, meanwhile.
  useEffect(() => {
    if (family === page.family) return;
    const id = ++request.current;
    setLoading(true);
    setFailed(false);
    void apiCall<TimelinePage>(`${base}${family ? `?family=${family}` : ''}`, { retryOnAuth: true }).then((r) => {
      if (id !== request.current) return;
      setLoading(false);
      if (!r.ok) return setFailed(true);
      setPage({ family, items: r.data.data, cursor: r.data.meta.nextCursor, meta: r.data.meta });
    });
  }, [family, page.family, base]);

  async function more() {
    if (!page.cursor) return;
    setBusy(true);
    setFailed(false);
    const q = new URLSearchParams({ before: page.cursor });
    if (page.family) q.set('family', page.family);
    const r = await apiCall<TimelinePage>(`${base}?${q.toString()}`, { retryOnAuth: true });
    setBusy(false);
    if (!r.ok) return setFailed(true);
    setPage((p) => ({ ...p, items: [...p.items, ...r.data.data], cursor: r.data.meta.nextCursor, meta: r.data.meta }));
  }

  const { total, counts } = page.meta;
  if (total === 0) return <EmptyState compact icon="clock" title={t('ui.client.dossier.timeline.empty')} />;
  const families = TIMELINE_FAMILY_KEYS.filter((f) => counts[f] > 0);
  return (
    <>
      {families.length > 1 ? (
        <div className={s.timelineFilter}>
          <FilterChips
            label={t('ui.client.dossier.timeline.filter')}
            value={family ?? ''}
            onChange={(v) => list.set({ suivi: v ? v.toLowerCase() : null }, { push: true })}
            options={[{ value: '', label: t('ui.client.dossier.timeline.families.ALL'), count: total }, ...families.map((f) => ({ value: f as string, label: t(`ui.client.dossier.timeline.families.${f}`), count: counts[f] }))]}
          />
        </div>
      ) : null}
      {page.items.length === 0 && !loading ? (
        <NoMatch onClear={() => list.clear(['suivi'])} />
      ) : (
        <ol className={s.timeline} aria-busy={loading} data-loading={loading || undefined}>
          {page.items.map((e: TimelineEntry, i) => (
            <li key={e.id} className={`${s.event} ${k.enter}`} style={{ ['--i' as string]: i }}>
              <span className={s.eventIcon} aria-hidden="true">
                <Icon name={ICON[timelineFamilyOf(e.kind)]} size={20} />
              </span>
              <div className={s.eventBody}>
                <p className={s.eventText}>{timelineSentence(e, timeZone)}</p>
                <time dateTime={e.occurredAt} className={s.eventDate}>
                  {longDate(e.occurredAt, timeZone)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
      {failed ? (
        <p className={s.failed} role="alert">
          <Icon name="status-error" size={20} />
          {t('ui.common.error.block')}
        </p>
      ) : null}
      {page.cursor ? (
        <Button variant="secondary" size="M" pending={busy} onClick={() => void more()}>
          {t('ui.client.dossier.timeline.more')}
        </Button>
      ) : null}
    </>
  );
}
