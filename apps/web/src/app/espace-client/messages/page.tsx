// /espace-client/messages — « Messages » keeps this label at every delivery (ECL-001, D-096): before the messaging
// (livraison 5), its page is the short form of MSG-021, a delivered function. Every « Écrire », « Reprendre mon
// projet », « Au sujet de ce bien » button leads here with the origin of the button (`?depuis=`) and non-personal
// values (property reference and title, a date); the start of the message is composed from `ui.client.message.prefill`.
import Link from 'next/link';
import { CLIENT_MESSAGE_ORIGINS, type ClientInterests, type ClientMessageContext, type ClientMessageOrigin, type ClientSpaceSummary } from '@dp/contracts';
import { callbackLabel } from '@dp/i18n';
import { Icon } from '@dp/ui';
import type { MessageKey } from '@dp/i18n';
import { t } from '@/lib/i18n';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { PageHeader } from '@/components/client-space/PageHeader';
import { AdvisorMessageForm } from '@/components/client-space/message/AdvisorMessageForm';
import { advisorName, longDate } from '@/components/client-space/texts';
import { getSettings } from '@/lib/settings';
import k from '@/components/client-space/kit/kit.module.css';
import sp from '@/components/client-space/space.module.css';
import s from '@/components/client-space/message/message.module.css';

export const metadata = { title: t('ui.client.menu.messages') };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const clean = (v: string, max: number) => v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);

function prefillOf(origin: ClientMessageOrigin | null, query: Search): string {
  if (!origin) return '';
  const key = `ui.client.message.prefill.${origin}`;
  const bien = clean(one(query.bien), 120);
  const reference = clean(one(query.ref), 40).toUpperCase();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one(query.date)) ? longDate(one(query.date), 'UTC') : '';
  if ((origin === 'PROPERTY_ABOUT' || origin === 'PROPERTY_VISIT' || origin === 'PROPERTY_SELECT') && (!bien || !reference)) return '';
  if (origin === 'SIMULATION' && !date) return '';
  if (origin === 'DOCUMENTS' || origin === 'ADVISOR') return '';
  return t(key as MessageKey, { bien, reference, date });
}

const TONE: Record<string, string> = { NEW: sp.tagInfo!, IN_PROGRESS: sp.tagWarning!, CLOSED: sp.tagNeutral! };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  const [r, interests, space, settings] = await Promise.all([
    spaceGet<ClientMessageContext>('/client/advisor-contact'),
    spaceGet<ClientInterests>('/client/interests'),
    spaceGet<ClientSpaceSummary>('/client/space'),
    getSettings(),
  ]);
  if (!r.ok) return <SpaceReadFailure result={r} />;
  const raw = one(query.depuis);
  const origin = (CLIENT_MESSAGE_ORIGINS as readonly string[]).includes(raw) ? (raw as ClientMessageOrigin) : null;
  const dossier = /^[A-Z0-9-]{3,20}$/.test(one(query.dossier).toUpperCase()) ? one(query.dossier).toUpperCase() : null;
  const timeZone = space.ok ? space.data.timeZone : settings['business.calendar.timezone'];
  const name = advisorName(r.data.advisor);
  const quand = callbackLabel({ firstContactBusinessDays: settings['sla.firstContactBusinessDays'], timeZone });
  const open = interests.ok ? interests.data.requests.filter((q) => q.status !== 'CLOSED') : [];
  const phone = settings['contact.phone'] || null;
  const whatsapp = settings['contact.whatsapp'] || null;
  return (
    <>
      <PageHeader eyebrow={t('ui.client.message.eyebrow')} title={t('ui.client.menu.messages')} intro={t('ui.client.message.intro')} />
      <div className={s.page}>
        <AdvisorMessageForm context={r.data} prefill={prefillOf(origin, query)} origin={origin} dossier={dossier} />
        <div className={s.side}>
          {/* MSG-021 — what happens to a message, in three steps: the promise is the one of NOT-053. */}
          <section className={sp.block} aria-labelledby="comment">
            <h2 id="comment" className={sp.blockTitle}>
              {t('ui.client.message.how.title')}
            </h2>
            <ol className={s.how}>
              <li>{t('ui.client.message.how.1')}</li>
              <li>{name ? t('ui.client.message.how.2', { conseiller: name, quand }) : t('ui.client.message.how.2team', { quand })}</li>
              <li>{t('ui.client.message.how.3')}</li>
            </ol>
            {phone || whatsapp ? (
              <div className={s.other}>
                <p className={s.otherTitle}>{t('ui.client.message.other.title')}</p>
                {phone ? (
                  <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className={k.quiet}>
                    <Icon name="phone" size={20} />
                    {t('ui.client.message.other.phone', { telephone: phone })}
                  </a>
                ) : null}
                {whatsapp ? (
                  <a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`} className={k.quiet} target="_blank" rel="noopener noreferrer">
                    <Icon name="chat" size={20} />
                    {t('ui.client.message.other.whatsapp')}
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>
          {open.length ? (
            <section className={sp.block} aria-labelledby="en-cours">
              <div className={sp.blockHead}>
                <h2 id="en-cours" className={sp.blockTitle}>
                  {t('ui.client.message.open.title')}
                </h2>
                <span className={k.sectionCount}>{open.length}</span>
              </div>
              <ul role="list" className={s.open}>
                {open.slice(0, 3).map((q) => (
                  <li key={q.reference}>
                    <Link href={`/espace-client/interets#demande-${q.reference}`} className={`${s.openRow} ${k.linkCard}`}>
                      <span className={s.openText}>
                        <span className={s.openKind}>
                          {t(`ui.enum.LeadKind.${q.kind}` as MessageKey)}
                          {q.subject ? ` · ${q.subject}` : ''}
                        </span>
                        {/* D-107 — what he wrote: the message he sent is found again here, not only its date */}
                        {q.message ? <span className={s.openExcerpt}>{q.message}</span> : null}
                        <span className={s.openMeta}>{t('ui.client.interests.request.sentOn', { date: longDate(q.createdAt, timeZone) })}</span>
                        <span className={`${sp.tag} ${TONE[q.status]}`}>
                          {q.status === 'IN_PROGRESS'
                            ? advisorName(q.advisor)
                              ? t('ui.client.interests.request.IN_PROGRESS', { conseiller: advisorName(q.advisor)! })
                              : t('ui.client.interests.request.IN_PROGRESS_team')
                            : t('ui.client.interests.request.NEW')}
                        </span>
                      </span>
                      <span className={k.go} aria-hidden="true">
                        <Icon name="chevron-right" size={20} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/espace-client/interets#demandes" className={sp.blockLink}>
                {t('ui.client.message.open.all')}
                <Icon name="chevron-right" size={16} />
              </Link>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
