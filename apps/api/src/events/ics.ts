// CAF-050 — calendar file (RFC 5545) of a Café registration: title « {marque} – {lieu} », start and end in the venue's
// time zone (TZID + a VTIMEZONE computed from the time-zone database for the years around the Café), exact place,
// description with the « Gérer mon inscription » link, a UID stable per registration (a change of date REPLACES the
// entry — SEQUENCE grows with the Café's version), and an alarm the day before. Pure.

export interface IcsInput {
  /** Stable per registration: `{registrationId}@{domain}`. */
  uid: string;
  /** Grows when the Café changes (its `version`): calendars replace the entry. */
  sequence: number;
  stamp: Date;
  start: Date;
  end: Date;
  timeZone: string;
  summary: string;
  location: string | null;
  description: string;
  url: string | null;
  alarmText: string;
  cancelled?: boolean;
}

/** TEXT escaping (RFC 5545 § 3.3.11). */
export function icsText(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Lines longer than 75 octets are folded (CRLF + space), never inside a UTF-8 character (§ 3.1). */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch, 'utf8');
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with one space
    if (bytes + n > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function parts(d: Date, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, mi: Number(p.minute), s: Number(p.second) };
}

/** Offset of the zone at an instant, in minutes east of UTC. */
export function offsetMinutes(timeZone: string, d: Date): number {
  const p = parts(d, timeZone);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60_000);
}

/** `20261017T100000` — the wall-clock time of the instant in the zone. */
export function localStamp(d: Date, timeZone: string): string {
  const p = parts(d, timeZone);
  return `${p.y}${pad(p.mo)}${pad(p.d)}T${pad(p.h)}${pad(p.mi)}${pad(p.s)}`;
}

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const fmtOffset = (m: number) => `${m < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(m) / 60))}${pad(Math.abs(m) % 60)}`;

/** Offset changes between `from` and `to`: the first minute of each new offset. */
export function transitions(timeZone: string, from: Date, to: Date): { at: Date; before: number; after: number }[] {
  const out: { at: Date; before: number; after: number }[] = [];
  const DAY = 86_400_000;
  for (let t = from.getTime(); t < to.getTime(); t += DAY) {
    const a = offsetMinutes(timeZone, new Date(t));
    const b = offsetMinutes(timeZone, new Date(t + DAY));
    if (a === b) continue;
    let lo = t;
    let hi = t + DAY;
    while (hi - lo > 60_000) {
      const mid = lo + Math.floor((hi - lo) / 120_000) * 60_000;
      if (offsetMinutes(timeZone, new Date(mid)) === a) lo = mid;
      else hi = mid;
    }
    out.push({ at: new Date(hi), before: a, after: b });
  }
  return out;
}

/** VTIMEZONE for the zone, valid from the year before the Café to its end (observances without rules). */
export function vtimezone(timeZone: string, start: Date, end: Date): string[] {
  const y = new Date(start).getUTCFullYear();
  const from = new Date(Date.UTC(y - 1, 0, 1));
  const until = new Date(Math.max(Date.UTC(y + 1, 0, 1), end.getTime() + 86_400_000));
  const list = transitions(timeZone, from, until);
  const lines = ['BEGIN:VTIMEZONE', `TZID:${timeZone}`];
  if (list.length === 0) {
    const off = fmtOffset(offsetMinutes(timeZone, start));
    lines.push('BEGIN:STANDARD', 'DTSTART:19700101T000000', `TZOFFSETFROM:${off}`, `TZOFFSETTO:${off}`, 'END:STANDARD');
  } else {
    const high = Math.max(...list.map((x) => Math.max(x.before, x.after)));
    for (const tr of list) {
      const kind = tr.after === high && tr.after > tr.before ? 'DAYLIGHT' : 'STANDARD';
      // The onset is written in the local time that was in force just before the change (§ 3.6.5).
      const onset = new Date(tr.at.getTime() + tr.before * 60_000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
      lines.push(`BEGIN:${kind}`, `DTSTART:${onset}`, `TZOFFSETFROM:${fmtOffset(tr.before)}`, `TZOFFSETTO:${fmtOffset(tr.after)}`, `END:${kind}`);
    }
  }
  lines.push('END:VTIMEZONE');
  return lines;
}

export function buildIcs(i: IcsInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Diaspora Patrimoine//Le Cafe//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vtimezone(i.timeZone, i.start, i.end),
    'BEGIN:VEVENT',
    `UID:${i.uid}`,
    `SEQUENCE:${i.sequence}`,
    `DTSTAMP:${utcStamp(i.stamp)}`,
    `DTSTART;TZID=${i.timeZone}:${localStamp(i.start, i.timeZone)}`,
    `DTEND;TZID=${i.timeZone}:${localStamp(i.end, i.timeZone)}`,
    `SUMMARY:${icsText(i.summary)}`,
    ...(i.location ? [`LOCATION:${icsText(i.location)}`] : []),
    `DESCRIPTION:${icsText(i.description)}`,
    ...(i.url ? [`URL:${i.url}`] : []),
    `STATUS:${i.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-P1D',
    `DESCRIPTION:${icsText(i.alarmText)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
