import { describe, expect, it } from 'vitest';
import { cafeRegistrationSchema, cafeRegistrationUpdateSchema, LeadConsentWording, leadSubmitSchema } from '@dp/contracts';
import { toEml } from '../src/communication/mail-provider.js';
import { renderTemplate } from '../src/communication/template-renderer.js';
import { buildIcs, foldLine, offsetMinutes } from '../src/events/ics.js';
import { registrationTemplateFor } from '../src/events/registration-mail.handler.js';
import {
  ACCESS_CODE_ALPHABET,
  anonymousAlreadyRegistered,
  autoPromotionAllowed,
  cafeDateLabel,
  cafeTimeLabel,
  checkInUrl,
  generateAccessCode,
  manageToken,
  pickPromotions,
  registrationDecision,
  registrationRefusal,
  seatChange,
  tokenHash,
  TOKEN_RE,
  uniqueAccessCode,
} from '../src/events/registration-rules.js';
import { CAFE_TEMPLATE_SEEDS, typography } from '../src/install/email-templates.js';

const now = new Date('2026-10-09T10:00:00Z');

describe('access code', () => {
  it('CAF-051 six characters, capitals and digits, never 0 O 1 I L', () => {
    expect(ACCESS_CODE_ALPHABET).not.toMatch(/[01OIL]/);
    expect(ACCESS_CODE_ALPHABET).toMatch(/^[A-Z2-9]+$/);
    for (let i = 0; i < 2000; i++) {
      const code = generateAccessCode();
      expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    }
  });
  it('CAF-051 unique per Café: a taken code is drawn again', async () => {
    const taken = new Set(['AAAAAA', 'BBBBBB']);
    const draws = ['AAAAAA', 'BBBBBB', 'CCCCCC'];
    const code = await uniqueAccessCode(async (c) => taken.has(c), () => draws.shift()!);
    expect(code).toBe('CCCCCC');
  });
  it('CAF-051 a code space that never frees up fails instead of looping', async () => {
    await expect(uniqueAccessCode(async () => true, () => 'AAAAAA')).rejects.toThrow();
  });
  it('CAF-051 the QR code holds the back-office check-in address with the code (and the Café, codes being unique per Café)', () => {
    expect(checkInUrl('https://admin.example.fr', 'CAF-2026-0007', 'K7P3QX')).toBe('https://admin.example.fr/back-office/cafes/pointage?cafe=CAF-2026-0007&code=K7P3QX');
  });
});

