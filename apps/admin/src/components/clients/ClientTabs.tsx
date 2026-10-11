'use client';
// CRM-046 — the tabs of a client record that read lists: requests, dossiers, favourites and alerts, Cafés, feedback,
// trusted persons (PRO-040, edited by the team), agreements (the history of consents). Each loads on demand (BO-083)
// and says plainly when it is empty.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import type { ClientConsentRow, ClientContactsTab, ClientDossierRow, ClientFavoritesTab, ClientFeedbackRow, ClientLeadRow, ClientRegistrationRow, TrustedPerson } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Banner, Button, EmptyState, Menu, Modal, Skeleton, StatusTag, useToast, type IconName } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { DASH, shortDate, shortDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { DOSSIER_STATUS_TONE, LEAD_STATUS_TONE } from '@/lib/tones';
import { PhoneLinks } from '../exchanges/ExchangeActions';
import { isDeliveredPath } from '../shell/menu';
import { useShell } from '../shell/ShellContext';
import { Checkbox, TextArea, TextInput, formStyles as f } from '../shell/forms';
import s from './clients.module.css';

const label = (key: string, fallback?: string) => (hasMessage(key) ? t(key as MessageKey) : (fallback ?? key.split('.').pop() ?? key));

function useTab<T>(path: string): { data: T | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    void adminCall<T>(path).then((r) => {
      if (r.ok) setData(r.data);
      else setError(errorText(r));
    });
  }, [path]);
  useEffect(() => load(), [load]);
  return { data, error, reload: load };
}

