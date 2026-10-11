// AUT-003 step 2 — e-mails of the alerts and of the preferences page, sent from the outbox after the commit:
// `alert.created` / `alert.confirmation_requested` → C_ALERT_CONFIRM (only while the alert still waits for it);
// `alert.links_requested` → C_ALERT_MANAGE (the management link of each alert of the address);
// `preferences.link_requested` → C_PREFERENCES_LINK. Links carry tokens produced at sending time (NOT-010) and never
// stored readable (NOT-002); every e-mail carries its key (NOT-011). The objects are read again (FIA-042).
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { ALERT_CONFIRM_DAYS } from '@dp/contracts';
import { createTranslator } from '@dp/i18n';
import { ENV, type Env } from '../config/env.js';
import {
  alertManageToken,
  alertPagePath,
  preferencesPagePath,
  signAlertToken,
  signPreferencesToken,
} from '../communication/link-tokens.js';
import { MailerService } from '../communication/mailer.service.js';
import { Clock } from '../platform/clock.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { alertState } from './alerts.service.js';

const t = createTranslator('fr');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

@Injectable()
export class AlertsMailHandler implements OutboxHandler, OnModuleInit {
  readonly name = 'alerts.mail';
  readonly types = ['alert.created', 'alert.confirmation_requested', 'alert.links_requested', 'preferences.link_requested'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly settings: SettingsService,
    private readonly handlers: OutboxHandlers,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
  }

  async handle(event: OutboxRecord): Promise<void> {
    if (event.type === 'preferences.link_requested') return this.preferencesLink(event);
    if (event.type === 'alert.links_requested') return this.manageLinks(event);
    return this.confirmation(event);
  }

  private async common() {
    const companyName = await this.settings.get('contact.companyName');
    return {
      advisor: { firstName: t('ui.email.advisorFallback.firstName'), displayName: t('ui.email.advisorFallback.displayName', { company: companyName }) },
      company: { name: companyName, siteUrl: this.env.WEB_URL },
    };
  }

  /** CAT-071 — the activation link, valid 7 days from this sending (a resent e-mail gives a fresh week). */
  private async confirmation(event: OutboxRecord): Promise<void> {
    const alert = await this.prisma.searchAlert.findUnique({ where: { id: event.aggregateId } });
    if (!alert || alertState(alert) !== 'PENDING') return;
    await this.mailer.sendTemplate({
      templateCode: 'C_ALERT_CONFIRM',
      to: alert.email,
      dedupeKey: `C_ALERT_CONFIRM:${event.id}:${alert.email}`,
      triggeredBy: 'EVENT',
      links: { clientId: alert.clientId },
      vars: { ...(await this.common()), alert: { label: alert.label ?? t('ui.catalogue.page.summaryNone') } },
      secrets: async () => {
        const expires = new Date(this.clock.now().getTime() + ALERT_CONFIRM_DAYS * 86_400_000);
        return { action: { url: `${this.env.WEB_URL}${alertPagePath(signAlertToken(this.env.LINK_SIGNING_KEY, 'confirm', alert.id, expires))}` } };
      },
      greetingName: null,
      render: { eventId: event.id, alertId: alert.id },
    });
  }

