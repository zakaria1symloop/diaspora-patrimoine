# Automatisations — mode d'emploi pour les autres modules

Paquet 1.4 (`Specs/01-domaine/08-automatisations.md`). Ce dossier porte le **moteur** : exécution des règles,
planificateur, tâches du personnel, notifications du personnel, alertes techniques. Chaque module livre ensuite **ses**
événements, **ses** règles, **ses** tâches planifiées et **ses** modèles (AUT-083) en les *déclarant* ici — le moteur
n'importe aucun module métier.

`AutomationModule` est **global** : ses services s'injectent partout sans import de module.

| Fichier | Rôle |
|---|---|
| `event-catalogue.ts` | Liste des événements (AUT-010, AUT-013), forme commune (AUT-011), `domainEvent()` |
| `rule-definition.ts` | Schémas zod d'une règle : conditions, actions, champs permis (AUT-020, AUT-021, AUT-030) |
| `rule-engine.ts` | Exécution (AUT-004, AUT-005) : groupe `rules` de la boîte d'envoi, passé en **dernier** |
| `rule-context.ts` | Relecture des objets d'un événement, champs des conditions, champs dynamiques (AUT-036) |
| `rule-mail.ts` | Action `SEND_EMAIL` : destinataires, conditions d'arrêt, heures calmes, plafond, `NC_REMINDER` |
| `rule-actions.ts` | Actions `CREATE_TASK` et `NOTIFY_STAFF` |
| `rule-seeds.ts`, `template-seeds.ts` | Règles et modèles d'origine (installés par `install/workflow-rules.ts`) |
| `scheduler.ts`, `automation-jobs.ts` | Planificateur, `JobRun`, tâches de la plateforme, lignes de purge |
| `tasks.service.ts`, `task-effects.ts` | Tâches : cas d'usage, fermeture automatique (AUT-035), `task.assigned` |
| `staff-notifications.service.ts`, `staff-directory.ts`, `staff-links.ts` | Notifications `NS_*`, qui reçoit, liens |
| `tech-alerts.ts` | Alertes techniques (AUT-076) |
| `diagnostics.controller.ts` | `GET /admin/diagnostics/jobs`, `…/jobs/:name/runs`, `POST /admin/diagnostics/run-job` |

---

## 1. Émettre un événement

Dans la **transaction** de l'action (FIA-040), jamais après :

```ts
import { domainEvent } from '../automation/event-catalogue.js';

await this.outbox.add(tx, domainEvent({
  type: 'lead.first_contact',
  aggregate: { type: 'Lead', id: lead.id },        // nom du modèle Prisma
  actor: { type: 'USER', id: actor.userId },
  clientId: lead.clientId, dossierId: lead.dossierId, // chaque fois qu'ils existent (AUT-011)
  data: { channel: 'PHONE' },                        // seulement les « Données » d'AUT-010 : des identifiants, pas de copie
  requestId: currentRequestId(),                     // NOT-035 : un geste = une notification
}), now);
this.dispatcher.wake(); // après le commit
```

Les émetteurs écrits avant le moteur mettent leurs données directement dans `payload` : le moteur lit les deux formes
(`toEnvelope`). Tout **nouvel** émetteur passe par `domainEvent()`.

Un fait de **surveillance** (⏱, AUT-012) se dépose avec sa clé, depuis une tâche planifiée :

```ts
import { emitFact } from '../automation/automation-jobs.js';
await emitFact(tx, now, { type: 'reservation.option_expiring', aggregate: { type: 'Reservation', id }, dossierId, jobRunId: ctx.jobRunId,
  dedupeKey: `reservation.option_expiring:${id}:${optionExpiresAt.toISOString()}` }); // false : déjà signalé
```

## 2. Déclarer un nouveau type d'événement

1. Il doit figurer dans AUT-010 (sinon : question Q-nnn, ou AUT-013 pour un événement technique).
2. Ajoute sa ligne à `DOMAIN_EVENTS` (`event-catalogue.ts`, liste en ajout seul) : modèle de l'objet, noms des données,
   `s(…)` pour un événement ⏱. Un événement technique va dans `TECHNICAL_EVENTS` : aucune règle ne s'y abonne.
3. Si son objet est un modèle nouveau pour les règles, ajoute-le à `OBJECTS_BY_AGGREGATE` (`rule-definition.ts`) et sa
   résolution à `RuleContextLoader.load` ; ses champs de condition à `CONDITION_FIELDS`, ses champs de titre à
   `VAR_COLUMNS`. **Une colonne absente de `VAR_COLUMNS` ne peut pas entrer dans un titre** : c'est voulu.
