// BO-030, TRV-103 — the global search of the back office (EA-106): from 2 characters, five results at most per type,
// an exact reference first. Each type is searched only when the role may read it (API-100 « selon l'objet »), inside
// the reader's perimeter (ROL-018) and with the SUPPORT masking (ROL-015): a SUPPORT account searches by reference or
// by identifier only — a search on a name, an e-mail or a phone returns nothing, so that a masked value cannot be
// guessed by trial.
import { Injectable } from '@nestjs/common';
import { SEARCH_TYPES, type SearchHit, type SearchResponse, type SearchType } from '@dp/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { PrismaService } from '../platform/prisma.service.js';
import { clientName, clientScope, dossierScope, leadScope, maskEmail, maskName, StaffViews, type StaffView } from './staff-view.js';

const LIMIT = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ci = (q: string) => ({ contains: q, mode: 'insensitive' as const });

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: StaffViews,
  ) {}

  private async clientIds(q: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM clients c
      WHERE c.deleted_at IS NULL AND c.merged_into_id IS NULL AND (
        c.search_text LIKE '%' || lower(public.f_unaccent(${q})) || '%'
        OR word_similarity(lower(public.f_unaccent(${q})), c.search_text) >= 0.6
      )
      ORDER BY (c.search_text LIKE '%' || lower(public.f_unaccent(${q})) || '%') DESC, c.created_at DESC
      LIMIT 200`;
    return rows.map((r) => r.id);
  }

  /** `GET /admin/search?q=` — any staff role; each group follows the permission of its object. */
  async search(auth: AuthContext, rawQ: unknown, rawTypes: unknown): Promise<SearchResponse> {
    const staff = await this.views.of(auth);
    const q = typeof rawQ === 'string' ? rawQ.trim().slice(0, 120) : '';
    if (q.length < 2) return { groups: [] };
    const wanted = typeof rawTypes === 'string' && rawTypes ? rawTypes.split(',').filter((t): t is SearchType => (SEARCH_TYPES as readonly string[]).includes(t)) : [...SEARCH_TYPES];
    const personal = !staff.masked; // ROL-015
    const ref = q.toUpperCase();
    const byPerson = personal ? await this.clientIds(q) : [];
    const exact = (reference: string | null | undefined) => Boolean(reference && reference.toUpperCase() === ref);

    const runners: Record<SearchType, () => Promise<SearchHit[]>> = {
      CLIENT: async () => {
        if (!staff.has('client.read')) return [];
        const ids = personal ? byPerson : UUID.test(q) ? [q] : [];
        if (!ids.length) return [];
        const rows = await this.prisma.client.findMany({
          where: { AND: [{ id: { in: ids }, deletedAt: null }, clientScope(staff)] },
          select: { id: true, firstName: true, lastName: true, email: true, status: true },
          take: 60,
        });
        rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        return rows.slice(0, LIMIT + 1).map((c) => ({
          type: 'CLIENT',
          id: c.id,
          key: c.id,
          title: (personal ? clientName(c) : maskName(c.firstName, c.lastName)) ?? '—',
          subtitle: personal ? c.email : maskEmail(c.email),
          status: { enum: 'ClientStatus', value: c.status },
          date: null,
          exact: false,
        }));
      },
      LEAD: async () => {
        if (!staff.has('lead.read')) return [];
        const or: Prisma.LeadWhereInput[] = [{ reference: ci(q) }];
        if (personal) {
          if (byPerson.length) or.push({ clientId: { in: byPerson } });
          or.push({ email: ci(q) }, { lastName: ci(q) }, { firstName: ci(q) });
        }
        const rows = await this.prisma.lead.findMany({
          where: { AND: [leadScope(staff), { OR: or }] },
          select: { id: true, reference: true, kind: true, createdAt: true, firstName: true, lastName: true, client: { select: { firstName: true, lastName: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: LIMIT + 1,
        });
        return rows.map((l) => {
          const p = l.client ?? l;
          return { type: 'LEAD', id: l.id, key: l.reference, title: l.reference, subtitle: personal ? clientName(p) : maskName(p.firstName, p.lastName), status: { enum: 'LeadKind', value: l.kind }, date: l.createdAt.toISOString(), exact: exact(l.reference) };
        });
      },
      DOSSIER: async () => {
        if (!staff.has('dossier.read')) return [];
        const or: Prisma.DossierWhereInput[] = [{ reference: ci(q) }];
        if (personal && byPerson.length) or.push({ clientId: { in: byPerson } });
        or.push({ property: { title: ci(q) } });
        const rows = await this.prisma.dossier.findMany({
          where: { AND: [{ deletedAt: null }, dossierScope(staff), { OR: or }] },
          select: { id: true, reference: true, stage: true, client: { select: { firstName: true, lastName: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: LIMIT + 1,
        });
        return rows.map((d) => ({ type: 'DOSSIER', id: d.id, key: d.reference, title: d.reference, subtitle: personal ? clientName(d.client) : maskName(d.client.firstName, d.client.lastName), status: { enum: 'DossierStage', value: d.stage }, date: null, exact: exact(d.reference) }));
      },
      SUBMISSION: async () => {
        if (!staff.has('submission.read')) return [];
        const rows = await this.prisma.bankSubmission.findMany({
          where: { AND: [{ OR: [{ reference: ci(q) }, { bankReference: ci(q) }] }, { dossier: { AND: [{ deletedAt: null }, dossierScope(staff)] } }] },
          select: { id: true, reference: true, status: true, bank: { select: { name: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: LIMIT + 1,
        });
        return rows.map((s) => ({ type: 'SUBMISSION', id: s.id, key: s.reference, title: s.reference, subtitle: s.bank.name, status: { enum: 'SubmissionStatus', value: s.status }, date: null, exact: exact(s.reference) }));
      },
      PROPERTY: async () => {
        if (!staff.has('catalogue.read')) return [];
        const rows = await this.prisma.property.findMany({
          where: { deletedAt: null, OR: [{ reference: ci(q) }, { title: ci(q) }] },
          select: { id: true, reference: true, title: true, publication: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: LIMIT + 1,
        });
        return rows.map((p) => ({ type: 'PROPERTY', id: p.id, key: p.id, title: p.reference, subtitle: p.title, status: { enum: 'PublicationStatus', value: p.publication }, date: null, exact: exact(p.reference) }));
      },
      PROGRAM: async () => {
        if (!staff.has('catalogue.read')) return [];
        const rows = await this.prisma.program.findMany({ where: { deletedAt: null, name: ci(q) }, select: { id: true, name: true, region: { select: { nameFr: true } } }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: LIMIT + 1 });
        return rows.map((p) => ({ type: 'PROGRAM', id: p.id, key: p.id, title: p.name, subtitle: p.region.nameFr, status: null, date: null, exact: false }));
      },
      PROMOTER: async () => {
        if (!staff.has('promoter.read')) return [];
        const rows = await this.prisma.promoter.findMany({
          where: { deletedAt: null, OR: [{ legalName: ci(q) }, { brandName: ci(q) }] },
          select: { id: true, legalName: true, brandName: true, status: true },
          orderBy: [{ legalName: 'asc' }, { id: 'asc' }],
          take: LIMIT + 1,
        });
        return rows.map((p) => ({ type: 'PROMOTER', id: p.id, key: p.id, title: p.brandName ?? p.legalName, subtitle: null, status: { enum: 'PartnerStatus', value: p.status }, date: null, exact: false }));
      },
      BANK: async () => {
        if (!staff.has('bank.read')) return [];
        const rows = await this.prisma.bank.findMany({ where: { deletedAt: null, name: ci(q) }, select: { id: true, name: true, status: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: LIMIT + 1 });
        return rows.map((b) => ({ type: 'BANK', id: b.id, key: b.id, title: b.name, subtitle: null, status: { enum: 'PartnerStatus', value: b.status }, date: null, exact: false }));
      },
      EVENT: async () => {
        if (!staff.has('event.read')) return [];
        const rows = await this.prisma.event.findMany({
          where: { deletedAt: null, OR: [{ reference: ci(q) }, { cityName: ci(q) }, { venueName: ci(q) }] },
          select: { id: true, reference: true, cityName: true, startsAt: true },
          orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
          take: LIMIT + 1,
        });
        return rows.map((e) => ({ type: 'EVENT', id: e.id, key: e.id, title: e.cityName, subtitle: e.reference, status: null, date: e.startsAt.toISOString(), exact: exact(e.reference) }));
      },
    };

    const groups = await Promise.all(
      wanted.map(async (type) => {
        const hits = await runners[type]();
        hits.sort((a, b) => Number(b.exact) - Number(a.exact));
        return { type, hits: hits.slice(0, LIMIT), more: hits.length > LIMIT };
      }),
    );
    // BO-030 — a group holding an exact reference comes first.
    const filled = groups.filter((g) => g.hits.length > 0);
    filled.sort((a, b) => Number(b.hits[0]!.exact) - Number(a.hits[0]!.exact));
    return { groups: filled };
  }
}
