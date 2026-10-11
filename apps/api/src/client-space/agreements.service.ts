// EC-53 « Mes accords » (PRO-051) — `GET /client/me/consents`, `POST /client/me/consents`. MOD-106: a consent row is
// never modified; the state is the most recent row (`givenAt`) for (person, type). Giving the transmission agreement
// is the box of DOS-040 in the « Pièces » tab (package 2.9); withdrawing it is here, with its effects (PRO-051,
// GED-071): one `Consent` row of withdrawal, active share links of the client's dossiers revoked, `consent.changed`,
// a line in each open dossier's timeline; the task for the advisor is the rule `R_CONSENT_WITHDRAWN` (automation engine).
import { Inject, Injectable } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import { consentChangeRequestSchema, type ClientAgreements, type LegalAcceptance, type TransmissionAgreement } from '@dp/contracts';
import { writeAudit } from '../admin/audit.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp } from '../platform/rate-limit.js';
import type { Request } from 'express';
import { parseOrThrow } from '../platform/validation.js';
import { advisorDisplayName, writeClientTimeline } from './timeline.js';

const t = createTranslator('fr');
const LEGAL_HREF: Record<LegalAcceptance['type'], string> = { TERMS_OF_USE: '/conditions-generales', PRIVACY_POLICY: '/confidentialite' };

