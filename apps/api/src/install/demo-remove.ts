// PAR-082 — removes PHYSICALLY what the demonstration created, found through the audit log (`{objet}.created`,
// actor SYSTEM, reason `demo`), with what depends on it, in an order the foreign keys accept; plus the
// `@demo.invalid` people. Refused in production. One transaction; media files are purged after the commit.
// Run: pnpm --filter @dp/api demo:remove
import 'reflect-metadata';
import { loadEnv } from '../config/env.js';
import { DEMO_ACTOR } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { buildAdminServices } from './admin-services.js';
import type { MediaOwnerType } from '../generated/prisma/client.js';

const DEMO_DOMAIN = '@demo.invalid';

async function main(): Promise<void> {
  const env = loadEnv();
  if (env.APP_ENV === 'production') {
    process.stderr.write('Commande refusée : le retrait des données de démonstration est interdit en production (PAR-082).\n');
    process.exit(1);
  }
  const s = await buildAdminServices(env);
  const counts: Record<string, number> = {};
  let mediaToPurge: { id: string; ownerType: MediaOwnerType; ownerId: string; storageKey: string | null }[] = [];
  const privateKeys: string[] = [];
  try {
    const marks = await s.prisma.auditLog.findMany({
      where: { actorType: 'SYSTEM', reason: 'demo', action: { endsWith: '.created' }, entityId: { not: null } },
      select: { entityType: true, entityId: true },
    });
    const ids = (type: string) => [...new Set(marks.filter((m) => m.entityType === type).map((m) => m.entityId!))];

    await s.prisma.$transaction(
      async (tx) => {
        const now = s.clock.now();
        const done = async (type: string, list: string[], count: number) => {
          counts[type] = (counts[type] ?? 0) + count;
          for (const id of list) await writeAudit(tx, DEMO_ACTOR, now, { action: `${type}.deleted`, entityType: type, entityId: id });
        };
        const existing = async <T extends { id: string }>(rows: Promise<T[]>) => (await rows).map((r) => r.id);

        // Plan 2.9 — demonstration dossiers first (they hold the demo property and real clients' consents).
        // Plan 3.7, 3.8 — the followed dossiers lose their tasks and appointments first, then go with the others.
        const followed = await (await import('./demo-follow-up.js')).removeDemoFollowUps(tx);
        const dossiers = await (await import('./demo-dossier.js')).removeDemoDossiers(tx, [...ids('dossier'), ...followed], now);
        counts.dossier = dossiers.count;
        privateKeys.push(...dossiers.keys);

        // Cafés: registrations and demo people, partners, notify requests, then the events.
        const eventIds = await existing(tx.event.findMany({ where: { id: { in: ids('event') } }, select: { id: true } }));
        const regIds = await existing(
          tx.eventRegistration.findMany({ where: { OR: [{ id: { in: ids('event_registration') } }, { eventId: { in: eventIds } }, { email: { endsWith: DEMO_DOMAIN } }] }, select: { id: true } }),
        );
        await done('event_registration', regIds, (await tx.eventRegistration.deleteMany({ where: { id: { in: regIds } } })).count);
        const clientIds = await existing(
          tx.client.findMany({ where: { OR: [{ id: { in: ids('client') } }, { email: { endsWith: DEMO_DOMAIN } }], email: { endsWith: DEMO_DOMAIN } }, select: { id: true } }),
        );
        await done('client', clientIds, (await tx.client.deleteMany({ where: { id: { in: clientIds } } })).count);
        await tx.eventNotifyRequest.deleteMany({ where: { eventId: { in: eventIds } } });
        const epIds = await existing(tx.eventPartner.findMany({ where: { OR: [{ id: { in: ids('event_partner') } }, { eventId: { in: eventIds } }] }, select: { id: true } }));
        await done('event_partner', epIds, (await tx.eventPartner.deleteMany({ where: { id: { in: epIds } } })).count);
        await tx.event.updateMany({ where: { id: { in: eventIds } }, data: { coverMediaId: null } });

        // Catalogue: media of the demo (and of the demo owners), then lots, properties, programmes, partners.
        const programIds = await existing(tx.program.findMany({ where: { id: { in: ids('program') } }, select: { id: true } }));
        const propertyIds = await existing(tx.property.findMany({ where: { OR: [{ id: { in: ids('property') } }, { programId: { in: programIds } }] }, select: { id: true } }));
        const lotIds = await existing(tx.lot.findMany({ where: { OR: [{ id: { in: ids('lot') } }, { propertyId: { in: propertyIds } }] }, select: { id: true } }));
        const promoterIds = await existing(tx.promoter.findMany({ where: { id: { in: ids('promoter') } }, select: { id: true } }));
        const bankIds = await existing(tx.bank.findMany({ where: { id: { in: ids('bank') } }, select: { id: true } }));
        const ownerIds = [...eventIds, ...programIds, ...propertyIds, ...lotIds, ...promoterIds, ...bankIds];
        mediaToPurge = await tx.media.findMany({
          where: { OR: [{ id: { in: ids('media') } }, { ownerId: { in: ownerIds } }] },
          select: { id: true, ownerType: true, ownerId: true, storageKey: true },
        });
        const mediaIds = mediaToPurge.map((m) => m.id);
        await tx.promoter.updateMany({ where: { logoMediaId: { in: mediaIds } }, data: { logoMediaId: null } });
        await tx.promoter.updateMany({ where: { coverMediaId: { in: mediaIds } }, data: { coverMediaId: null } });
        await tx.bank.updateMany({ where: { logoMediaId: { in: mediaIds } }, data: { logoMediaId: null } });
        await tx.lot.updateMany({ where: { planMediaId: { in: mediaIds } }, data: { planMediaId: null } });
        await tx.event.updateMany({ where: { coverMediaId: { in: mediaIds } }, data: { coverMediaId: null } });
        await done('event', eventIds, (await tx.event.deleteMany({ where: { id: { in: eventIds } } })).count);
        await done('media', mediaIds, (await tx.media.deleteMany({ where: { id: { in: mediaIds } } })).count);
        await done('lot', lotIds, (await tx.lot.deleteMany({ where: { id: { in: lotIds } } })).count);
        // The home comparison linked to a demo property by the demo command goes back to no property (ACC-040).
        const cmp = await tx.contentBlock.findUnique({ where: { key_locale: { key: 'home.comparison', locale: 'fr' } } });
        const cmpValue = cmp?.value && typeof cmp.value === 'object' && !Array.isArray(cmp.value) ? (cmp.value as Record<string, unknown>) : null;
        if (cmp && cmpValue && typeof cmpValue.propertyId === 'string' && propertyIds.includes(cmpValue.propertyId)) {
          await tx.contentBlock.update({ where: { id: cmp.id }, data: { value: { ...cmpValue, propertyId: null } as object, version: { increment: 1 }, updatedAt: now } });
          await writeAudit(tx, DEMO_ACTOR, now, { action: 'content.changed', entityType: 'content_block', entityId: cmp.id, entityLabel: 'home.comparison · propertyId' });
        }
        await done('property', propertyIds, (await tx.property.deleteMany({ where: { id: { in: propertyIds } } })).count);
        await done('program', programIds, (await tx.program.deleteMany({ where: { id: { in: programIds } } })).count);
        const orgIds = await existing(
          tx.organization.findMany({
            where: { OR: [{ id: { in: ids('organization') } }, { promoters: { some: { id: { in: promoterIds } } } }, { banks: { some: { id: { in: bankIds } } } }], type: { not: 'OPERATOR' } },
            select: { id: true },
          }),
        );
        await done('promoter', promoterIds, (await tx.promoter.deleteMany({ where: { id: { in: promoterIds } } })).count);
        await done('bank', bankIds, (await tx.bank.deleteMany({ where: { id: { in: bankIds } } })).count);
        await done('organization', orgIds, (await tx.organization.deleteMany({ where: { id: { in: orgIds } } })).count);
        // Communes added by the demo, if nothing else uses them.
        const cityIds = await existing(
          tx.city.findMany({ where: { id: { in: ids('city') }, programs: { none: {} }, properties: { none: {} }, promoters: { none: {} } }, select: { id: true } }),
        );
        await done('city', cityIds, (await tx.city.deleteMany({ where: { id: { in: cityIds } } })).count);
        // Outside production only: the property counter goes back to the highest reference still present (deleted
        // rows included), so that a new demo gets DP-DZ-0142 again. Only numbers of removed demo rows are given again.
        for (const seq of await tx.sequence.findMany({ where: { name: 'property' } })) {
          const rows = await tx.$queryRaw<{ n: number | null }[]>`
            SELECT MAX(CAST(substring(reference from '([0-9]+)$') AS int)) AS n FROM properties WHERE country_code = ${seq.scope}`;
          const n = rows[0]?.n ?? 0;
          if (n < seq.lastValue) await tx.sequence.update({ where: { name_scope: { name: 'property', scope: seq.scope } }, data: { lastValue: n, updatedAt: now } });
        }
      },
      { timeout: 120_000 },
    );
    for (const m of mediaToPurge) await s.pipeline.purgeFiles(m);
    for (const key of privateKeys) await s.storage.delete('private', key).catch(() => undefined);
    await s.notifier.committed(['catalogue', 'home', 'events', 'content']);
    await s.notifier.flush();
  } catch (err) {
    const e = err as { code?: string; message?: string };
    process.stderr.write(
      `Retrait en échec (rien n'a été supprimé) : ${e.code === 'P2003' || /foreign key/i.test(e.message ?? '') ? 'des objets hors démonstration (demandes, dossiers…) dépendent encore de ces fiches.' : (e.message ?? String(err))}\n`,
    );
    process.exitCode = 1;
  } finally {
    await s.close();
  }
  const lines = Object.entries(counts).filter(([, n]) => n > 0).map(([t, n]) => `${t} : ${n}`);
  if (!process.exitCode) process.stdout.write(lines.length ? `Données de démonstration retirées :\n- ${lines.join('\n- ')}\n` : 'Aucune donnée de démonstration à retirer.\n');
}

void main();
