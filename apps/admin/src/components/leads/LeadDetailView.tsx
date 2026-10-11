'use client';
// EA-11 — one request, in reading (package 2.11; CRM-010, CRM-012, MSG-021). Header: reference, kind, state, first
// contact, adviser. Three zones: what the person SENT (nothing of it can be changed), the CONTEXT (the property or the
// programme with its public page, the page it was sent from, origin and campaign, language, spam score and reasons),
// the CLIENT AND WHAT FOLLOWS — in text in this delivery: the client record, the dossier and the score arrive with
// their screens (3.3, 3.7); the other requests of the same client are links (this screen exists). Below: the timeline
// and the notes (BO-050, BO-055, package 3.1). The actions of CRM-011 arrive with package 3.2.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { LeadDetail } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Banner, Icon, StatusTag } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { DASH, money, shortDateTime, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { AVAILABILITY_TONE, CLIENT_STATUS_TONE, DOSSIER_STATUS_TONE, LEAD_STATUS_TONE, PUBLICATION_TONE } from '@/lib/tones';
import { DetailColumns, DetailPage } from '../shell/detail/DetailPage';
import { Facts, Surface } from '../shell/Page';
import { signalShellChanged, useShell } from '../shell/ShellContext';
import { Timeline } from '../shell/timeline/Timeline';
import { ExchangeActions } from '../exchanges/ExchangeActions';
import { isDeliveredPath } from '../shell/menu';
import { LeadActions } from './LeadActions';
import { PartnerApplicationPanel } from '../partner-applications/PartnerApplicationPanel';
import { callbackSlotLabel, fieldLabel, fieldValue, FirstContact } from './lead-parts';
import { leadPath } from './LeadsList';
import s from './leads.module.css';

const enumLabel = (name: string, value: string | null | undefined) => (value && hasMessage(`ui.enum.${name}.${value}`) ? t(`ui.enum.${name}.${value}` as MessageKey) : (value ?? null));