describe('manage token', () => {
  it('CAF-030 derived from the registration with the signing key, stored only as its SHA-256', () => {
    const a = manageToken('key-1', 'reg-1');
    expect(a).toBe(manageToken('key-1', 'reg-1'));
    expect(a).not.toBe(manageToken('key-1', 'reg-2'));
    expect(a).not.toBe(manageToken('key-2', 'reg-1'));
    expect(a).toMatch(TOKEN_RE);
    expect(tokenHash(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(TOKEN_RE.test('../etc')).toBe(false);
    expect(a).toBe(a.toLowerCase()); // NAV-002: addresses are lower case
  });
});

describe('seat decisions', () => {
  it('CAF-022 enough seats → REGISTERED', () => {
    expect(registrationDecision(5, 2, false)).toEqual({ ok: true, status: 'REGISTERED' });
    expect(registrationDecision(2, 2, false)).toEqual({ ok: true, status: 'REGISTERED' });
  });
  it('CAF-022 not enough seats, no waiting list asked → refused with the seats left; none left → EVENT_FULL', () => {
    expect(registrationDecision(1, 3, false)).toEqual({ ok: false, reason: 'NOT_ENOUGH_SEATS', n: 1 });
    expect(registrationDecision(0, 1, false)).toEqual({ ok: false, reason: 'EVENT_FULL' });
  });
  it('CAF-022 WAITLISTED only when the visitor asked for it', () => {
    expect(registrationDecision(1, 3, true)).toEqual({ ok: true, status: 'WAITLISTED' });
    expect(registrationDecision(0, 1, true)).toEqual({ ok: true, status: 'WAITLISTED' });
    expect(registrationDecision(4, 3, true)).toEqual({ ok: true, status: 'REGISTERED' });
  });
  it('CAF-025 cancelled, closed, started or not yet open → refused with the matching reason', () => {
    const base = { status: 'PUBLISHED', startsAt: new Date('2026-10-17T08:00:00Z'), registrationOpensAt: null, registrationClosesAt: new Date('2026-10-16T08:00:00Z'), capacity: 30, seatsTaken: 0 };
    expect(registrationRefusal(base, now)).toBeNull();
    expect(registrationRefusal({ ...base, status: 'CANCELLED' }, now)).toBe('EVENT_CANCELLED');
    expect(registrationRefusal({ ...base, status: 'CLOSED' }, now)).toBe('REGISTRATION_CLOSED');
    expect(registrationRefusal({ ...base, registrationClosesAt: new Date('2026-10-09T09:00:00Z') }, now)).toBe('REGISTRATION_CLOSED');
    expect(registrationRefusal({ ...base, startsAt: new Date('2026-10-09T09:00:00Z') }, now)).toBe('REGISTRATION_CLOSED');
    expect(registrationRefusal({ ...base, registrationOpensAt: new Date('2026-10-10T08:00:00Z') }, now)).toBe('EVENT_NOT_OPEN');
  });
  it('CYC-187 a REGISTERED one goes down always', () => {
    expect(seatChange({ status: 'REGISTERED', current: 3, requested: 1, left: 0, maxPerRegistration: 4 })).toEqual({ ok: true, seatsTakenDelta: -2, waitlistDelta: 0, freed: true });
  });
  it('CYC-187 up within the free seats, else « Il ne reste que {n} places. » (n = free seats)', () => {
    expect(seatChange({ status: 'REGISTERED', current: 1, requested: 3, left: 2, maxPerRegistration: 4 })).toEqual({ ok: true, seatsTakenDelta: 2, waitlistDelta: 0, freed: false });
    expect(seatChange({ status: 'REGISTERED', current: 1, requested: 4, left: 2, maxPerRegistration: 4 })).toEqual({ ok: false, reason: 'NOT_ENOUGH_SEATS', n: 2 });
  });
  it('CYC-187 never above Event.maxSeatsPerRegistration', () => {
    expect(seatChange({ status: 'REGISTERED', current: 1, requested: 5, left: 20, maxPerRegistration: 4 })).toEqual({ ok: false, reason: 'OUT_OF_RANGE', max: 4 });
  });
  it('CAF-032 a WAITLISTED one changes its seats freely; only the waiting-list cache moves', () => {
    expect(seatChange({ status: 'WAITLISTED', current: 2, requested: 4, left: 0, maxPerRegistration: 4 })).toEqual({ ok: true, seatsTakenDelta: 0, waitlistDelta: 2, freed: false });
    expect(seatChange({ status: 'WAITLISTED', current: 3, requested: 1, left: 0, maxPerRegistration: 4 })).toEqual({ ok: true, seatsTakenDelta: 0, waitlistDelta: -2, freed: true });
  });
});

describe('waiting list', () => {
  it('CYC-185 served in arrival order, never split: a 3-seat registration is skipped for the next that fits', () => {
    const waiting = [
      { id: 'a', seats: 3 },
      { id: 'b', seats: 1 },
      { id: 'c', seats: 2 },
      { id: 'd', seats: 1 },
    ];
    expect(pickPromotions(waiting, 2)).toEqual(['b', 'd']);
    expect(pickPromotions(waiting, 3)).toEqual(['a']);
    expect(pickPromotions(waiting, 0)).toEqual([]);
    expect(pickPromotions(waiting, 10)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('CYC-185 no automatic promotion in the 12 hours before the start, nor for a cancelled Café', () => {
    const startsAt = new Date(now.getTime() + 13 * 3_600_000);
    expect(autoPromotionAllowed({ status: 'PUBLISHED', startsAt }, now)).toBe(true);
    expect(autoPromotionAllowed({ status: 'CLOSED', startsAt }, now)).toBe(true);
    expect(autoPromotionAllowed({ status: 'PUBLISHED', startsAt: new Date(now.getTime() + 11 * 3_600_000) }, now)).toBe(false);
    expect(autoPromotionAllowed({ status: 'CANCELLED', startsAt }, now)).toBe(false);
  });
});

describe('already registered', () => {
  it('CAF-024 anonymous: outcome SENT, the echo of the input, no code, venue, link nor calendar (TRV-112)', () => {
    const r = anonymousAlreadyRegistered({ firstName: 'Karima', seats: 2 }, 'REGISTERED', {
      startsAt: new Date('2026-10-17T08:00:00Z'),
      endsAt: new Date('2026-10-17T10:00:00Z'),
      timezone: 'Europe/Paris',
    });
    expect(r).toEqual({
      status: 'REGISTERED',
      outcome: 'SENT',
      firstName: 'Karima',
      seats: 2,
      accessCode: null,
      manageUrl: null,
      icsUrl: null,
      venue: null,
      startsAt: '2026-10-17T08:00:00.000Z',
      endsAt: '2026-10-17T10:00:00.000Z',
      timezone: 'Europe/Paris',
    });
  });
  it('CAF-024 the resent confirmation follows the CURRENT status of the existing registration', () => {
    expect(registrationTemplateFor('registration.confirmation_requested', 'REGISTERED')).toBe('C_CAFE_REGISTERED');
    expect(registrationTemplateFor('registration.confirmation_requested', 'WAITLISTED')).toBe('C_CAFE_WAITLISTED');
    expect(registrationTemplateFor('registration.confirmation_requested', 'CANCELLED')).toBeNull();
    expect(registrationTemplateFor('registration.created', 'CANCELLED')).toBeNull(); // FIA-042: read again
    expect(registrationTemplateFor('registration.promoted', 'REGISTERED')).toBe('C_CAFE_PROMOTED');
  });
});

describe('calendar file', () => {
  const input = {
    uid: '0192f0a0-0000-7000-8000-000000000001@diaspora-patrimoine.fr',
    sequence: 3,
    stamp: now,
    start: new Date('2026-10-17T08:00:00Z'), // 10 h in Paris (CEST)
    end: new Date('2026-10-17T10:30:00Z'),
    timeZone: 'Europe/Paris',
    summary: 'Le Café Diaspora Patrimoine – Paris',
    location: 'Café de la Paix, 5 place de l’Opéra, 75009 Paris',
    description: 'Votre code d’accueil : K7P3QX\nGérer mon inscription : https://diaspora-patrimoine.fr/le-cafe/inscription/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
    url: 'https://diaspora-patrimoine.fr/le-cafe/inscription/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
    alarmText: 'Demain : Le Café Diaspora Patrimoine – Paris',
  };
  const ics = buildIcs(input);
  const unfolded = ics.replace(/\r\n /g, '');

  it('CAF-050 UID stable per registration: the same registration always gives the same UID', () => {
    expect(unfolded).toContain(`UID:${input.uid}\r\n`);
    expect(buildIcs({ ...input, stamp: new Date('2026-11-01T00:00:00Z'), start: new Date('2026-10-24T08:00:00Z'), end: new Date('2026-10-24T10:00:00Z'), sequence: 4 })).toContain(`UID:${input.uid}`);
    expect(unfolded).toContain('SEQUENCE:3');
  });
  it('CAF-050 start and end with the time zone of the venue (TZID + VTIMEZONE)', () => {
    expect(unfolded).toContain('DTSTART;TZID=Europe/Paris:20261017T100000');
    expect(unfolded).toContain('DTEND;TZID=Europe/Paris:20261017T123000');
    expect(unfolded).toContain('BEGIN:VTIMEZONE\r\nTZID:Europe/Paris');
    // 25 October 2026, 03:00 CEST → 02:00 CET; 29 March 2026, 02:00 CET → 03:00 CEST.
    expect(unfolded).toContain('BEGIN:STANDARD\r\nDTSTART:20261025T030000\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100');
    expect(unfolded).toContain('BEGIN:DAYLIGHT\r\nDTSTART:20260329T020000\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200');
  });
  it('CAF-050 exact place, title, manage link in the description, alarm the day before', () => {
    expect(unfolded).toContain('SUMMARY:Le Café Diaspora Patrimoine – Paris');
    expect(unfolded).toContain('LOCATION:Café de la Paix\\, 5 place de l’Opéra\\, 75009 Paris');
    expect(unfolded).toContain('DESCRIPTION:Votre code d’accueil : K7P3QX\\nGérer mon inscription : https://');
    expect(unfolded).toMatch(/BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-P1D\r\n/);
  });
  it('CAF-050 RFC 5545 lines: CRLF, at most 75 octets, folded without cutting a character', () => {
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    const folded = foldLine(`DESCRIPTION:${'é'.repeat(60)}`);
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'é'.repeat(60)}`);
  });
  it('CAF-050 a zone without daylight saving gets one STANDARD observance', () => {
    const algiers = buildIcs({ ...input, timeZone: 'Africa/Algiers' });
    expect(algiers).toContain('DTSTART;TZID=Africa/Algiers:20261017T090000');
    expect(algiers).toContain('BEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0100');
    expect(offsetMinutes('America/Toronto', new Date('2026-01-15T12:00:00Z'))).toBe(-300);
  });
});

describe('labels and contract', () => {
  it('NOT-051 dates and hours in the venue time zone (CAF-011)', () => {
    expect(cafeDateLabel(new Date('2026-10-17T08:00:00Z'), 'Europe/Paris')).toBe('samedi 17 octobre');
    expect(cafeDateLabel(new Date('2026-11-01T08:00:00Z'), 'Europe/Paris')).toBe('dimanche 1er novembre');
    expect(cafeTimeLabel(new Date('2026-10-17T08:00:00Z'), new Date('2026-10-17T10:30:00Z'), 'Europe/Paris')).toBe('de 10 h à 12 h 30');
  });
  it('CAF-020 the form body of the site is accepted; consent required; topics de-duplicated', () => {
    const body = {
      firstName: ' Karima ',
      lastName: 'Benali',
      email: 'Karima@Example.fr',
      phone: '+33 6 12 34 56 78',
      whatsappOptIn: true,
      seats: 2,
      topics: ['PROGRAMS', 'FINANCING', 'PROGRAMS'],
      questions: '  Quel apport ?  ',
      consentContact: true,
      consentKey: 'cafe.contact.v1',
      marketingOptIn: false,
      marketingKey: 'lead.marketing.v1',
      waitlist: false,
      homepageUrl: '',
    };
    const parsed = cafeRegistrationSchema.parse(body);
    expect(parsed).toMatchObject({ firstName: 'Karima', email: 'karima@example.fr', phone: '+33612345678', topics: ['PROGRAMS', 'FINANCING'], questions: 'Quel apport ?' });
    expect(cafeRegistrationSchema.safeParse({ ...body, consentContact: false }).success).toBe(false);
    expect(cafeRegistrationSchema.safeParse({ ...body, topics: ['GOLF'] }).success).toBe(false);
    expect(cafeRegistrationSchema.safeParse({ ...body, questions: 'x'.repeat(1001) }).success).toBe(false);
    expect(cafeRegistrationSchema.safeParse({ ...body, consentKey: 'lead.contact.v1' }).success).toBe(false);
    expect(cafeRegistrationUpdateSchema.safeParse({}).success).toBe(false);
    expect(cafeRegistrationUpdateSchema.parse({ questions: '' })).toEqual({ questions: null });
  });
  it('MOD-106 the Café consent sentence is a proof wording of its own; request forms cannot send it', () => {
    expect(LeadConsentWording['cafe.contact.v1'].text).toBe(
      'J’accepte que Diaspora Patrimoine m’envoie les informations pratiques de ce Café et me recontacte au sujet de mon projet. [Politique de confidentialité]',
    );
    const lead = leadSubmitSchema.safeParse({
      form: 'CONTACT_MESSAGE',
      fields: { firstName: 'A', lastName: 'B', email: 'a@b.fr', subject: 'OTHER', message: 'Bonjour', consentContact: true, consentKey: 'cafe.contact.v1' },
      context: {},
      tracking: { locale: 'fr' },
    });
    expect(lead.success).toBe(false);
  });
});

describe('Café e-mails', () => {
  const vars = {
    client: { firstName: 'Karima' },
    advisor: { firstName: 'Amel', displayName: 'Amel K.' },
    company: { name: 'Diaspora Patrimoine' },
    cafe: {
      brandName: 'Le Café Diaspora Patrimoine',
      title: 'Le Café – Paris',
      capacity: 30,
      locationLabel: 'Paris',
      dateLabel: 'samedi 17 octobre',
      timeLabel: 'de 10 h à 12 h',
      venueName: null,
      venueAddress: '5 place de l’Opéra, 75009 Paris',
      venueNotes: null,
      url: 'https://x.fr/le-cafe/paris',
      changes: 'nouvelle heure',
      cancelReason: 'Intempéries.',
    },
    registration: { seats: 2, checkInCode: 'K7P3QX', manageUrl: 'https://x.fr/le-cafe/inscription/t' },
    nextCafe: null,
    survey: { url: 'https://x.fr/enquete/t' },
  };
  it('NOT-012 every Café template renders without a missing field when the optional venue fields are empty', () => {
    for (const seed of CAFE_TEMPLATE_SEEDS) {
      const r = renderTemplate({ subject: typography(seed.subject), preheader: null, body: typography(seed.body) }, vars, { siteUrl: 'https://x.fr' });
      expect(r.missing, seed.code).toEqual([]);
    }
  });
  it('CAF-021 C_CAFE_REGISTERED cites the code, the venue and the manage button', () => {
    const seed = CAFE_TEMPLATE_SEEDS.find((s) => s.code === 'C_CAFE_REGISTERED')!;
    const r = renderTemplate({ subject: typography(seed.subject), preheader: null, body: typography(seed.body) }, vars, { siteUrl: 'https://x.fr' });
    expect(r.text).toContain('K7P3QX');
    expect(r.text).toContain('5 place de l’Opéra');
    expect(r.html).toContain('https://x.fr/le-cafe/inscription/t');
  });
  it('CAF-050 the calendar file and the QR code travel as attachments (multipart/mixed)', () => {
    const eml = toEml(
      {
        from: { name: 'DP', address: 'no-reply@x.fr' },
        to: 'a@b.fr',
        subject: 'Sujet',
        html: '<p>x</p>',
        text: 'x',
        templateCode: 'C_CAFE_REGISTERED',
        attachments: [
          { filename: 'le-cafe.ics', contentType: 'text/calendar; charset=UTF-8; method=PUBLISH', content: Buffer.from('BEGIN:VCALENDAR') },
          { filename: 'code.png', contentType: 'image/png', content: Buffer.from([137, 80, 78, 71]) },
        ],
      },
      'id@x',
      now,
    );
    expect(eml).toMatch(/Content-Type: multipart\/mixed; boundary="dp_[0-9a-f]+"/);
    expect(eml).toContain('Content-Type: multipart/alternative;');
    expect(eml).toContain('Content-Disposition: attachment; filename="le-cafe.ics"');
    expect(eml).toContain(Buffer.from('BEGIN:VCALENDAR').toString('base64'));
    expect(eml).toContain('Content-Type: image/png; name="code.png"');
  });
});