4. Les effets système de l'événement (notification du catalogue, e-mail d'événement) restent dans **ton** module, comme
   aujourd'hui : `handlers.register({ name, types, handle })`. Le groupe des règles passe après (`order: 100`).

## 3. Ajouter une règle livrée d'origine

Une entrée dans `RULE_SEEDS` (`rule-seeds.ts`), tirée de sa ligne du § 5 de la spec :

```ts
{
  code: 'R_OFFER_PRESENT', name: "Offre de banque à présenter",        // ≤ 60 caractères
  description: 'Tâche « Présenter l'offre de {banque} à {client} », CALL, HIGH, échéance 2 jours ouvrés, clé offer-present:{submissionId}.',
  trigger: 'submission.approved', conditions: null, delayValue: 0, delayUnit: 'MINUTES',
  actions: [{ type: 'CREATE_TASK', title: "Présenter l'offre de {{bank.name}} à {{client.fullName}}", taskType: 'CALL',
              priority: 'HIGH', dueInBusinessDays: 2, dedupeKey: 'offer-present:{{submission.id}}' }],
  sortOrder: 210,
}
```

- **Conditions** : `{ all: [...] }` ou `{ any: [...] }`, deux niveaux ; opérateurs `eq neq in nin gt gte lt lte isNull
  isNotNull contains`. Elles sont évaluées à l'événement **et** de nouveau à l'échéance (AUT-004).
- **Actions**, dans cet ordre quand la règle crée une tâche et alerte : `CREATE_TASK` **puis** `NOTIFY_STAFF` (l'alerte
  prend le titre de la tâche si elle n'en a pas, ouvre la tâche, et n'est pas répétée si la tâche existait déjà).
- `SEND_EMAIL` : `template`, `to` (`CLIENT`, `REGISTRANT`, `REGISTRANTS`, `ATTENDEES`, `NOTIFY_REQUESTS`, un conseiller,
  `ADMINS`, `OWNERS`), `respectQuietHours`, `skipWhenOnHold`, `dedupeWindowHours`, `dedupeKey`, `registeredBeforeHours`,
  `markField`.
- `CREATE_TASK` : sans `assignee`, le conseiller du dossier, à défaut celui de la demande, à défaut le référent, à
  défaut l'équipe ; sans échéance, un jour ouvré. `dueInBusinessDays` accepte `{ "setting": "partner.applicationReviewDays" }`.
- `NOTIFY_STAFF` : `recipients`, et `fallback` pour un « à défaut » autre que `ADMINS`.
- Test obligatoire : `parseRuleDefinition` valide toutes les graines (`test/automation.test.ts`), et un test de la règle
  sur la base, annulé à la fin (`test/automation.int.test.ts`, citer `AUT-0xx / R_…`).
- Puis `node --env-file=.env dist/install/install.js` : la règle est créée active ; une règle déjà ajustée par l'équipe
  n'est jamais réécrite (PAR-081).

**Le modèle d'e-mail de ta règle** se sème avec les tiens (`TemplateSeed`). S'il cite des champs que les objets de
l'événement ne donnent pas, déclare-les (dans `onModuleInit`) :

```ts
constructor(private readonly ruleMails: RuleMailComposers) {}
this.ruleMails.compose('C_OPTION_EXPIRING', async ({ ctx, recipient, vars, now }) => ({ vars: { reservation: { expiresLabel } } }));
// ou, si l'e-mail doit partir par ta propre chaîne (jeton produit à l'envoi) :
this.ruleMails.send('C_ACCOUNT_ACTIVATION_REMINDER', ({ ctx, dedupeKey }) => this.auth.send({ … dedupeKey }, dedupeKey));
```

Le moteur fournit déjà : les objets de l'événement (`lead`, `client`, `dossier`, `cafe`…), `company.*`, `advisor.*`,
`client.firstName` / `staff.firstName`, `lead.agentLabel`, `action.adminUrl`, `rule.delayLabel`, `event.data.*`.

**Fermeture automatique** (AUT-035) — la ligne de ta clé, dans `onModuleInit` :

```ts
constructor(private readonly autoClose: TaskAutoClose) {}
this.autoClose.on('submission.offer_accepted', (e) => [{ keys: [`offer-present:${e.aggregate.id}`], outcome: 'DONE', reason: t('ui.automation.close.…') }]);
```

## 4. Déclarer une tâche planifiée, une ligne de purge

```ts
constructor(private readonly scheduler: Scheduler) {}
onModuleInit() {
  this.scheduler.register({ name: 'reservation.scan', schedule: { everyMinutes: 15 }, run: (ctx) => this.scan(ctx) });
  this.scheduler.register({ name: 'digest.staff', schedule: { dailyAt: '08:30', businessDaysOnly: true }, run: … });
  this.scheduler.registerPurge('notifications', async (now) => (await this.prisma.notification.deleteMany({ … })).count);
}
```

