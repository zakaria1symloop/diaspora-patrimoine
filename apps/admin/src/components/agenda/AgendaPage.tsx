'use client';
// EA-31 « Agenda » (TAC-035 … TAC-046). The week by default — Jour · Semaine · Mois · Liste —, in the reader's zone:
// the appointments as blocks (« Demandé » dashed until confirmed, « Tenu » quieter, « Annulé » struck), the tasks with an
// hour as small markers, the tasks of the day and the Cafés hosted on the top line. An administrator overlays the
// agendas of colleagues, one colour each. A click on an empty slot proposes « Rendez-vous » or « Tâche » at that hour; a
// click on an appointment opens it on the right (`?rdv=`); the list groups « À confirmer · À venir · À renseigner ·
// Passés » with their counts. The requests of clients without slot wait in a strip above the week.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { APPOINTMENT_VIEWS, type Agenda, type AgendaTask, type AppointmentItem, type AppointmentList, type AppointmentView } from '@dp/contracts';
import { Banner, Button, EmptyState, Icon, Skeleton, StatusTag, useDismiss } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { staffLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { PageHeader } from '../shell/Page';
import { signalShellChanged, useShell } from '../shell/ShellContext';
import { TaskDialog } from '../tasks/TaskDialog';
import { enumLabel } from '../tasks/task-parts';
import { AppointmentDialog, wallClock } from './AppointmentDialog';
import { AppointmentPanel, STATUS_TONE } from './AppointmentPanel';
import s from './agenda.module.css';

type Mode = 'jour' | 'semaine' | 'mois' | 'liste';
const MODES: Mode[] = ['jour', 'semaine', 'mois', 'liste'];
const FIRST_HOUR = 7;
const LAST_HOUR = 21;
const HOUR_PX = 56;

// ─── Days as ISO strings (no time zone involved) ────────────────────────────
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
const mondayOf = (day: string) => addDays(day, -weekday(day));
const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const fmt = (day: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...o, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
const minutesOf = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const hm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

function range(mode: Mode, anchor: string): { from: string; to: string; days: string[] } {
  if (mode === 'jour') return { from: anchor, to: anchor, days: [anchor] };
  if (mode === 'semaine' || mode === 'liste') {
    const from = mondayOf(anchor);
    return { from, to: addDays(from, 6), days: Array.from({ length: 7 }, (_, i) => addDays(from, i)) };
  }
  const first = monthStart(anchor);
  const from = mondayOf(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  return { from, to: days[41]!, days };
}

export function AgendaPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { timeZone, can, shell } = useShell();
  const today = useMemo(() => wallClock(new Date(), timeZone).date, [timeZone]);
  const mode = (MODES.includes(params.get('vue') as Mode) ? params.get('vue') : 'semaine') as Mode;
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date')! : today;
  const panelId = params.get('rdv');
  const [overlay, setOverlay] = useState<string[]>([]);
  const [data, setData] = useState<Agenda | null | 'failed'>(null);
  const [slot, setSlot] = useState<{ date: string; time: string; x: number; y: number } | null>(null);
  const [creating, setCreating] = useState<null | { kind: 'appointment' | 'task'; date?: string; time?: string }>(params.get('nouveau') === '1' ? { kind: 'appointment' } : null);
  const { from, to, days } = range(mode, anchor);
  useEffect(() => {
    if (params.get('nouveau') === '1') setCreating({ kind: 'appointment' });
  }, [params]);

  const setAddress = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) if (v === null) next.delete(k);
      else next.set(k, v);
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const load = useCallback(async () => {
    if (mode === 'liste') return;
    const r = await adminCall<Agenda>('/admin/agenda', { query: { from, to, ...(overlay.length ? { staff: [shell.user.id, ...overlay].join(',') } : {}) } });
    setData(r.ok ? r.data : r.aborted ? null : 'failed');
  }, [mode, from, to, overlay, shell.user.id]);
  useEffect(() => void load(), [load]);
  const changed = () => {
    void load();
    setListTick((n) => n + 1);
    signalShellChanged();
  };
  const [listTick, setListTick] = useState(0);

  const agenda = data && data !== 'failed' ? data : null;
  const colour = useMemo(() => {
    const ids = [shell.user.id, ...overlay];
    return (staffId: string | null | undefined) => (overlay.length && staffId ? `c${Math.max(0, ids.indexOf(staffId)) % 6}` : 'c0');
  }, [overlay, shell.user.id]);

  const step = (dir: -1 | 1) => setAddress({ date: mode === 'jour' ? addDays(anchor, dir) : mode === 'mois' ? monthStart(dir > 0 ? addDays(monthStart(anchor), 32) : addDays(monthStart(anchor), -1)) : addDays(anchor, dir * 7) });
  const title =
    mode === 'jour'
      ? fmt(anchor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : mode === 'mois'
        ? fmt(anchor, { month: 'long', year: 'numeric' })
        : t('ui.admin-agenda.weekOf', { debut: fmt(from, { day: 'numeric', month: 'short' }), fin: fmt(to, { day: 'numeric', month: 'short', year: 'numeric' }) });
  const manage = can('appointment.manage');
  const requests = agenda?.appointments.filter((a) => a.status === 'REQUESTED' && !a.startsAt) ?? [];

  return (
    <div className={s.page}>
      <PageHeader
        title={t('ui.admin-agenda.title')}
        crumbs={[{ label: t('ui.admin-shell.menu.group.organisation') }, { label: t('ui.admin-agenda.title') }]}
        intro={t('ui.admin-agenda.intro')}
        actions={
          manage ? (
            <Button variant="tool" size="M" onClick={() => setCreating({ kind: 'appointment' })}>
              <Icon name="plus" size={20} />
              {t('ui.admin-agenda.create')}
            </Button>
          ) : undefined
        }
      />
      <div className={s.surface}>
        <div className={s.toolbar}>
          <div className={s.nav}>
            <Button variant="secondary" size="S" onClick={() => setAddress({ date: null })} disabled={anchor === today}>
              {t('ui.admin-agenda.today')}
            </Button>
            {mode !== 'liste' ? (
              <>
                <button type="button" className={s.navArrow} onClick={() => step(-1)} aria-label={t('ui.admin-agenda.previous')}>
                  <Icon name="chevron-left" size={20} />
                </button>
                <button type="button" className={s.navArrow} onClick={() => step(1)} aria-label={t('ui.admin-agenda.next')}>
                  <Icon name="chevron-right" size={20} />
                </button>
                <h2 className={s.period}>{title}</h2>
              </>
            ) : null}
          </div>
          <div className={s.modes} role="tablist" aria-label={t('ui.admin-agenda.modes')}>
            {MODES.map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} className={[s.mode, mode === m && s.modeOn].filter(Boolean).join(' ')} onClick={() => setAddress({ vue: m === 'semaine' ? null : m })}>
                {t(`ui.admin-agenda.mode.${m}`)}
              </button>
            ))}
          </div>
        </div>
        {agenda?.canOverlay && mode !== 'liste' ? (
          <div className={s.overlay} role="group" aria-label={t('ui.admin-agenda.overlay')}>
            <span className={s.overlayLabel}>{t('ui.admin-agenda.overlay')}</span>
            <span className={`${s.person} ${s.c0}`}>
              <span className={s.dot} />
              {t('ui.admin-agenda.mine')}
            </span>
            {agenda.staff
              .filter((x) => !x.me)
              .map((x) => {
                const on = overlay.includes(x.id);
                return (
                  <button key={x.id} type="button" aria-pressed={on} className={[s.person, on && s.personOn, on && s[colour(x.id)]].filter(Boolean).join(' ')} onClick={() => setOverlay((cur) => (on ? cur.filter((y) => y !== x.id) : [...cur, x.id].slice(-5)))}>
                    <span className={s.dot} />
                    {staffLabel(x.name)}
                  </button>
                );
              })}
          </div>
        ) : null}

        {mode === 'liste' ? (
          <AppointmentListView tick={listTick} timeZone={timeZone} open={(id) => setAddress({ rdv: id })} />
        ) : data === null ? (
          <div className={s.loading}>
            <Skeleton height="2.5rem" />
            <Skeleton height="24rem" />
          </div>
        ) : data === 'failed' ? (
          <Banner tone="error" action={<Button variant="secondary" size="S" onClick={() => void load()}>{t('ui.common.retry')}</Button>}>{t('ui.common.error.block')}</Banner>
        ) : (
          <>
            {requests.length ? (
              <div className={s.requests}>
                <strong>
                  <Icon name="status-info" size={16} />
                  {t('ui.admin-agenda.requests', { n: requests.length })}
                </strong>
                {requests.map((a) => (
                  <button key={a.id} type="button" className={s.requestChip} onClick={() => setAddress({ rdv: a.id })}>
                    {enumLabel('AppointmentType', a.type)} · {a.client.name ?? '—'}
                  </button>
                ))}
              </div>
            ) : null}
            {mode === 'mois' ? (
              <MonthGrid days={days} anchor={anchor} today={today} agenda={data} colour={colour} open={(id) => setAddress({ rdv: id })} day={(d) => setAddress({ vue: 'jour', date: d })} />
            ) : (
              <TimeGrid
                days={days}
                today={today}
                agenda={data}
                colour={colour}
                panelId={panelId}
                open={(id) => setAddress({ rdv: id })}
                pick={manage ? (date, time, x, y) => setSlot({ date, time, x, y }) : undefined}
              />
            )}
          </>
        )}
      </div>

      {slot ? (
        <SlotMenu
          slot={slot}
          close={() => setSlot(null)}
          choose={(kind) => {
            setCreating({ kind, date: slot.date, time: slot.time });
            setSlot(null);
          }}
          canTask={can('task.manage')}
        />
      ) : null}
      <AppointmentPanel id={panelId} close={() => setAddress({ rdv: null })} changed={changed} />
      <AppointmentDialog
        open={creating?.kind === 'appointment'}
        presetDate={creating?.date}
        presetTime={creating?.time}
        onClose={() => (setCreating(null), setAddress({ nouveau: null }))}
        onDone={() => (setCreating(null), setAddress({ nouveau: null }), changed())}
      />
      <TaskDialog open={creating?.kind === 'task'} presetDate={creating?.date} presetTime={creating?.time} onClose={() => setCreating(null)} onDone={() => (setCreating(null), changed())} />
    </div>
  );
}