@Injectable()
export class AgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly outbox: OutboxWriter,
    private readonly ip: ClientIp,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  async list(auth: AuthContext): Promise<ClientAgreements> {
    const or = [{ userId: auth.userId }, ...(auth.clientId ? [{ clientId: auth.clientId }] : [])];
    const rows = await this.prisma.consent.findMany({
      where: { OR: or, type: { in: ['TERMS_OF_USE', 'PRIVACY_POLICY', 'MARKETING_EMAIL', 'DATA_SHARING_PARTNERS'] } },
      orderBy: { givenAt: 'desc' },
      select: { type: true, granted: true, givenAt: true, documentVersion: true, recordedById: true, recordedBy: { select: { firstName: true, lastName: true } } },
    });
    const last = (type: string) => rows.find((r) => r.type === type) ?? null;
    const legal: LegalAcceptance[] = (['TERMS_OF_USE', 'PRIVACY_POLICY'] as const).map((type) => {
      const r = rows.find((x) => x.type === type && x.granted) ?? null;
      return { type, version: r?.documentVersion ?? null, acceptedAt: r?.givenAt.toISOString() ?? null, href: LEGAL_HREF[type] };
    });
    const m = last('MARKETING_EMAIL');
    const tr = last('DATA_SHARING_PARTNERS');
    const recordedBy = tr?.recordedBy ? advisorDisplayName(tr.recordedBy.firstName, tr.recordedBy.lastName) : null;
    const transmission: TransmissionAgreement = !tr
      ? { state: 'NOT_GIVEN', at: null, recordedBy: null }
      : {
          state: tr.granted ? (tr.recordedById ? 'RECORDED' : 'GIVEN') : tr.recordedById ? 'WITHDRAWAL_RECORDED' : 'WITHDRAWN',
          at: tr.givenAt.toISOString(),
          recordedBy,
        };

    let parties: ClientAgreements['parties'] = [];
    let documentsDossierReference: string | null = null;
    if (auth.clientId) {
      const auths = await this.prisma.consent.findMany({
        where: { clientId: auth.clientId, type: 'PARTY_AUTHORIZATION', granted: true, partyId: { not: null } },
        orderBy: { givenAt: 'desc' },
        select: { givenAt: true, party: { select: { firstName: true, removedAt: true, dossier: { select: { reference: true } } } } },
      });
      parties = auths.filter((a) => a.party && !a.party.removedAt).map((a) => ({ dossierReference: a.party!.dossier.reference, firstName: a.party!.firstName, at: a.givenAt.toISOString() }));
      const withDocs = await this.prisma.dossier.findFirst({
        where: { clientId: auth.clientId, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] }, dossierDocuments: { some: { isInternal: false } } },
        orderBy: { lastActivityAt: 'desc' },
        select: { reference: true },
      });
      documentsDossierReference = withDocs?.reference ?? null;
    }
    return { legal, marketing: { granted: Boolean(m?.granted), at: m?.givenAt.toISOString() ?? null }, transmission, parties, documentsDossierReference };
  }

  async change(req: Request, auth: AuthContext, body: unknown): Promise<ClientAgreements> {
    if (!auth.clientId) throw AppError.notFound();
    const clientId = auth.clientId;
    const input = parseOrThrow(consentChangeRequestSchema, body);
    const now = this.clock.now();
    const proof = { ipHash: this.ip.fingerprint(req), userAgent: (req.headers['user-agent'] ?? '').slice(0, 400) || null };
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.consent.findFirst({ where: { clientId, type: input.type }, orderBy: { givenAt: 'desc' }, select: { granted: true } });
      if (Boolean(current?.granted) === input.granted) return; // nothing changes: no new row
      if (input.type === 'MARKETING_EMAIL') {
        // PRO-030 — the « Actualités » switch is the consent itself.
        await tx.consent.create({
          data: { id: newId(), type: 'MARKETING_EMAIL', granted: input.granted, userId: auth.userId, clientId, wording: t('ui.client.agreements.marketing.wording'), source: 'client:space', givenAt: now, createdAt: now, ...proof },
        });
        await tx.client.update({ where: { id: clientId }, data: { marketingOptIn: input.granted, updatedAt: now } });
        await this.outbox.add(tx, { type: 'consent.changed', aggregateType: 'Client', aggregateId: clientId, payload: { type: 'MARKETING_EMAIL', granted: input.granted, by: 'CLIENT', dossierId: null } }, now);
        await writeAudit(tx, auth.actor, now, { action: 'consent.changed', entityType: 'consent', entityId: null, after: { type: 'MARKETING_EMAIL', granted: input.granted }, clientId });
        return;
      }
      // PRO-051 — withdrawal of the transmission agreement.
      await tx.consent.create({
        data: { id: newId(), type: 'DATA_SHARING_PARTNERS', granted: false, userId: auth.userId, clientId, wording: t('ui.client.agreements.transmission.withdrawWording'), source: 'client:space', givenAt: now, createdAt: now, ...proof },
      });
      const dossiers = await tx.dossier.findMany({
        where: { clientId, deletedAt: null },
        select: { id: true, status: true, assignedAgentId: true, lastActivityAt: true },
        orderBy: { lastActivityAt: 'desc' },
      });
      const ids = dossiers.map((d) => d.id);
      if (ids.length) {
        // GED-071 — the share links still active are revoked (packages of the dossiers' submissions).
        const packages = await tx.submissionPackage.findMany({ where: { submission: { dossierId: { in: ids } } }, select: { id: true } });
        if (packages.length) {
          await tx.secureShare.updateMany({ where: { packageId: { in: packages.map((p) => p.id) }, revokedAt: null }, data: { revokedAt: now } });
        }
      }
      const live = dossiers.filter((d) => d.status === 'OPEN' || d.status === 'ON_HOLD');
      for (const d of live) await writeClientTimeline(tx, { dossierId: d.id, kind: 'CONSENT_WITHDRAWN', params: {}, at: now });
      const main = live[0] ?? dossiers[0] ?? null;
      // The task for the advisor (« {client} a retiré son accord de transmission », key `consent:{dossierId}`) and his
      // alert are the rule R_CONSENT_WITHDRAWN (AUT-041), triggered by the event below — never created here (AUT-002).
      await this.outbox.add(tx, { type: 'consent.changed', aggregateType: 'Client', aggregateId: clientId, payload: { type: 'DATA_SHARING_PARTNERS', granted: false, by: 'CLIENT', dossierId: main?.id ?? null } }, now);
      await writeAudit(tx, auth.actor, now, { action: 'consent.changed', entityType: 'consent', entityId: null, after: { type: 'DATA_SHARING_PARTNERS', granted: false }, clientId });
    });
    this.dispatcher.wake();
    return this.list(auth);
  }
}
