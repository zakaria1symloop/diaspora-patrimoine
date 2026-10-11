// PAR-080, PAR-081, AUT § 5 — starting data of the automation rules. Replayable without duplicates (key: `code`).
//   · a missing rule is created, active, `isSystem = true`, with its definition also kept in `originDefinition`;
//   · an existing rule whose definition still equals its original follows a newer original (text and definition);
//   · an existing rule the team adjusted keeps its conditions, its delay and its actions: only `originDefinition`
//     moves, so that the screen can offer « Rétablir le réglage d'origine » (COM-061);
//   · `isActive` is never touched once the rule exists: a rule the team disabled stays disabled.
// Every definition passes the validation of AUT-021 before it is written: a seed that does not is a defect of the code,
// and the installation stops.
import { Prisma } from '../generated/prisma/client.js';
import { canonicalJson, type Tx } from '../platform/tx.js';
import { newId } from '../platform/ids.js';
import { parseRuleDefinition, type RuleAction } from '../automation/rule-definition.js';
import { RULE_SEEDS, seedDefinition, type RuleSeed } from '../automation/rule-seeds.js';
import { typography } from './email-templates.js';

/** TRV-010 on the texts a rule shows (titles, descriptions); keys and codes are left untouched. */
function typeset(seed: RuleSeed): RuleSeed {
  const actions = seed.actions.map((a): RuleAction => {
    if (a.type === 'CREATE_TASK') return { ...a, title: typography(a.title), ...(a.description ? { description: typography(a.description) } : {}) };
    if (a.type === 'NOTIFY_STAFF') return { ...a, ...(a.title ? { title: typography(a.title) } : {}), ...(a.body ? { body: typography(a.body) } : {}) };
    return a;
  });
  return { ...seed, name: typography(seed.name).slice(0, 60), description: typography(seed.description).slice(0, 500), actions };
}

export async function installWorkflowRules(tx: Tx, now: Date, seeds: readonly RuleSeed[] = RULE_SEEDS): Promise<string[]> {
  const created: string[] = [];
  const updated: string[] = [];
  const originOnly: string[] = [];
  const missingTemplates = new Set<string>();
  for (const raw of seeds) {
    const seed = typeset(raw);
    const definition = seedDefinition(seed);
    const parsed = parseRuleDefinition(definition);
    if (!parsed.ok) throw new Error(`Rule seed ${seed.code} is invalid: ${parsed.issues.map((i) => `${i.code} ${i.path}`).join(', ')}`);
    for (const a of seed.actions) {
      if (a.type !== 'SEND_EMAIL') continue;
      const template = await tx.emailTemplate.findFirst({ where: { code: a.template, locale: 'fr', deletedAt: null }, select: { id: true } });
      if (!template) missingTemplates.add(a.template);
    }
    const data = { trigger: seed.trigger, conditions: (seed.conditions ?? undefined) as never, delayValue: seed.delayValue, delayUnit: seed.delayUnit, actions: seed.actions as never };
    const existing = await tx.workflowRule.findUnique({ where: { code: seed.code } });
    if (!existing) {
      const id = newId();
      await tx.workflowRule.create({
        data: { id, code: seed.code, name: seed.name, description: seed.description, ...data, isActive: true, isSystem: true, originDefinition: definition as never, sortOrder: seed.sortOrder, createdAt: now, updatedAt: now },
      });
      created.push(seed.code);
      // AUT-084 — the engine takes over the in-process stand-in of R_VERIFICATION_REMINDER: the sign-ups of the last
      // 24 hours, whose event was processed before the rule existed, get their pending execution (same e-mail key).
      if (seed.code === 'R_VERIFICATION_REMINDER') {
        const since = new Date(now.getTime() - 24 * 3_600_000);
        const events = await tx.outboxEvent.findMany({ where: { type: seed.trigger, occurredAt: { gt: since } }, select: { id: true, aggregateType: true, aggregateId: true, occurredAt: true } });
        if (events.length) {
          await tx.workflowExecution.createMany({
            data: events.map((e) => ({ id: newId(), ruleId: id, triggerEventId: e.id, entityType: 'Client', entityId: e.aggregateId, scheduledFor: new Date(e.occurredAt.getTime() + 24 * 3_600_000), status: 'PENDING' as const, createdAt: now, updatedAt: now })),
            skipDuplicates: true,
          });
        }
      }
      continue;
    }
    const current = canonicalJson({ trigger: existing.trigger, conditions: existing.conditions ?? null, delayValue: existing.delayValue, delayUnit: existing.delayUnit, actions: existing.actions });
    const origin = canonicalJson(existing.originDefinition ?? null);
    const next = canonicalJson(definition);
    if (origin === next) continue;
    if (current === origin) {
      await tx.workflowRule.update({ where: { id: existing.id }, data: { name: seed.name, description: seed.description, ...data, conditions: (seed.conditions ?? Prisma.DbNull) as never, originDefinition: definition as never, version: { increment: 1 }, updatedAt: now } });
      updated.push(seed.code);
    } else {
      await tx.workflowRule.update({ where: { id: existing.id }, data: { originDefinition: definition as never, updatedAt: now } });
      originOnly.push(seed.code);
    }
  }
  return [
    ...(created.length ? [`Règles d’automatisation créées : ${created.join(', ')}.`] : []),
    ...(updated.length ? [`Règles d’automatisation mises à jour (réglage d’origine) : ${updated.join(', ')}.`] : []),
    ...(originOnly.length ? [`Règles ajustées par l’équipe, réglage d’origine seul mis à jour : ${originOnly.join(', ')}.`] : []),
    ...(missingTemplates.size ? [`Attention : modèles d’e-mail absents pour des règles livrées : ${[...missingTemplates].join(', ')}.`] : []),
  ];
}