// ─── Day and week: a time grid ──────────────────────────────────────────────

interface Placed {
  a: AppointmentItem;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

function place(items: { a: AppointmentItem; start: number; end: number }[]): Placed[] {
  const sorted = [...items].sort((x, y) => x.start - y.start || y.end - x.end);
  const out: Placed[] = [];
  let cluster: { a: AppointmentItem; start: number; end: number; lane: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) out.push({ a: c.a, top: c.start, height: Math.max(c.end - c.start, 20), lane: c.lane, lanes });
    cluster = [];
  };
  for (const it of sorted) {
    if (it.start >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.end > it.start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...it, lane });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return out;
}

function TimeGrid({ days, today, agenda, colour, panelId, open, pick }: { days: string[]; today: string; agenda: Agenda; colour: (id: string | null | undefined) => string; panelId: string | null; open: (id: string) => void; pick?: (date: string, time: string, x: number, y: number) => void }) {
  const tz = agenda.timeZone;
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => wallClock(new Date(), tz));
  useEffect(() => {
    const timer = setInterval(() => setNow(wallClock(new Date(), tz)), 60_000);
    return () => clearInterval(timer);
  }, [tz]);
  useEffect(() => {
    // Open the grid around the working morning, not at 7:00 when the day starts later.
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (minutesOf(now.time) / 60 - FIRST_HOUR - 2) * HOUR_PX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const byDay = useMemo(() => {
    const map = new Map<string, { timed: { a: AppointmentItem; start: number; end: number }[]; tasks: { task: AgendaTask; minute: number | null }[]; cafes: Agenda['cafes'] }>();
    for (const d of days) map.set(d, { timed: [], tasks: [], cafes: [] });
    for (const a of agenda.appointments) {
      if (!a.startsAt) continue;
      const st = wallClock(new Date(a.startsAt), tz);
      const en = a.endsAt ? wallClock(new Date(a.endsAt), tz) : null;
      const bucket = map.get(st.date);
      if (!bucket) continue;
      const start = minutesOf(st.time);
      const end = en && en.date === st.date ? minutesOf(en.time) : Math.min(24 * 60, start + 30);
      bucket.timed.push({ a, start, end });
    }
    for (const task of agenda.tasks) {
      const w = wallClock(new Date(task.dueAt), tz);
      map.get(w.date)?.tasks.push({ task, minute: task.dueHasTime ? minutesOf(w.time) : null });
    }
    for (const c of agenda.cafes) map.get(wallClock(new Date(c.startsAt), tz).date)?.cafes.push(c);
    return map;
  }, [agenda, days, tz]);
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);
  const toPx = (minute: number) => ((Math.min(Math.max(minute, FIRST_HOUR * 60), LAST_HOUR * 60) - FIRST_HOUR * 60) / 60) * HOUR_PX;
  const cols = { gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <div className={s.grid}>
      <div className={s.gridHead} style={cols}>
        <span />
        {days.map((d) => (
          <div key={d} className={[s.dayHead, d === today && s.dayToday, weekday(d) >= 5 && s.dayWeekend].filter(Boolean).join(' ')}>
            <span className={s.dayName}>{fmt(d, { weekday: 'short' })}</span>
            <span className={s.dayNum}>{fmt(d, { day: 'numeric' })}</span>
          </div>
        ))}
      </div>
      <div className={s.allDay} style={cols}>
        <span className={s.allDayLabel}>{t('ui.admin-agenda.allDay')}</span>
        {days.map((d) => {
          const b = byDay.get(d)!;
          const untimed = b.tasks.filter((x) => x.minute === null);
          return (
            <div key={d} className={s.allDayCell}>
              {b.cafes.map((c) => (
                <span key={c.id} className={`${s.cafe} ${s[colour(c.staffId)]}`} title={c.title}>
                  <Icon name="cafe-cup" size={16} />
                  {c.title}
                </span>
              ))}
              {untimed.slice(0, 3).map(({ task }) => (
                <TaskChip key={task.id} task={task} colourClass={s[colour(task.staffId)]!} />
              ))}
              {untimed.length > 3 ? <span className={s.moreTasks}>{t('ui.admin-agenda.moreTasks', { n: untimed.length - 3 })}</span> : null}
            </div>
          );
        })}
      </div>
      <div className={s.scroller} ref={scroller}>
        <div className={s.body} style={{ ...cols, height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }}>
          <div className={s.hours}>
            {hours.map((h) => (
              <span key={h} className={s.hour} style={{ top: (h - FIRST_HOUR) * HOUR_PX }}>
                {String(h).padStart(2, '0')} h
              </span>
            ))}
          </div>
          {days.map((d) => {
            const b = byDay.get(d)!;
            return (
              <div
                key={d}
                className={[s.column, weekday(d) >= 5 && s.columnWeekend].filter(Boolean).join(' ')}
                onClick={(e) => {
                  if (!pick || e.target !== e.currentTarget) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const minute = FIRST_HOUR * 60 + Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30;
                  pick(d, hm(Math.min(minute, LAST_HOUR * 60 - 30)), e.clientX, e.clientY);
                }}
                aria-label={fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}
              >
                {hours.map((h) => (
                  <span key={h} className={s.line} style={{ top: (h - FIRST_HOUR) * HOUR_PX }} aria-hidden="true" />
                ))}
                {d === now.date && minutesOf(now.time) >= FIRST_HOUR * 60 && minutesOf(now.time) < LAST_HOUR * 60 ? <span className={s.now} style={{ top: toPx(minutesOf(now.time)) }} aria-hidden="true" /> : null}
                {place(b.timed).map(({ a, top, height, lane, lanes }) => {
                  const y = toPx(top);
                  const h = Math.max(toPx(top + height) - y, 26);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={[s.event, h < 40 && s.eventShort, s[`st${a.status}`], s[colour(a.staff?.id)], a.id === panelId && s.eventOn].filter(Boolean).join(' ')}
                      style={{ top: y, height: h, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}
                      onClick={() => open(a.id)}
                      title={`${enumLabel('AppointmentType', a.type)} · ${a.client.name ?? ''}`}
                    >
                      <span className={s.eventTime}>
                        {wallClock(new Date(a.startsAt!), tz).time.replace(':', ' h ')}
                        {h >= 40 ? ` · ${enumLabel('AppointmentType', a.type)}` : ''}
                      </span>
                      <span className={s.eventWho}>{a.client.name ?? '—'}</span>
                      {h > 44 && a.property ? <span className={s.eventMore}>{a.property.title}</span> : null}
                    </button>
                  );
                })}
                {b.tasks
                  .filter((x) => x.minute !== null)
                  .map(({ task, minute }) => (
                    <span key={task.id} className={[s.taskMark, s[colour(task.staffId)], task.status === 'DONE' && s.taskDone].filter(Boolean).join(' ')} style={{ top: toPx(minute!) }} title={task.title}>
                      <Icon name={task.status === 'DONE' ? 'check' : 'clock'} size={16} />
                      <a href={`/taches?view=team&tache=${task.id}`} onClick={(e) => e.stopPropagation()}>
                        {task.title}
                      </a>
                    </span>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TaskChip({ task, colourClass }: { task: AgendaTask; colourClass: string }) {
  return (
    <a href={`/taches?view=team&tache=${task.id}`} className={[s.taskChip, colourClass, task.status === 'DONE' && s.taskDone].filter(Boolean).join(' ')} title={task.title}>
      <Icon name={task.status === 'DONE' ? 'check' : 'clock'} size={16} />
      {task.title}
    </a>
  );
}

// ─── Month ──────────────────────────────────────────────────────────────────

function MonthGrid({ days, anchor, today, agenda, colour, open, day }: { days: string[]; anchor: string; today: string; agenda: Agenda; colour: (id: string | null | undefined) => string; open: (id: string) => void; day: (d: string) => void }) {
  const tz = agenda.timeZone;
  const items = useMemo(() => {
    const map = new Map<string, { key: string; label: string; cls: string; onClick?: () => void; href?: string }[]>();
    for (const a of agenda.appointments) {
      if (!a.startsAt) continue;
      const w = wallClock(new Date(a.startsAt), tz);
      const list = map.get(w.date) ?? [];
      list.push({ key: a.id, label: `${w.time.replace(':', ' h ')} ${a.client.name ?? ''}`, cls: [s.monthEvent, s[`st${a.status}`], s[colour(a.staff?.id)]].filter(Boolean).join(' '), onClick: () => open(a.id) });
      map.set(w.date, list);
    }
    for (const task of agenda.tasks) {
      const w = wallClock(new Date(task.dueAt), tz);
      const list = map.get(w.date) ?? [];
      list.push({ key: task.id, label: task.title, cls: [s.monthTask, s[colour(task.staffId)], task.status === 'DONE' && s.taskDone].filter(Boolean).join(' '), href: `/taches?view=team&tache=${task.id}` });
      map.set(w.date, list);
    }
    return map;
  }, [agenda, tz, colour, open]);
  const month = anchor.slice(0, 7);
  return (
    <div className={s.month}>
      {days.slice(0, 7).map((d) => (
        <span key={d} className={s.monthHead}>
          {fmt(d, { weekday: 'short' })}
        </span>
      ))}
      {days.map((d) => {
        const list = items.get(d) ?? [];
        return (
          <div key={d} className={[s.monthCell, d.slice(0, 7) !== month && s.monthOut, d === today && s.monthToday].filter(Boolean).join(' ')}>
            <button type="button" className={s.monthNum} onClick={() => day(d)} aria-label={fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}>
              {fmt(d, { day: 'numeric' })}
            </button>
            {list.slice(0, 3).map((x) =>
              x.href ? (
                <a key={x.key} href={x.href} className={x.cls}>
                  {x.label}
                </a>
              ) : (
                <button key={x.key} type="button" className={x.cls} onClick={x.onClick}>
                  {x.label}
                </button>
              ),
            )}
            {list.length > 3 ? (
              <button type="button" className={s.moreTasks} onClick={() => day(d)}>
                {t('ui.admin-agenda.moreItems', { n: list.length - 3 })}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ─── List (TAC-046) ─────────────────────────────────────────────────────────

function AppointmentListView({ tick, timeZone, open }: { tick: number; timeZone: string; open: (id: string) => void }) {
  const [view, setView] = useState<AppointmentView>('upcoming');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AppointmentList | null | 'failed'>(null);
  useEffect(() => {
    void adminCall<AppointmentList>('/admin/appointments', { query: { view, page, pageSize: 25 } }).then((r) => setData(r.ok ? r.data : 'failed'));
  }, [view, page, tick]);
  const list = data && data !== 'failed' ? data : null;
  return (
    <div className={s.listView}>
      <div className={s.listTabs} role="tablist" aria-label={t('ui.admin-agenda.listViews')}>
        {APPOINTMENT_VIEWS.map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={[s.listTab, view === v && s.listTabOn].filter(Boolean).join(' ')} onClick={() => (setView(v), setPage(1))}>
            {t(`ui.admin-agenda.view.${v}`)}
            {list ? <span className={s.count}>{list.views[v]}</span> : null}
          </button>
        ))}
      </div>
      {data === null ? (
        <div className={s.loading}>
          <Skeleton height="3rem" />
          <Skeleton height="3rem" />
        </div>
      ) : data === 'failed' ? (
        <Banner tone="error">{t('ui.common.error.block')}</Banner>
      ) : !data.data.length ? (
        <EmptyState icon="calendar" title={t(`ui.admin-agenda.empty.${view}`)} />
      ) : (
        <ul className={s.listRows}>
          {data.data.map((a) => {
            const at = a.startsAt ? new Date(a.startsAt) : null;
            return (
              <li key={a.id}>
                <button type="button" className={s.listRow} onClick={() => open(a.id)}>
                  <span className={s.listWhen}>
                    {at ? (
                      <>
                        <strong>{new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(at)}</strong>
                        <span>{new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(at).replace(':', ' h ')}</span>
                      </>
                    ) : (
                      <strong>{t('ui.admin-agenda.noSlotYet')}</strong>
                    )}
                  </span>
                  <span className={s.listMain}>
                    <strong>{a.client.name ?? '—'}</strong>
                    <span className={s.listSub}>{[enumLabel('AppointmentType', a.type), a.property?.title, a.dossier?.reference].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={s.listWho}>{a.staff ? staffLabel(a.staff.name) : '—'}</span>
                  <StatusTag tone={STATUS_TONE[a.status] ?? 'neutral'}>{enumLabel('AppointmentStatus', a.status)}</StatusTag>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {list && list.meta.totalPages > 1 ? (
        <div className={s.pager}>
          <Button variant="secondary" size="S" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('ui.admin-tasks.previous')}
          </Button>
          <span>{t('ui.admin-tasks.page', { page, total: list.meta.totalPages, n: list.meta.total })}</span>
          <Button variant="secondary" size="S" disabled={page >= list.meta.totalPages} onClick={() => setPage(page + 1)}>
            {t('ui.admin-tasks.next')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ─── The small menu of an empty slot ────────────────────────────────────────

function SlotMenu({ slot, close, choose, canTask }: { slot: { date: string; time: string; x: number; y: number }; close: () => void; choose: (k: 'appointment' | 'task') => void; canTask: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, close, [ref]);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  const left = Math.min(slot.x, (typeof window !== 'undefined' ? window.innerWidth : 1440) - 240);
  return (
    <div ref={ref} className={s.slotMenu} style={{ left, top: slot.y + 4 }} role="menu" aria-label={t('ui.admin-agenda.slotMenu', { heure: slot.time.replace(':', ' h ') })}>
      <p className={s.slotTitle}>
        {fmt(slot.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {slot.time.replace(':', ' h ')}
      </p>
      <button ref={first} type="button" role="menuitem" className={s.slotItem} onClick={() => choose('appointment')}>
        <Icon name="calendar" size={16} />
        {t('ui.admin-agenda.slot.appointment')}
      </button>
      {canTask ? (
        <button type="button" role="menuitem" className={s.slotItem} onClick={() => choose('task')}>
          <Icon name="check" size={16} />
          {t('ui.admin-agenda.slot.task')}
        </button>
      ) : null}
    </div>
  );
}