function Frame({ error, loading, empty, emptyIcon, emptyTitle, emptyText, children }: { error: string | null; loading: boolean; empty: boolean; emptyIcon: IconName; emptyTitle: string; emptyText?: string; children: ReactNode }) {
  if (error) return <Banner tone="error">{error}</Banner>;
  if (loading) return <Skeleton width="100%" height="8rem" />;
  if (empty) return <EmptyState icon={emptyIcon} title={emptyTitle} text={emptyText} />;
  return <>{children}</>;
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function LeadsTab({ clientId }: { clientId: string }) {
  const { timeZone } = useShell();
  const { data, error } = useTab<{ data: ClientLeadRow[] }>(`/admin/clients/${clientId}/leads`);
  return (
    <Frame error={error} loading={!data} empty={data?.data.length === 0} emptyIcon="mail" emptyTitle={t('ui.admin-clients.tabs.noLeads')}>
      <Table head={[t('ui.admin-clients.tabs.reference'), t('ui.admin-clients.tabs.received'), t('ui.admin-clients.tabs.kind'), t('ui.admin-clients.tabs.object'), t('ui.admin-clients.tabs.agent'), t('ui.admin-clients.tabs.status')]}>
        {data?.data.map((l) => (
          <tr key={l.reference}>
            <td>
              <Link href={`/demandes/${l.reference.toLowerCase()}`} className={s.refLink}>
                {l.reference}
              </Link>
            </td>
            <td>{shortDateTime(l.createdAt, timeZone)}</td>
            <td>{label(`ui.enum.LeadKind.${l.kind}`)}</td>
            <td>{l.object ?? DASH}</td>
            <td>{l.agentName ?? DASH}</td>
            <td>
              <span className={s.cellTags}>
                <StatusTag tone={LEAD_STATUS_TONE[l.status] ?? 'neutral'}>{label(`ui.enum.LeadStatus.${l.status}`)}</StatusTag>
                {l.outcome ? <span className={s.muted}>{label(`ui.enum.LeadOutcome.${l.outcome}`)}</span> : null}
              </span>
            </td>
          </tr>
        ))}
      </Table>
    </Frame>
  );
}

export function DossiersTab({ clientId }: { clientId: string }) {
  const { timeZone } = useShell();
  const { data, error } = useTab<{ data: ClientDossierRow[] }>(`/admin/clients/${clientId}/dossiers`);
  const linked = isDeliveredPath('/dossiers');
  return (
    <Frame error={error} loading={!data} empty={data?.data.length === 0} emptyIcon="folder" emptyTitle={t('ui.admin-clients.tabs.noDossiers')} emptyText={t('ui.admin-clients.tabs.noDossiersText')}>
      <Table head={[t('ui.admin-clients.tabs.reference'), t('ui.admin-clients.tabs.opened'), t('ui.admin-clients.tabs.stage'), t('ui.admin-clients.tabs.property'), t('ui.admin-clients.tabs.agent'), t('ui.admin-clients.tabs.status')]}>
        {data?.data.map((d) => (
          <tr key={d.reference}>
            <td>{linked ? <Link href={`/dossiers/${d.reference.toLowerCase()}`} className={s.refLink}>{d.reference}</Link> : <strong>{d.reference}</strong>}</td>
            <td>{shortDate(d.createdAt, timeZone)}</td>
            <td>{label(`ui.enum.DossierStage.${d.stage}`)}</td>
            <td>{d.propertyTitle ?? DASH}</td>
            <td>{d.agentName ?? DASH}</td>
            <td>
              <StatusTag tone={DOSSIER_STATUS_TONE[d.status] ?? 'neutral'}>{label(`ui.enum.DossierStatus.${d.status}`)}</StatusTag>
            </td>
          </tr>
        ))}
      </Table>
    </Frame>
  );
}

export function FavoritesTab({ clientId }: { clientId: string }) {
  const { timeZone } = useShell();
  const { data, error } = useTab<ClientFavoritesTab>(`/admin/clients/${clientId}/favorites`);
  return (
    <Frame error={error} loading={!data} empty={Boolean(data && !data.favorites.length && !data.alerts.length)} emptyIcon="heart" emptyTitle={t('ui.admin-clients.tabs.noFavorites')}>
      {data ? (
        <div className={s.twoCols}>
          <section>
            <h3 className={s.subTitle}>{t('ui.admin-clients.tabs.favorites', { n: data.favorites.length })}</h3>
            {data.favorites.length ? (
              <ul className={s.cards}>
                {data.favorites.map((fav) => (
                  <li key={fav.reference} className={s.miniCard}>
                    <strong>
                      {fav.reference} · {fav.title}
                    </strong>
                    <span className={s.muted}>{t('ui.admin-clients.tabs.addedOn', { date: shortDate(fav.addedAt, timeZone) })}</span>
                    {fav.publicPath ? <span className={s.muted}>{fav.publicPath}</span> : <span className={s.muted}>{t('ui.admin-clients.tabs.unpublished')}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.muted}>{t('ui.admin-clients.tabs.none')}</p>
            )}
          </section>
          <section>
            <h3 className={s.subTitle}>{t('ui.admin-clients.tabs.alerts', { n: data.alerts.length })}</h3>
            {data.alerts.length ? (
              <ul className={s.cards}>
                {data.alerts.map((a) => (
                  <li key={a.id} className={s.miniCard}>
                    <span className={s.cellTags}>
                      <strong>{a.label ?? t('ui.admin-clients.tabs.alertUnnamed')}</strong>
                      <StatusTag tone={a.isActive ? 'success' : 'inactive'}>{a.isActive ? t('ui.admin-clients.tabs.active') : t('ui.admin-clients.tabs.inactive')}</StatusTag>
                    </span>
                    <span className={s.muted}>
                      {label(`ui.enum.AlertFrequency.${a.frequency}`)} · {shortDate(a.createdAt, timeZone)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.muted}>{t('ui.admin-clients.tabs.none')}</p>
            )}
          </section>
        </div>
      ) : null}
    </Frame>
  );
}

export function RegistrationsTab({ clientId }: { clientId: string }) {
  const { data, error } = useTab<{ data: ClientRegistrationRow[] }>(`/admin/clients/${clientId}/registrations`);
  return (
    <Frame error={error} loading={!data} empty={data?.data.length === 0} emptyIcon="cafe-cup" emptyTitle={t('ui.admin-clients.tabs.noCafes')}>
      <Table head={[t('ui.admin-clients.tabs.cafe'), t('ui.admin-clients.tabs.date'), t('ui.admin-clients.tabs.seats'), t('ui.admin-clients.tabs.status')]}>
        {data?.data.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.eventTitle}</strong>
              <span className={s.block}>{r.locationLabel}</span>
            </td>
            <td>{shortDateTime(r.startsAt, r.timezone)}</td>
            <td>{r.seats}</td>
            <td>
              <StatusTag tone={r.status === 'ATTENDED' ? 'success' : r.status === 'NO_SHOW' ? 'warning' : r.status === 'CANCELLED' ? 'inactive' : 'info'}>{label(`ui.enum.RegistrationStatus.${r.status}`)}</StatusTag>
            </td>
          </tr>
        ))}
      </Table>
    </Frame>
  );
}

export function FeedbackTab({ clientId }: { clientId: string }) {
  const { timeZone } = useShell();
  const { data, error } = useTab<{ data: ClientFeedbackRow[] }>(`/admin/clients/${clientId}/feedback`);
  return (
    <Frame error={error} loading={!data} empty={data?.data.length === 0} emptyIcon="star" emptyTitle={t('ui.admin-clients.tabs.noFeedback')}>
      <ul className={s.cards}>
        {data?.data.map((fb) => (
          <li key={fb.id} className={s.miniCard}>
            <span className={s.cellTags}>
              <strong>{label(`ui.enum.FeedbackKind.${fb.kind}`)}</strong>
              {fb.npsScore !== null ? <StatusTag tone="info">{t('ui.admin-clients.tabs.nps', { n: fb.npsScore })}</StatusTag> : null}
              {fb.csatScore !== null ? <StatusTag tone="info">{t('ui.admin-clients.tabs.csat', { n: fb.csatScore })}</StatusTag> : null}
              <span className={s.muted}>{shortDate(fb.createdAt, timeZone)}</span>
            </span>
            {fb.comment ? <p className={s.quote}>{fb.comment}</p> : null}
          </li>
        ))}
      </ul>
    </Frame>
  );
}

export function ConsentsTab({ clientId }: { clientId: string }) {
  const { timeZone } = useShell();
  const { data, error } = useTab<{ data: ClientConsentRow[] }>(`/admin/clients/${clientId}/consents`);
  return (
    <Frame error={error} loading={!data} empty={data?.data.length === 0} emptyIcon="shield" emptyTitle={t('ui.admin-clients.tabs.noConsents')}>
      <ol className={s.consents}>
        {data?.data.map((c) => (
          <li key={c.id} className={s.consent}>
            <span className={[s.consentDot, c.granted ? s.consentYes : s.consentNo].join(' ')} aria-hidden="true" />
            <div className={s.consentBody}>
              <p className={s.cellTags}>
                <strong>{label(`ui.enum.ConsentType.${c.type}`)}</strong>
                <StatusTag tone={c.granted ? 'success' : 'warning'}>{c.granted ? t('ui.admin-clients.tabs.granted') : t('ui.admin-clients.tabs.withdrawn')}</StatusTag>
                <span className={s.muted}>{shortDateTime(c.givenAt, timeZone)}</span>
              </p>
              {c.wording ? <p className={s.quote}>{c.wording}</p> : null}
              <p className={s.muted}>
                {[t('ui.admin-clients.tabs.origin', { source: c.source }), c.documentVersion ? t('ui.admin-clients.tabs.version', { v: c.documentVersion }) : null, c.recordedByName ? t('ui.admin-clients.tabs.recordedBy', { nom: c.recordedByName }) : null].filter(Boolean).join(' · ')}
              </p>
              {c.proofNote ? <p className={s.muted}>{c.proofNote}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

// ─── Proches (PRO-040) ──────────────────────────────────────────────────────

export function ContactsTab({ clientId, canEdit, onChanged }: { clientId: string; canEdit: boolean; onChanged: () => void }) {
  const toast = useToast();
  const { data, error, reload } = useTab<ClientContactsTab>(`/admin/clients/${clientId}/contacts`);
  const [editing, setEditing] = useState<TrustedPerson | 'new' | null>(null);
  const [deleting, setDeleting] = useState<TrustedPerson | null>(null);
  const full = data ? data.data.length >= data.max : false;
  return (
    <div className={s.tabBlock}>
      {canEdit ? (
        <div className={s.tabActions}>
          <Button variant="secondary" size="S" icon="plus" disabled={full} title={full ? t('ui.admin-clients.contacts.full') : undefined} onClick={() => setEditing('new')}>
            {t('ui.admin-clients.contacts.add')}
          </Button>
        </div>
      ) : null}
      <Frame error={error} loading={!data} empty={data?.data.length === 0} emptyIcon="partners" emptyTitle={t('ui.admin-clients.contacts.empty')} emptyText={t('ui.admin-clients.contacts.emptyText')}>
        <ul className={s.cards}>
          {data?.data.map((p) => (
            <li key={p.id} className={s.miniCard}>
              <span className={s.cellTags}>
                <strong>{p.fullName}</strong>
                {p.relation ? <span className={s.muted}>{p.relation}</span> : null}
                {p.canVisitOnBehalf ? <StatusTag tone="info">{t('ui.admin-clients.contacts.canVisit')}</StatusTag> : null}
                {canEdit ? (
                  <span className={s.cardMenu}>
                    <Menu
                      label={t('ui.admin-clients.contacts.actions', { nom: p.fullName })}
                      items={[
                        { key: 'edit', label: t('ui.common.edit'), icon: 'edit', onSelect: () => setEditing(p) },
                        { key: 'delete', label: t('ui.common.delete'), icon: 'trash', danger: true, onSelect: () => setDeleting(p) },
                      ]}
                    />
                  </span>
                ) : null}
              </span>
              <span className={s.cellTags}>
                <PhoneLinks phone={p.phone} whatsapp={false} />
                {p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : null}
              </span>
              {p.notes ? <p className={s.muted}>{p.notes}</p> : null}
            </li>
          ))}
        </ul>
      </Frame>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? t('ui.admin-clients.contacts.add') : t('ui.admin-clients.contacts.edit')} closeLabel={t('ui.common.close')} width={560}>
        {editing ? (
          <ContactForm
            clientId={clientId}
            person={editing === 'new' ? null : editing}
            close={() => setEditing(null)}
            saved={() => {
              setEditing(null);
              toast({ text: t('ui.common.saved') });
              reload();
              onChanged();
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('ui.admin-clients.contacts.deleteTitle')}
        closeLabel={t('ui.common.close')}
        footer={
          <>
            <Button variant="secondary" size="M" onClick={() => setDeleting(null)}>
              {t('ui.common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="M"
              onClick={async () => {
                const r = await adminCall(`/admin/clients/${clientId}/contacts/${deleting!.id}`, { method: 'DELETE' });
                if (!r.ok) return toast({ tone: 'error', text: errorText(r) });
                setDeleting(null);
                toast({ text: t('ui.admin-clients.contacts.deleted') });
                reload();
                onChanged();
              }}
            >
              {t('ui.common.delete')}
            </Button>
          </>
        }
      >
        <p>{t('ui.admin-clients.contacts.deleteText', { nom: deleting?.fullName ?? '' })}</p>
      </Modal>
    </div>
  );
}

function ContactForm({ clientId, person, close, saved }: { clientId: string; person: TrustedPerson | null; close: () => void; saved: () => void }) {
  const [v, setV] = useState({ fullName: person?.fullName ?? '', relation: person?.relation ?? '', phone: person?.phone ?? '', email: person?.email ?? '', canVisitOnBehalf: person?.canVisitOnBehalf ?? false, notes: person?.notes ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setFailure(null);
    const body = { fullName: v.fullName.trim(), relation: v.relation.trim() || null, phone: v.phone.replace(/[\s.()-]/g, '') || null, email: v.email.trim() || null, canVisitOnBehalf: v.canVisitOnBehalf, notes: v.notes.trim() || null };
    const r = person ? await adminCall(`/admin/clients/${clientId}/contacts/${person.id}`, { method: 'PATCH', body }) : await adminCall(`/admin/clients/${clientId}/contacts`, { body });
    setPending(false);
    if (!r.ok) {
      const fields = fieldErrors(r.error);
      if (Object.keys(fields).length) return setErrors(fields);
      return setFailure(errorText(r));
    }
    saved();
  };
  return (
    <form className={f.form} onSubmit={submit} noValidate>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <div className={f.row}>
        <TextInput label={t('ui.admin-clients.contacts.fullName')} value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} error={errors.fullName} autoFocus />
        <TextInput label={t('ui.admin-clients.contacts.relation')} optional value={v.relation} onChange={(e) => setV({ ...v, relation: e.target.value })} error={errors.relation} />
      </div>
      <div className={f.row}>
        <TextInput type="tel" label={t('ui.admin-clients.field.phone')} optional value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} error={errors.phone} />
        <TextInput type="email" label={t('ui.admin-clients.field.email')} optional value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={errors.email} />
      </div>
      <Checkbox label={t('ui.admin-clients.contacts.canVisitLong')} checked={v.canVisitOnBehalf} onChange={(x) => setV({ ...v, canVisitOnBehalf: x })} />
      <TextArea label={t('ui.admin-clients.contacts.notes')} optional value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} maxLength={300} rows={2} />
      <div className={`${f.actions} ${f.actionsEnd}`}>
        <Button variant="secondary" size="M" onClick={close}>
          {t('ui.common.cancel')}
        </Button>
        <Button type="submit" variant="tool" size="M" pending={pending}>
          {t('ui.common.save')}
        </Button>
      </div>
    </form>
  );
}