  /** SFA-035 — « l'e-mail de gestion repart »: one e-mail listing each alert of the address with its own link. */
  private async manageLinks(event: OutboxRecord): Promise<void> {
    const ids = Array.isArray(event.payload.alertIds) ? (event.payload.alertIds as string[]) : [event.aggregateId];
    const alerts = (await this.prisma.searchAlert.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: 'desc' } })).filter(
      (a) => alertState(a) !== 'STOPPED' && alertState(a) !== 'PENDING',
    );
    if (!alerts.length) return;
    const email = alerts[0]!.email;
    const row = (label: string, href: string | null) => ({
      html: `<li style="margin:0 0 8px">${href ? `<a href="${esc(href)}">${esc(label)}</a>` : esc(label)}</li>`,
      text: href ? `- ${label} : ${href}` : `- ${label}`,
    });
    const build = (withLinks: boolean) => {
      const rows = alerts.map((a) =>
        row(a.label ?? t('ui.catalogue.page.summaryNone'), withLinks ? `${this.env.WEB_URL}${alertPagePath(alertManageToken(this.env.LINK_SIGNING_KEY, a.id))}` : null),
      );
      return { html: `<ul style="padding-left:18px">${rows.map((r) => r.html).join('')}</ul>`, text: rows.map((r) => r.text).join('\n') };
    };
    await this.mailer.sendTemplate({
      templateCode: 'C_ALERT_MANAGE',
      to: email,
      dedupeKey: `C_ALERT_MANAGE:${event.id}:${email}`,
      triggeredBy: 'EVENT',
      links: { clientId: alerts[0]!.clientId },
      vars: await this.common(),
      blocks: { alerts: { ...build(true), redacted: build(false) } },
      greetingName: null,
      render: { eventId: event.id, alertIds: alerts.map((a) => a.id) },
    });
  }

  /** PRO-031 — a new preferences link for the record (the previous ones died with a change of address). */
  private async preferencesLink(event: OutboxRecord): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { id: event.aggregateId }, select: { id: true, email: true, firstName: true, gdprErasedAt: true, deletedAt: true } });
    if (!client?.email || client.gdprErasedAt || client.deletedAt) return;
    const email = client.email;
    await this.mailer.sendTemplate({
      templateCode: 'C_PREFERENCES_LINK',
      to: email,
      dedupeKey: `C_PREFERENCES_LINK:${event.id}:${email}`,
      triggeredBy: 'EVENT',
      links: { clientId: client.id },
      vars: { ...(await this.common()), client: { firstName: client.firstName } },
      // The group carried by the link is the first one shown on the page; the page lists them all.
      secrets: async () => ({ action: { url: `${this.env.WEB_URL}${preferencesPagePath(signPreferencesToken(this.env.LINK_SIGNING_KEY, client.id, 'NEWS', null, email))}` } }),
      greetingName: client.firstName,
      render: { eventId: event.id },
    });
  }
}

/** C_ALERT_MATCHES `{{> properties}}` — six properties at most: photo, title, place, price, monthly payment* (NOT-009). */
export function propertiesBlock(
  items: { title: string; url: string; place: string; price: string | null; monthly: string | null; image: string | null }[],
  footnote: string | null,
): { html: string; text: string } {
  const html = items
    .map(
      (p) =>
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;border:1px solid #e6e1d6;border-radius:8px"><tr>` +
        (p.image ? `<td width="120" style="padding:8px"><img src="${esc(p.image)}" width="120" alt="" style="display:block;border-radius:6px;width:120px;height:auto"></td>` : '') +
        `<td style="padding:8px 12px;vertical-align:top"><a href="${esc(p.url)}" style="font-weight:700;color:#06177a;text-decoration:none">${esc(p.title)}</a>` +
        `<br><span style="color:#5f5f5f">${esc(p.place)}</span>` +
        (p.price ? `<br><strong>${esc(p.price)}</strong>` : '') +
        (p.monthly ? ` · ${esc(t('ui.alerts.email.monthly', { montant: p.monthly }))}` : '') +
        `</td></tr></table>`,
    )
    .join('');
  const text = items
    .map((p) => [p.title, p.place, [p.price, p.monthly ? t('ui.alerts.email.monthly', { montant: p.monthly }) : null].filter(Boolean).join(' · '), p.url].filter(Boolean).join('\n'))
    .join('\n\n');
  const note = footnote && items.some((p) => p.monthly) ? footnote : null;
  return {
    html: html + (note ? `<p style="font-size:12px;color:#5f5f5f">${esc(note)}</p>` : ''),
    text: text + (note ? `\n\n${note}` : ''),
  };
}