export function LeadDetailView({ lead, webUrl }: { lead: LeadDetail; webUrl: string }) {
  const { shell, timeZone, can } = useShell();
  const router = useRouter();
  const [timelineKey, setTimelineKey] = useState(0);
  const refresh = () => {
    setTimelineKey((k) => k + 1);
    router.refresh();
  };
  const masked = lead.sent.masked;
  const reserved = <span className={s.reserved}>{t('ui.admin-leads.reserved')}</span>;
  const hidden = <span className={s.reserved}>{t('ui.admin-leads.masked')}</span>;

  // NOT-032 — opening the object marks read the unread notifications that are about it.
  useEffect(() => {
    void adminCall('/admin/notifications/read', { body: { entityType: 'Lead', entityId: lead.id } }).then((r) => {
      if (r.ok) signalShellChanged();
    });
  }, [lead.id]);

  const person = lead.sent.person;
  const name = [person.lastName?.toLocaleUpperCase('fr'), person.firstName].filter(Boolean).join(' ') || null;
  const slot = lead.sent.callback ? callbackSlotLabel(lead.sent.callback.slot, lead.sent.callback.day, lead.sent.callback.callerTimezone, timeZone) : null;
  const seen = lead.sent.seen;
  const ctx = lead.context;
  const follow = lead.followUp;

  return (
    <DetailPage
      crumbs={[{ label: t('ui.admin-shell.menu.group.crm') }, { label: t('ui.admin-leads.title'), href: '/demandes' }, { label: lead.reference }]}
      title={t('ui.admin-leads.detail.title', { reference: lead.reference })}
      meta={
        <>
          <span>{t(`ui.enum.LeadKind.${lead.kind}`)}</span>
          <StatusTag tone={LEAD_STATUS_TONE[lead.status] ?? 'neutral'}>{t(`ui.enum.LeadStatus.${lead.status}`)}</StatusTag>
          {lead.outcome ? <span>{enumLabel('LeadOutcome', lead.outcome)}</span> : null}
          {lead.needsReview ? <StatusTag tone="warning">{t('ui.admin-leads.toReview')}</StatusTag> : null}
          <span className={s.metaItem}>
            <span className={s.metaLabel}>{t('ui.admin-leads.column.firstContact')}</span>
            <FirstContact value={lead.firstContact} workdayMinutes={shell.calendar.workdayMinutes} />
          </span>
          <span className={s.metaItem}>
            <span className={s.metaLabel}>{t('ui.admin-leads.column.agent')}</span>
            {lead.agentName ? (lead.mine ? t('ui.admin-leads.agentMe', { nom: lead.agentName }) : lead.agentName) : t('ui.admin-leads.unassigned')}
          </span>
        </>
      }
      actions={<LeadActions lead={lead} />}
      // CRM-012 — a request attached to a dossier is handled in the dossier; CYC-002 — a request during a dossier in progress waits for a decision
      notice={
        follow.dossier || follow.pendingDecision || follow.client?.restricted ? (
          <div className={s.notices}>
            {follow.dossier ? (
              <Banner tone="info">
                {t('ui.admin-leads.detail.followedInDossier', { reference: follow.dossier.reference })}{' '}
                {isDeliveredPath('/dossiers') ? (
                  <Link href={`/dossiers/${follow.dossier.reference.toLowerCase()}`} className={s.inlineLink}>
                    {t('ui.admin-leads.detail.openDossier')}
                  </Link>
                ) : null}
              </Banner>
            ) : null}
            {follow.pendingDecision ? <Banner tone="warning" title={t('ui.admin-leads.detail.pendingTitle')}>{t('ui.admin-leads.detail.pendingText')}</Banner> : null}
            {follow.client?.restricted ? <Banner tone="warning">{t('ui.admin-leads.detail.restricted')}</Banner> : null}
          </div>
        ) : undefined
      }
    >
      <DetailColumns columns={3}>
        {/* ─── Ce que la personne a envoyé ─── */}
        <Surface title={t('ui.admin-leads.sent.title')}>
          <div className={s.zone}>
            <p className={s.readOnly}>
              <Icon name="lock" size={16} />
              {t('ui.admin-leads.sent.readOnly', { date: shortDateTime(lead.createdAt, timeZone) })}
            </p>
            <Facts
              items={[
                { label: t('ui.admin-leads.sent.name'), value: name },
                { label: t('ui.admin-leads.sent.email'), value: person.email ? masked ? person.email : <a href={`mailto:${person.email}`}>{person.email}</a> : null },
                { label: t('ui.admin-leads.sent.phone'), value: person.phone ? masked ? person.phone : <a href={`tel:${person.phone}`}>{person.phone}</a> : null },
                ...(lead.sent.subject ? [{ label: t('ui.admin-leads.field.subject'), value: enumLabel('ContactSubject', lead.sent.subject) }] : []),
              ]}
            />
            {seen ? (
              <div className={s.seen}>
                <p className={s.blockLabel}>{t('ui.admin-leads.sent.seen')}</p>
                <p className={s.seenTitle}>{[seen.propertyReference, seen.propertyTitle ?? seen.programName].filter(Boolean).join(' · ')}</p>
                {seen.lotReference ? <p className={s.sub}>{t('ui.admin-leads.sent.lot', { lot: seen.lotReference })}</p> : null}
                {seen.price || seen.monthly ? (
                  <p className={s.seenFigures}>
                    {seen.price ? <span>{t('ui.admin-leads.sent.price', { montant: money(seen.price.amount, seen.price.currency) })}</span> : null}
                    {seen.monthly ? <span>{t('ui.admin-leads.sent.monthly', { montant: money(seen.monthly.amount, seen.monthly.currency) })}</span> : null}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div>
              <p className={s.blockLabel}>{t('ui.admin-leads.sent.message')}</p>
              {masked ? <p>{hidden}</p> : lead.sent.message ? <p className={s.message}>{lead.sent.message}</p> : <p className={s.none}>{t('ui.admin-leads.sent.noMessage')}</p>}
            </div>
            {lead.sent.callback ? (
              <Facts
                items={[
                  ...(lead.sent.callback.day ? [{ label: t('ui.admin-leads.field.preferredCallbackDate'), value: shortDay(lead.sent.callback.day) }] : []),
                  ...(slot ? [{ label: t('ui.admin-leads.field.preferredSlot'), value: slot }] : []),
                ]}
              />
            ) : null}
            {lead.sent.fields.length || lead.sent.withheld.length ? (
              <div>
                <p className={s.blockLabel}>{t('ui.admin-leads.sent.form')}</p>
                <Facts
                  columns={2}
                  items={[
                    ...lead.sent.fields.filter((f) => !['preferredCallbackDate', 'preferredSlot', 'subject'].includes(f.key)).map((f) => ({ label: fieldLabel(f.key), value: fieldValue(f) })),
                    // ROL-019 — a sensitive value the role may not read: « Réservé »
                    ...lead.sent.withheld.map((key) => ({ label: fieldLabel(key), value: reserved })),
                  ]}
                />
              </div>
            ) : null}
            {lead.sent.supplements.map((sup, i) => (
              <div key={`${sup.at}-${i}`} className={s.supplement}>
                <p className={s.blockLabel}>{t('ui.admin-leads.sent.supplement', { date: shortDateTime(sup.at, timeZone) })}</p>
                {sup.fields.length ? <Facts columns={2} items={sup.fields.map((f) => ({ label: fieldLabel(f.key), value: fieldValue(f) }))} /> : null}
                {sup.message ? <p className={s.message}>{sup.message}</p> : null}
              </div>
            ))}
          </div>
        </Surface>

        {/* ─── Contexte ─── */}
        <Surface title={t('ui.admin-leads.context.title')}>
          <div className={s.zone}>
            {ctx.property ? (
              <div className={s.object}>
                <p className={s.blockLabel}>{t('ui.admin-leads.context.property')}</p>
                <p className={s.seenTitle}>{`${ctx.property.reference} · ${ctx.property.title}`}</p>
                <p className={s.tags}>
                  <StatusTag tone={PUBLICATION_TONE[ctx.property.status] ?? 'neutral'}>{enumLabel('PublicationStatus', ctx.property.status)}</StatusTag>
                  {ctx.property.availability ? <StatusTag tone={AVAILABILITY_TONE[ctx.property.availability] ?? 'neutral'}>{enumLabel('Availability', ctx.property.availability)}</StatusTag> : null}
                </p>
                {ctx.property.publicPath ? (
                  <a className={s.external} href={`${webUrl}${ctx.property.publicPath}`} target="_blank" rel="noopener noreferrer">
                    {t('ui.admin-leads.context.publicPage')}
                    <Icon name="external-link" size={16} />
                  </a>
                ) : (
                  <p className={s.sub}>{t('ui.admin-leads.context.notPublished')}</p>
                )}
              </div>
            ) : null}
            {ctx.program ? (
              <div className={s.object}>
                <p className={s.blockLabel}>{t('ui.admin-leads.context.program')}</p>
                <p className={s.seenTitle}>{ctx.program.name}</p>
                {ctx.program.publicPath ? (
                  <a className={s.external} href={`${webUrl}${ctx.program.publicPath}`} target="_blank" rel="noopener noreferrer">
                    {t('ui.admin-leads.context.publicPage')}
                    <Icon name="external-link" size={16} />
                  </a>
                ) : (
                  <p className={s.sub}>{t('ui.admin-leads.context.notPublished')}</p>
                )}
              </div>
            ) : null}
            <Facts
              items={[
                { label: t('ui.admin-leads.column.source'), value: t(`ui.enum.LeadSource.${lead.source}`) },
                ...(ctx.submittedFromPath ? [{ label: t('ui.admin-leads.context.page'), value: <code className={s.path}>{ctx.submittedFromPath}</code> }] : []),
                ...(ctx.campaign && (ctx.campaign.source || ctx.campaign.campaign) ? [{ label: t('ui.admin-leads.context.campaign'), value: [ctx.campaign.source, ctx.campaign.medium, ctx.campaign.campaign].filter(Boolean).join(' · ') }] : []),
                ...(ctx.referrer ? [{ label: t('ui.admin-leads.context.referrer'), value: ctx.referrer }] : []),
                { label: t('ui.admin-leads.context.locale'), value: enumLabel('Locale', ctx.locale) },
                ...(ctx.hasSimulation ? [{ label: t('ui.admin-leads.context.simulation'), value: can('client.sensitive.read') ? t('ui.admin-leads.context.simulationJoined') : reserved }] : []),
              ]}
            />
            <div>
              <p className={s.blockLabel}>{t('ui.admin-leads.context.spam')}</p>
              <p className={s.spamScore}>
                <span className={s.spamValue}>{t('ui.admin-leads.context.spamScore', { n: ctx.spamScore })}</span>
              </p>
              {ctx.spamSignals.length ? (
                <ul className={s.signals}>
                  {ctx.spamSignals.map((sig) => (
                    <li key={sig}>{enumLabel('SpamSignal', sig)}</li>
                  ))}
                </ul>
              ) : (
                <p className={s.none}>{t('ui.admin-leads.context.noSignal')}</p>
              )}
            </div>
          </div>
        </Surface>

        {/* ─── Client et suite ─── */}
        <Surface title={t('ui.admin-leads.follow.title')}>
          <div className={s.zone}>
            {follow.alerts.length ? (
              <ul className={s.alerts}>
                {follow.alerts.map((a) => (
                  <li key={a}>
                    <Icon name="status-warning" size={16} />
                    {t(`ui.admin-leads.alert.${a}`)}
                  </li>
                ))}
              </ul>
            ) : null}
            <Facts
              items={[
                {
                  label: t('ui.admin-leads.follow.client'),
                  value: follow.client ? (
                    <span className={s.clientCell}>
                      <span className={s.tags}>
                        {follow.client.id && can('client.read') ? (
                          <Link href={`/clients/${follow.client.id}`} className={s.clientLink}>
                            {follow.client.name ?? DASH}
                            <Icon name="chevron-right" size={16} />
                          </Link>
                        ) : (
                          (follow.client.name ?? DASH)
                        )}
                        {follow.client.status ? <StatusTag tone={CLIENT_STATUS_TONE[follow.client.status] ?? 'neutral'}>{enumLabel('ClientStatus', follow.client.status)}</StatusTag> : null}
                      </span>
                      <span className={s.tags}>
                        {follow.client.scoreLevel ? (
                          <span className={`${s.score} ${s[`score${follow.client.scoreLevel}`] ?? ''}`} title={t('ui.admin-leads.follow.scoreHelp')}>
                            {t(`ui.admin-leads.scoreLevel.${follow.client.scoreLevel}`)} · {follow.client.score}
                          </span>
                        ) : null}
                        {follow.client.withoutEmail ? <StatusTag tone="warning">{t('ui.admin-leads.follow.withoutEmail')}</StatusTag> : null}
                        {follow.client.doNotContact ? <StatusTag tone="error" icon="lock">{t('ui.admin-leads.follow.doNotContact')}</StatusTag> : null}
                      </span>
                    </span>
                  ) : (
                    t('ui.admin-leads.follow.noClient')
                  ),
                },
                {
                  label: t('ui.admin-leads.follow.dossier'),
                  value: follow.dossier ? (
                    <span className={s.tags}>
                      {isDeliveredPath('/dossiers') ? (
                        <Link href={`/dossiers/${follow.dossier.reference.toLowerCase()}`} className={s.referenceLink}>
                          {follow.dossier.reference}
                        </Link>
                      ) : (
                        follow.dossier.reference
                      )}
                      <span>{enumLabel('DossierStage', follow.dossier.stage)}</span>
                      <StatusTag tone={DOSSIER_STATUS_TONE[follow.dossier.status] ?? 'neutral'}>{enumLabel('DossierStatus', follow.dossier.status)}</StatusTag>
                    </span>
                  ) : (
                    t('ui.admin-leads.follow.noDossier')
                  ),
                },
                // MSG-021 — a message sent by « Écrire à mon conseiller » from a dossier
                ...(follow.writtenFromDossier ? [{ label: t('ui.admin-leads.follow.origin'), value: t('ui.admin-leads.follow.writtenFrom', { reference: follow.writtenFromDossier }) }] : []),
                ...(lead.closedAt ? [{ label: t('ui.admin-leads.follow.closedAt'), value: shortDateTime(lead.closedAt, timeZone) }] : []),
                ...(lead.closeNote ? [{ label: t('ui.admin-leads.follow.closeNote'), value: <span className={s.preWrap}>{lead.closeNote}</span> }] : []),
                ...(follow.duplicates.length
                  ? [
                      {
                        label: t('ui.admin-leads.follow.duplicates'),
                        value: (
                          <span className={s.tags}>
                            {follow.duplicates.map((d) =>
                              d.name && can('client.read') ? (
                                <Link key={d.id} href={`/clients/${d.id}`} className={s.referenceLink}>
                                  {d.name}
                                </Link>
                              ) : (
                                <span key={d.id} className={s.sub}>
                                  {t('ui.admin-leads.follow.duplicateHidden')}
                                </span>
                              ),
                            )}
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            <div>
              <p className={s.blockLabel}>{t('ui.admin-leads.follow.others')}</p>
              {follow.otherLeads.length ? (
                <ul className={s.others}>
                  {follow.otherLeads.map((o) => (
                    <li key={o.reference}>
                      <Link href={leadPath(o.reference)} className={s.other}>
                        <span className={s.otherRef}>{o.reference}</span>
                        <span className={s.otherKind}>{t(`ui.enum.LeadKind.${o.kind}`)}</span>
                        <StatusTag tone={LEAD_STATUS_TONE[o.status] ?? 'neutral'}>{t(`ui.enum.LeadStatus.${o.status}`)}</StatusTag>
                        <span className={s.sub}>{shortDay(o.createdAt.slice(0, 10))}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={s.none}>{t('ui.admin-leads.follow.noOthers')}</p>
              )}
            </div>
          </div>
        </Surface>
      </DetailColumns>
      {lead.kind === 'PARTNER_REQUEST' ? <PartnerApplicationPanel leadId={lead.id} onChanged={refresh} /> : null}

      <Timeline
        key={timelineKey}
        endpoint={`/admin/leads/${lead.id}/timeline`}
        entity={{ type: 'LEAD', id: lead.id }}
        types={['LEAD', 'EMAIL', 'CALL', 'NOTE']}
        quickActions={lead.status === 'SPAM' ? undefined : <ExchangeActions target={{ leadId: lead.id, clientId: follow.client?.id ?? null, dossierId: null, personName: follow.client?.name ?? name }} onDone={refresh} />}
      />
    </DetailPage>
  );
}