`run` rend ses compteurs ; lever une erreur marque le passage `FAILED` et déclenche l'alerte technique. `ctx.lastRunAt`
est le début du passage précédent, `ctx.jobRunId` l'origine à poser sur les événements émis. Une tâche doit être
**rejouable** (clés d'AUT-012), travailler par paquets de 500 (`SCAN_BATCH`) et lire l'heure par `Clock`. Aucun
`setInterval` dans un module : le planificateur est le seul minuteur (hors `outbox.dispatch` et le report des vues).

## 5. Créer une tâche, une notification

```ts
// Tâche créée par une personne (écran EA-30, paquet 3.8) — dans la transaction du cas d'usage
const { id } = await this.tasks.create(tx, actor, now, { title, assigneeId, dueAt, dueHasTime: false, timeZone, origin: 'MANUAL', links: { dossierId } });
await this.tasks.assign(tx, actor, now, id, colleagueId);   // « prendre » : assign(…, actor.userId)
await this.tasks.complete(tx, actor, now, id, note);        // cancel(…, reason) · reopen(…)

// Tâche d'un effet du système (NOT-025, CYC-009…) : depuis un groupe de la boîte d'envoi, jamais dans la transaction du geste (AUT-002)
await this.tasks.create(this.prisma, SYSTEM_ACTOR, now, { title, assigneeId, timeZone, origin: 'SYSTEM', dedupeKey: `client-notify:${code}:${objectId}`, links });
await this.tasks.closeAutomatically(this.prisma, now, [`lead-contact:${leadId}`], 'DONE', raison);
```

Droits de TAC-004 appliqués par le service (l'affecté, l'auteur, ou `task.manage.all`). Audit `task.created` /
`task.updated`. Confier une tâche à quelqu'un d'autre émet `task.assigned` → `NS_TASK_ASSIGNED` et `S_TASK_ASSIGNED`.

```ts
// Notification du catalogue (NOT-030 § 3.2), depuis le groupe de ton événement
const { notified } = await this.notifier.notify(this.prisma, now, {
  type: 'NS_LEAD_NEW', userIds, title: t('ui.notifications.NS_LEAD_NEW…', {…}),   // texte de la spec, par clé i18n
  link: staffLink('Lead', lead), entityType: 'Lead', entityId: lead.id,           // l'objet que le lien ouvre (NOT-032)
  originId: toEnvelope(event).originId,                                           // NOT-035
  exceptUserId: event.actor?.id,                                                  // NOT-018
});
```

`StaffDirectory.load(db, now)` donne les comptes actifs ; `.resolve(['DOSSIER_AGENT', 'ADMINS'], agentIds)` applique
NOT-018 (conseiller qui ne peut pas agir → `ADMINS` ; absent → lui et les `ADMINS`). Types regroupés (NOT-016) :
`NS_DOC_RECEIVED`, `NS_MESSAGE_NEW` — passer `titlePlural`. Une notification du catalogue écrite pour un événement
remplace d'elle-même l'alerte d'une règle sans délai et `NS_TASK_AUTO` pour la même personne.

Alerte technique : `await this.alerts.raise({ cause: 'queue:documents', label, details, reference })` — une par heure et
par cause, sans donnée personnelle.

---

## Ce qui est semé aujourd'hui

**Règles actives (16)** : `R_PARTNER_APPLICATION_SUBMITTED`, `R_LEAD_NOT_TAKEN`, `R_LEAD_DURING_DOSSIER`,
`R_LEAD_SLA_WARNING`, `R_LEAD_SLA_BREACHED`, `R_CONSENT_WITHDRAWN`, `R_DOC_REVIEW`, `R_DOC_OPERATOR_REJECTED`,
`R_CLIENT_RESURFACED`, `R_VERIFICATION_REMINDER`, `R_CAFE_OPENING`, `R_CAFE_REMINDER_7D`, `R_CAFE_REMINDER_1D`,
`R_CAFE_LOW_FILL`, `R_CAFE_MISSED`, `R_CAFE_CALLBACK`.

**Paquets 3.7 et 3.8** (`rule-seeds-dossier.ts`, `rule-seeds-agenda.ts`) : `R_QUALIFIED_NO_PROPOSAL`,
`R_PROPOSAL_REMINDER`, `R_PROPOSAL_FEEDBACK`, `R_SELECTION_REQUESTED`, `R_HOLD_ACTIVITY`, `R_SELECTED_UNAVAILABLE`,
`R_VISIT_UNAVAILABLE`, `R_HOLD_ENDED`, `R_DOSSIER_INACTIVE`, `R_DOSSIER_SLA_BREACHED`, `R_TESTIMONIAL`,
`R_MESSAGE_UNANSWERED` (son événement vient avec la messagerie, Q-082) ; `R_APPOINTMENT_CONFIRM`,
`R_APPOINTMENT_REMINDER`, `R_APPOINTMENT_OUTCOME`, `R_APPOINTMENT_NO_SHOW`, `R_VISIT_HOST_CANCELLED`,
`R_VISIT_HOST_RESCHEDULED`, `R_EMAIL_BOUNCED` (`client.email_bounced` sans émetteur tant que le retour du fournisseur
n'est pas branché, Q-082). Fermetures automatiques (AUT-035) : `dossiers-admin/dossier-jobs.ts`,
`tasks-admin/agenda-jobs.ts`.

**Tâches planifiées** : `workflow.execute` (1 min), `jobs.watchdog` (5 min), `sla.scan` (5 min, demandes),
`event.scan` (5 min, `events/event-scan.ts`), `alerts.instant` (15 min), `alerts.daily` (8 h), `favorites.watch`
(15 min), `favorites.daily` (8 h), `purge` (4 h 30 : clés d'idempotence, événements traités, exécutions de règles,
`JobRun`, jetons, sessions, conversations de l'assistant).
Paquets 3.7, 3.8 : `dossier.scan` (15 min : étape en retard, dossier inactif, fin de pause prévue), `appointment.scan`
(15 min : à confirmer, rappels, issue à renseigner), `task.scan` (5 min : `NS_TASK_DUE`, adresse corrigée),
`digest.staff` (8 h 30, jours ouvrés : résumé du matin `S_DAILY_DIGEST`).

## Règles à venir (avec leur paquet)

| Paquet | Règles | Ce qui manque |
|---|---|---|
| 3.2 Demandes | `R_LEAD_RELEASED`, `R_CALL_MISSED` | `lead.released`, `communication.call_logged`, `C_CALL_MISSED` |
| 3.5 Catalogue | `R_LISTING_ERROR`, `R_STOCK_CHECK`, `R_DELIVERY_OVERDUE`, `R_PROGRAM_SOLD_OUT` | événements et tâches du catalogue |
| 4.2 Pièces | `R_DOC_REMINDER`, `R_DOC_REMINDERS_EXHAUSTED`, `R_DOC_EXPIRING`, `R_DOC_OPERATOR_EXPIRED` | `document.reminders`, `document.expiry` |
| 4.3 Pipeline | `R_ACTIVATION_REMINDER` | `C_ACCOUNT_ACTIVATION_REMINDER` et son lien |
| 4.4 Réservation | `R_OPTION_*`, `R_LOT_TAKEN_BACK`, `R_PROMOTER_RELEASE`, `R_RESERVATION_CONTRACT`, `R_DEPOSIT_REFUND`, `R_LOT_IMPORT_CONFLICT`, `R_ACQUISITION_LOT_LOST` | `reservation.scan` |
| 4.7 Banques | `R_BANK_FOLLOW_UP`, `R_SHARE_NOT_DOWNLOADED`, `R_INFO_REQUEST_STALE`, `R_SUBMISSION_SEND_FAILED`, `R_OFFER_*`, `R_ALL_BANKS_DECLINED`, `R_DECISION_CORRECTED`, `R_CONSENT_MISSING` | `submission.scan` |
| Le Café (back-office) | `R_CAFE_CHECKIN_MISSING` | l'écran de pointage (l'événement `event.checkin_missing` est déjà émis) |
| 5.x Enquêtes | `R_CAFE_THANKS`, `R_FEEDBACK_*`, action `SEND_SURVEY` | `survey.url`, les enquêtes |
| 6.x | `R_CONVENTION_EXPIRING`, `R_PARTNER_DOC_EXPIRING`, `R_PRODUCT_CHECK`, `R_DELETION_REQUESTED` | `partner.scan`, `gdpr.scan` |

## Ce qui tient lieu de Redis (AUT-084, ARC-075)

Le minuteur du planificateur et celui de la boîte d'envoi tournent dans le processus (rôles `worker` et `all`, et `api`
en local). Les garanties ne dépendent pas d'eux : verrou consultatif PostgreSQL pour qu'une tâche ne tourne que sur une
instance, clés d'unicité pour qu'aucun effet ne parte deux fois, lignes `WorkflowExecution` pour les délais et les
nouveaux essais. Une file BullMQ appellera `Scheduler.tick()` et `RuleEngine.runDue()` sans rien changer d'autre.
