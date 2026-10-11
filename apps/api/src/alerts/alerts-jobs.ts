// AUT-060, AUT-061 — scheduled tasks of the search alerts (08-automatisations § 8):
//   `alerts.instant` every 15 minutes: INSTANT alerts, properties published at least 15 minutes ago (time to fix a typo),
//                    outside the quiet hours of `mail.quietHours` (AUT-006) in the recipient's time zone — the business
//                    calendar's for an address without an account;
//   `alerts.daily`   at 8:00 (business calendar time zone): DAILY alerts, and WEEKLY ones on Monday; the C_ALERT_EXPIRING
//                    notice 15 days before the end; deactivation of expired alerts; removal of alerts stopped by their
//                    owner or never confirmed for 30 days (prudent choice: the specs keep nothing of them).
// The favourites e-mail of AUT-062 belongs to `alerts.daily` too, but needs accounts (EC-41): it comes with the client space.
//
// The two tasks are declared to the scheduler of the platform (automation/scheduler.ts): it decides when they are due,
// writes their `JobRun` and prevents two passes of the same task from overlapping (AUT-082).
import { createHash } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { criteriaToSearch, type CatalogueCriteria } from '@dp/contracts';
import { formatMoney } from '@dp/i18n';
import type { SearchAlert } from '../generated/prisma/client.js';
import { ENV, type Env } from '../config/env.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import { alertManageToken, alertPagePath, signAlertToken, unsubscribeApiPath } from '../communication/link-tokens.js';
import { MailerService } from '../communication/mailer.service.js';
import { Clock } from '../platform/clock.js';
import { PrismaService } from '../platform/prisma.service.js';
import { log } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import { createTranslator } from '@dp/i18n';
import { propertiesBlock } from './alerts-mail.handler.js';
import { notifyClient } from '../client-tools/client-notify.js';
import { Scheduler } from '../automation/scheduler.js';

const t = createTranslator('fr');
const MINUTE = 60_000;
const DAY = 86_400_000;
/** AUT-060 — an INSTANT alert waits 15 minutes after the publication. */
export const INSTANT_DELAY_MS = 15 * MINUTE;
/** AUT-061 — the notice leaves 15 days before the end. */
export const EXPIRY_NOTICE_DAYS = 15;
/** The extension link stays valid 30 days after the end (an expired alert can still be woken up from the e-mail). */
const EXTEND_GRACE_DAYS = 30;
/** Stopped or never confirmed alerts are removed after 30 days. */
const PURGE_DAYS = 30;
/** C_ALERT_MATCHES lists six properties at most. */
export const MATCHES_SHOWN = 6;

/** Local « HH:MM » and weekday (1 = Monday) of an instant in a time zone. */
export function localClock(instant: Date, timeZone: string): { hm: string; weekday: number; date: string } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return { hm: `${get('hour')}:${get('minute')}`, weekday: days.indexOf(get('weekday')) + 1, date: `${get('year')}-${get('month')}-${get('day')}` };
}

/** AUT-006 — inside the quiet hours (`start` › `end`, possibly over midnight). */
export function inQuietHours(hm: string, quiet: { start: string; end: string }): boolean {
  return quiet.start > quiet.end ? hm >= quiet.start || hm < quiet.end : hm >= quiet.start && hm < quiet.end;
}

