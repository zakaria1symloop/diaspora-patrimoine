// PAR-080 — installation command: one transaction, replayable without duplicates (natural keys), never rewrites what
// an administrator changed (PAR-081). Run: pnpm --filter @dp/api install:run  (after `prisma migrate deploy`).
// Creates only what the delivered modules need; no demonstration data (PAR-082).
import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js';
import countryToCurrency from 'country-to-currency';
import ct from 'countries-and-timezones';
import { contentBlocks } from '@dp/contracts';
import { PrismaClient } from '../generated/prisma/client.js';
import { newId } from '../platform/ids.js';
import { slugify } from '../platform/slug.js';
import { EXCHANGE_RATE, HOLIDAYS, LEGAL_TEXTS, LEGAL_VERSION, WILAYAS } from './reference-data.js';
import { installEmailTemplates } from './email-templates.js';

const report: string[] = [];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const now = new Date();
  const stamps = { createdAt: now, updatedAt: now };

  await prisma.$transaction(
    async (tx) => {
      // MOD-102 — the operator organisation.
      const org = await tx.organization.findUnique({ where: { slug: 'diaspora-patrimoine' } });
      if (!org) {
        await tx.organization.create({
          data: { id: newId(), type: 'OPERATOR', name: 'Diaspora Patrimoine', slug: 'diaspora-patrimoine', ...stamps },
        });
        report.push('Organisation créée.');
      }

      // PAR-020 — all ISO 3166-1 countries; DZ is the only catalogue country (Q-011).
      const names = new Intl.DisplayNames(['fr'], { type: 'region' });
      const namesEn = new Intl.DisplayNames(['en'], { type: 'region' });
      const namesAr = new Intl.DisplayNames(['ar'], { type: 'region' });
      const currencies = countryToCurrency as unknown as Record<string, string>;
      const codes = getCountries()
        .filter((c) => /^[A-Z]{2}$/.test(c) && currencies[c] && ct.getCountry(c)?.timezones?.length)
        .sort((a, b) => (names.of(a) ?? a).localeCompare(names.of(b) ?? b, 'fr'));
      const countryRows = codes.map((code, i) => ({
        code,
        nameFr: (names.of(code) ?? code).slice(0, 80),
        nameEn: namesEn.of(code)?.slice(0, 80) ?? null,
        nameAr: namesAr.of(code)?.slice(0, 80) ?? null,
        currency: currencies[code]!,
        phonePrefix: `+${getCountryCallingCode(code)}`,
        timezone: code === 'DZ' ? 'Africa/Algiers' : code === 'FR' ? 'Europe/Paris' : ct.getCountry(code)!.timezones[0]!,
        regionLabelFr: code === 'DZ' ? 'Wilaya' : 'Région',
        cityLabelFr: code === 'DZ' ? 'Commune' : 'Ville',
        isCatalogueActive: code === 'DZ',
        isResidenceOption: true,
        sortOrder: (i + 1) * 10,
        ...stamps,
      }));
      const createdCountries = await tx.country.createMany({ data: countryRows, skipDuplicates: true });
      if (createdCountries.count) report.push(`${createdCountries.count} pays créés.`);

      // PAR-021 — 58 wilayas; PAR-022 — without the communes file, one chief-town commune per wilaya.
      let regionsCreated = 0;
      let citiesCreated = 0;
      for (const [i, [code, name]] of WILAYAS.entries()) {
        const slug = slugify(name);
        let region = await tx.region.findUnique({ where: { countryCode_code: { countryCode: 'DZ', code } } });
        if (!region) {
          region = await tx.region.create({
            data: { id: newId(), countryCode: 'DZ', code, nameFr: name, slug, isActive: true, sortOrder: (i + 1) * 10, ...stamps },
          });
          regionsCreated++;
        }
        const city = await tx.city.findUnique({ where: { regionId_slug: { regionId: region.id, slug } } });
        if (!city) {
          await tx.city.create({ data: { id: newId(), regionId: region.id, nameFr: name, slug, isActive: true, ...stamps } });
          citiesCreated++;
        }
      }
      if (regionsCreated) report.push(`${regionsCreated} wilayas créées.`);
      if (citiesCreated) report.push(`${citiesCreated} communes chefs-lieux créées (fichier des communes absent, PAR-022).`);

      // PAR-031 — holidays.
      const createdHolidays = await tx.holiday.createMany({
        data: HOLIDAYS.map((h) => ({ id: newId(), date: new Date(`${h.date}T00:00:00Z`), label: h.label, recurring: h.recurring, ...stamps })),
        skipDuplicates: true,
      });
      if (createdHolidays.count) report.push(`${createdHolidays.count} jours fériés créés.`);

      // PAR-042 — starting exchange rate, only if no rate exists for the pair.
      const rate = await tx.exchangeRate.findFirst({ where: { fromCurrency: EXCHANGE_RATE.from, toCurrency: EXCHANGE_RATE.to } });
      if (!rate) {
        await tx.exchangeRate.create({
          data: {
            id: newId(),
            fromCurrency: EXCHANGE_RATE.from,
            toCurrency: EXCHANGE_RATE.to,
            kind: EXCHANGE_RATE.kind,
            rate: EXCHANGE_RATE.rate,
            asOf: new Date(now.toISOString().slice(0, 10)),
            source: EXCHANGE_RATE.source,
            ...stamps,
          },
        });
        report.push('Taux de change de départ créé (exemple indicatif, PAR-042).');
      }

      // CMS-020, PAR-081 — blocks of the delivered screens; an existing block is never rewritten.
      let blocksCreated = 0;
      for (const [key, decl] of Object.entries(contentBlocks)) {
        const existing = await tx.contentBlock.findUnique({ where: { key_locale: { key, locale: 'fr' } } });
        if (existing) continue;
        await tx.contentBlock.create({
          data: {
            id: newId(),
            key,
            locale: 'fr',
            type: decl.type,
            value: (decl.origin ?? null) as never,
            originValue: (decl.origin ?? null) as never,
            label: decl.label,
            group: decl.group,
            ...stamps,
          },
        });
        blocksCreated++;
      }
      if (blocksCreated) report.push(`${blocksCreated} blocs de contenu créés.`);

      // PAR-083 — provisional legal texts, in force from installation.
      for (const doc of LEGAL_TEXTS) {
        const existing = await tx.legalDocument.findFirst({ where: { type: doc.type, locale: 'fr' } });
        if (existing) continue;
        await tx.legalDocument.create({
          data: {
            id: newId(),
            type: doc.type,
            version: LEGAL_VERSION,
            locale: 'fr',
            title: doc.title,
            body: doc.body,
            effectiveAt: now,
            publishedAt: now,
            requiresReacceptance: true,
            ...stamps,
          },
        });
        report.push(`Texte légal publié : ${doc.title} (${LEGAL_VERSION}).`);
      }

      // NOT-060 — e-mail templates of the delivered modules (missing ones only, PAR-081).
      report.push(...(await installEmailTemplates(tx, now)));
      report.push(...(await (await import('./auth-email-templates.js')).installAuthEmailTemplates(tx, now))); // § 4.1 account & security
      // AUT § 5, PAR-081 — automation rules of the delivered modules (after their e-mail templates).
      report.push(...(await (await import('./workflow-rules.js')).installWorkflowRules(tx, now)));

      // PAR-080, ADM-040 — the first Direction account, INVITED, from SEED_OWNER_* (all three together); its invitation
      // leaves from the outbox (the API sends it). Never a password.
      const seed = { email: process.env.SEED_OWNER_EMAIL, firstName: process.env.SEED_OWNER_FIRST_NAME, lastName: process.env.SEED_OWNER_LAST_NAME };
      if (seed.email || seed.firstName || seed.lastName) {
        const { createInvitedOwner, invitationRequest, normaliseOwner, ownerExists } = await import('./owner.js');
        if (!(await ownerExists(tx))) {
          const owner = normaliseOwner(seed);
          const userId = await createInvitedOwner(tx, owner, now, 'install');
          await tx.outboxEvent.create({
            data: { id: newId(), type: 'auth.email_requested', aggregateType: 'AuthMail', aggregateId: userId, payload: invitationRequest(userId, owner.email, 'Direction') as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now },
          });
          report.push(`Premier compte Direction invité : ${owner.email} (l’invitation part dès que l’API tourne).`);
        }
      }
      report.push(...(await (await import('./faq.js')).installFaq(tx, now))); // EDI-041 — starting FAQ questions
      report.push(...(await (await import('./checklist-template.js')).installChecklistTemplate(tx, now))); // PAR-050 — default piece list
    },
    { timeout: 120_000 },
  );
  report.push(...(await (await import('./content-media.js')).installContentMedia(prisma, now))); // PAR-080 — home images (MED-020), after the transaction

  await prisma.$disconnect();
  // ARC-040 — the site's cached pages learn that installation data appeared (best effort: the site may not run yet).
  if (report.length && process.env.WEB_URL && process.env.REVALIDATE_SECRET) {
    const { WebRevalidator } = await import('../admin/revalidation.js');
    const web = new WebRevalidator({ WEB_URL: process.env.WEB_URL, REVALIDATE_SECRET: process.env.REVALIDATE_SECRET });
    await web.revalidate(['settings', 'content', 'home', 'catalogue', 'events']);
  }
  process.stdout.write(report.length ? `Installation :\n- ${report.join('\n- ')}\n` : 'Installation : rien à créer, tout est en place.\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`Installation failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