@Injectable()
export class AlertsJobs implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly catalogue: CatalogueService,
    private readonly mailer: MailerService,
    private readonly scheduler: Scheduler,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.scheduler.register({ name: 'alerts.instant', schedule: { everyMinutes: 15 }, run: () => this.instant() });
    this.scheduler.register({ name: 'alerts.daily', schedule: { dailyAt: '08:00' }, run: () => this.daily() });
  }

  // ---------- passes ----------

  /** `alerts.instant` — AUT-060 INSTANT. */
  async instant(): Promise<Record<string, number>> {
    const counters = { alerts: 0, sent: 0, quiet: 0 };
    if (!(await this.settings.get('features.searchAlerts'))) return counters; // PAR-011
    const now = this.clock.now();
    const [quiet, tz] = await Promise.all([this.settings.get('mail.quietHours'), this.settings.get('business.calendar.timezone')]);
    if (inQuietHours(localClock(now, tz).hm, quiet)) {
      counters.quiet = 1;
      return counters;
    }
    const alerts = await this.prisma.searchAlert.findMany({ where: { frequency: 'INSTANT', isActive: true, confirmedAt: { not: null }, deactivatedReason: null, expiresAt: { gt: now } } });
    for (const a of alerts) {
      counters.alerts++;
      // The window starts where the previous pass stopped looking (its send time minus the 15-minute delay).
      const since = a.lastSentAt ? new Date(a.lastSentAt.getTime() - INSTANT_DELAY_MS) : a.createdAt;
      if (await this.safeSend(a, since, new Date(now.getTime() - INSTANT_DELAY_MS))) counters.sent++;
    }
    return counters;
  }

  /** `alerts.daily` — AUT-060 DAILY (+ WEEKLY on Monday), AUT-061 notice and expiry, purge. */
  async daily(): Promise<Record<string, number>> {
    const counters = { expired: 0, notices: 0, alerts: 0, sent: 0, purged: 0 };
    const now = this.clock.now();
    const tz = await this.settings.get('business.calendar.timezone');
    // AUT-061 — without extension, the alert is deactivated (it is not a feature switch: done even when the feature is off).
    counters.expired = (
      await this.prisma.searchAlert.updateMany({
        where: { confirmedAt: { not: null }, deactivatedReason: null, expiresAt: { lte: now }, frequency: { not: 'NONE' } },
        data: { isActive: false, deactivatedReason: 'EXPIRED', deactivatedAt: now, updatedAt: now },
      })
    ).count;
    counters.purged = (
      await this.prisma.searchAlert.deleteMany({
        where: {
          OR: [
            { deactivatedReason: 'USER', deactivatedAt: { lt: new Date(now.getTime() - PURGE_DAYS * DAY) }, clientId: null },
            { confirmedAt: null, deactivatedReason: null, createdAt: { lt: new Date(now.getTime() - PURGE_DAYS * DAY) }, clientId: null },
          ],
        },
      })
    ).count;
    if (!(await this.settings.get('features.searchAlerts'))) return counters; // PAR-011: sendings stop

    const expiring = await this.prisma.searchAlert.findMany({
      where: { isActive: true, confirmedAt: { not: null }, deactivatedReason: null, expiryNoticeSentAt: null, frequency: { not: 'NONE' }, expiresAt: { gt: now, lte: new Date(now.getTime() + EXPIRY_NOTICE_DAYS * DAY) } },
    });
    for (const a of expiring) if (await this.safeNotice(a)) counters.notices++;

    const monday = localClock(now, tz).weekday === 1;
    const alerts = await this.prisma.searchAlert.findMany({
      where: { frequency: { in: monday ? ['DAILY', 'WEEKLY'] : ['DAILY'] }, isActive: true, confirmedAt: { not: null }, deactivatedReason: null, expiresAt: { gt: now } },
    });
    for (const a of alerts) {
      counters.alerts++;
      if (await this.safeSend(a, a.lastSentAt ?? a.createdAt, now)) counters.sent++;
    }
    return counters;
  }

  private async safeSend(a: SearchAlert, since: Date, until: Date): Promise<boolean> {
    try {
      return await this.sendMatches(a, since, until);
    } catch (err) {
      // Transient (provider down): the same properties are found again at the next pass, under the same e-mail key.
      log('warn', 'alerts.send_failed', { alertId: a.id, message: err instanceof Error ? err.message.slice(0, 200) : 'error' });
      return false;
    }
  }

  private async safeNotice(a: SearchAlert): Promise<boolean> {
    try {
      return await this.sendExpiryNotice(a);
    } catch (err) {
      log('warn', 'alerts.notice_failed', { alertId: a.id, message: err instanceof Error ? err.message.slice(0, 200) : 'error' });
      return false;
    }
  }

  /**
   * AUT-007 for an address: a record that must not be written to (erased, opposed, restricted) stops the e-mail; a
   * rejected address deactivates every alert of that address (AUT-061 `BOUNCE`).
   */
  private async blocked(a: SearchAlert): Promise<boolean> {
    const client = await this.prisma.client.findFirst({
      where: a.clientId ? { id: a.clientId } : { email: a.email, deletedAt: null, mergedIntoId: null },
      select: { emailBouncedAt: true, doNotContact: true, restrictedAt: true, gdprErasedAt: true },
    });
    if (!client) return false;
    if (client.emailBouncedAt) {
      const now = this.clock.now();
      await this.prisma.searchAlert.updateMany({ where: { email: a.email, isActive: true }, data: { isActive: false, deactivatedReason: 'BOUNCE', deactivatedAt: now, updatedAt: now } });
      return true;
    }
    return Boolean(client.doNotContact || client.restrictedAt || client.gdprErasedAt);
  }

  private links(a: SearchAlert) {
    const key = this.env.LINK_SIGNING_KEY;
    return {
      manageUrl: `${this.env.WEB_URL}${alertPagePath(alertManageToken(key, a.id))}`,
      // NOT-022 — an alert made without an account has its own one-click way out; with a record, the group's.
      unsubscribe: a.clientId ? null : { oneClickPath: unsubscribeApiPath(signAlertToken(key, 'stop', a.id, null)) },
    };
  }

  /** AUT-060 — new properties published in the window, matching, AVAILABLE, never sent for this alert. */
  async sendMatches(a: SearchAlert, since: Date, until: Date): Promise<boolean> {
    if (until <= since) return false;
    const published = await this.prisma.property.findMany({
      where: { publication: 'PUBLISHED', deletedAt: null, publishedAt: { gt: since, lte: until } },
      select: { id: true },
    });
    if (!published.length) return false;
    const criteria = (a.criteria ?? {}) as CatalogueCriteria;
    const ids = new Set(published.map((p) => p.id));
    let rows = (await this.catalogue.matchingRows(criteria)).filter((p) => ids.has(p.id));
    if (!rows.length) return false;
    const already = await this.prisma.alertDelivery.findMany({ where: { alertId: a.id, propertyId: { in: rows.map((r) => r.id) } }, select: { propertyId: true } });
    const sent = new Set(already.map((d) => d.propertyId));
    rows = rows.filter((r) => !sent.has(r.id)).sort((x, y) => (y.firstPublishedAt?.getTime() ?? 0) - (x.firstPublishedAt?.getTime() ?? 0));
    if (!rows.length) return false;
    if (await this.blocked(a)) return false;

    const [cards, monthlyOn, footnote, companyName] = await Promise.all([
      this.catalogue.toCards(rows.slice(0, MATCHES_SHOWN)),
      this.settings.get('features.monthlyBudgetSearch'),
      this.settings.get('legal.monthlyFootnote'),
      this.settings.get('contact.companyName'),
    ]);
    const amount = (m: { amount: string; currency: string } | null) => (m ? formatMoney(Math.round(Number(m.amount)), m.currency, 'fr-FR', 0) : null);
    const block = propertiesBlock(
      cards.map((c) => ({
        title: c.title,
        url: `${this.env.WEB_URL}/biens/${c.slug}`,
        place: c.city ? `${c.city.name}, ${c.region.name}` : c.region.name,
        price: amount(c.priceFromRef),
        monthly: monthlyOn ? amount(c.monthlyFromRef) : null,
        // an e-mail needs an absolute address (the base is a path in local development)
        image: c.cover ? `${c.cover.base.startsWith('/') ? this.env.WEB_URL.replace(/\/$/, '') : ''}${c.cover.base}/card.${c.cover.formats.includes('jpg') ? 'jpg' : (c.cover.formats[0] ?? 'jpg')}` : null,
      })),
      footnote,
    );
    const batch = createHash('sha256').update(rows.map((r) => r.id).sort().join(',')).digest('hex').slice(0, 16);
    const links = this.links(a);
    const outcome = await this.mailer.sendTemplate({
      templateCode: 'C_ALERT_MATCHES',
      to: a.email,
      // NOT-011 — a grouped e-mail: the key names the common object (the alert and this batch of properties).
      dedupeKey: `C_ALERT_MATCHES:${a.id}:${batch}`,
      triggeredBy: 'SYSTEM',
      links: { clientId: a.clientId },
      vars: {
        advisor: { firstName: t('ui.email.advisorFallback.firstName'), displayName: t('ui.email.advisorFallback.displayName', { company: companyName }) },
        company: { name: companyName, siteUrl: this.env.WEB_URL },
        alert: {
          label: a.label ?? t('ui.catalogue.page.summaryNone'),
          totalCount: rows.length,
          resultsUrl: `${this.env.WEB_URL}/programmes${criteriaToSearch({ ...criteria, sort: 'newest' })}`,
        },
      },
      secrets: async () => ({ alert: { manageUrl: links.manageUrl } }),
      blocks: { properties: block },
      unsubscribe: links.unsubscribe,
      greetingName: null,
      render: { alertId: a.id, propertyIds: rows.map((r) => r.id) },
    });
    // Whatever the outcome but a transient failure (thrown), the properties count as handled for this alert: a group
    // cut by the person or a rejected address must not pile them up for a later e-mail.
    const now = this.clock.now();
    await this.prisma.$transaction([
      this.prisma.alertDelivery.createMany({ data: rows.map((r) => ({ alertId: a.id, propertyId: r.id, sentAt: now, createdAt: now, updatedAt: now })), skipDuplicates: true }),
      this.prisma.searchAlert.update({ where: { id: a.id }, data: { lastSentAt: now, updatedAt: now } }),
    ]);
    // AUT-060 — for a client with an account, an in-app notification accompanies the e-mail (NC_ALERT_MATCHES).
    if (a.clientId && (outcome === 'SENT' || outcome === 'ALREADY_DONE')) {
      await notifyClient(this.prisma, now, {
        clientId: a.clientId,
        type: 'NC_ALERT_MATCHES',
        title: t('ui.clientTools.alerts.notify.matches', { n: rows.length, libelle: a.label ?? t('ui.catalogue.page.summaryNone') }),
        link: `/programmes${criteriaToSearch({ ...criteria, sort: 'newest' })}`,
        dedupeKey: `NC_ALERT_MATCHES:${a.id}:${batch}`,
      });
    }
    return outcome === 'SENT' || outcome === 'ALREADY_DONE';
  }

  /** AUT-061 — « Prolonger mon alerte », one click without signing in. */
  async sendExpiryNotice(a: SearchAlert): Promise<boolean> {
    if (await this.blocked(a)) return false;
    const companyName = await this.settings.get('contact.companyName');
    const links = this.links(a);
    const outcome = await this.mailer.sendTemplate({
      templateCode: 'C_ALERT_EXPIRING',
      to: a.email,
      dedupeKey: `C_ALERT_EXPIRING:${a.id}:${a.expiresAt.toISOString()}`,
      triggeredBy: 'SYSTEM',
      links: { clientId: a.clientId },
      vars: {
        advisor: { firstName: t('ui.email.advisorFallback.firstName'), displayName: t('ui.email.advisorFallback.displayName', { company: companyName }) },
        company: { name: companyName, siteUrl: this.env.WEB_URL },
        alert: { label: a.label ?? t('ui.catalogue.page.summaryNone') },
      },
      secrets: async () => ({
        alert: {
          manageUrl: links.manageUrl,
          extendUrl: `${this.env.WEB_URL}${alertPagePath(signAlertToken(this.env.LINK_SIGNING_KEY, 'extend', a.id, new Date(a.expiresAt.getTime() + EXTEND_GRACE_DAYS * DAY)))}`,
        },
      }),
      unsubscribe: links.unsubscribe,
      greetingName: null,
      render: { alertId: a.id },
    });
    const now = this.clock.now();
    await this.prisma.searchAlert.update({ where: { id: a.id }, data: { expiryNoticeSentAt: now, updatedAt: now } });
    return outcome === 'SENT' || outcome === 'ALREADY_DONE';
  }
}
