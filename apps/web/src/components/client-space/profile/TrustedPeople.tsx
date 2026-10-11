'use client';
// PRO-040 — « Personnes de confiance »: up to five relatives (name, link, phone, e-mail, « Peut visiter un bien à ma
// place », note). Adding asks the box « Je confirme avoir informé cette personne… » (its date is kept). A person
// linked to an upcoming visit is not removed: the server says so (CONTACT_HAS_VISIT).
import { useId, useState } from 'react';
import { CLIENT_CONTACTS_MAX, type TrustedPerson } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import { CheckboxField, TextField } from '@/components/forms/fields';
import { Banner, errorMessage, fieldErrors } from '@/components/auth/kit';
import { longDate } from '../texts';
import s from './profile.module.css';

interface Draft {
  fullName: string;
  relation: string;
  phone: string;
  email: string;
  canVisitOnBehalf: boolean;
  notes: string;
  informed: boolean;
}
const EMPTY: Draft = { fullName: '', relation: '', phone: '', email: '', canVisitOnBehalf: false, notes: '', informed: false };
const nul = (v: string) => (v.trim() === '' ? null : v.trim());

function PersonForm({ initial, isNew, onDone, onCancel }: { initial: Draft; isNew: boolean; onDone: (p: TrustedPerson) => void; onCancel: () => void }) {
  const id = useId();
  const [d, setD] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function save(personId?: string) {
    setFailure(null);
    if (isNew && !d.informed) return setErrors({ informed: t('ui.client.profile.contacts.informedRequired') });
    const body = { fullName: d.fullName.trim(), relation: nul(d.relation), phone: nul(d.phone.replace(/[\s.()-]/g, '')), email: nul(d.email), canVisitOnBehalf: d.canVisitOnBehalf, notes: nul(d.notes), ...(isNew ? { informed: true } : {}) };
    setPending(true);
    const res = await apiCall<TrustedPerson>(isNew ? '/client/contacts' : `/client/contacts/${personId}`, { method: isNew ? 'POST' : 'PATCH', body, retryOnAuth: true });
    setPending(false);
    if (!res.ok) {
      if (res.error?.reason === 'CONTACTS_LIMIT') return setFailure(t('ui.client.profile.contacts.limit'));
      const fe = fieldErrors(res.error);
      if (Object.keys(fe).length) setErrors(fe);
      else setFailure(errorMessage(res.error, { offline: res.offline, status: res.status }));
      return;
    }
    onDone(res.data);
  }

  return (
    <div className={s.inlinePanel}>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <div className={s.fields}>
        <TextField id={`${id}-n`} label={t('ui.client.profile.contacts.fullName')} value={d.fullName} onChange={(e) => set('fullName', e.target.value)} error={errors.fullName} />
        <TextField id={`${id}-r`} label={t('ui.client.profile.contacts.relation')} optional value={d.relation} onChange={(e) => set('relation', e.target.value)} error={errors.relation} />
        <TextField id={`${id}-p`} type="tel" label={t('ui.client.profile.contacts.phone')} optional hint={t('ui.client.profile.fields.phoneHint')} value={d.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
        <TextField id={`${id}-e`} type="email" label={t('ui.client.profile.contacts.email')} optional value={d.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
        <div className={s.wide}>
          <TextField id={`${id}-o`} label={t('ui.client.profile.contacts.notes')} optional maxLength={300} value={d.notes} onChange={(e) => set('notes', e.target.value)} error={errors.notes} />
        </div>
        <div className={s.wide}>
          <CheckboxField id={`${id}-v`} label={t('ui.client.profile.contacts.canVisit')} checked={d.canVisitOnBehalf} onChange={(v) => set('canVisitOnBehalf', v)} />
          {isNew ? <CheckboxField id={`${id}-i`} label={t('ui.client.profile.contacts.informed')} checked={d.informed} onChange={(v) => set('informed', v)} error={errors.informed} /> : null}
        </div>
      </div>
      <div className={s.panelActions}>
        <Button variant="tool" size="M" pending={pending} onClick={() => void save((initial as Draft & { id?: string }).id)}>
          {t('ui.client.profile.contacts.save')}
        </Button>
        <Button variant="tertiary" size="M" onClick={onCancel}>
          {t('ui.client.profile.contacts.cancel')}
        </Button>
      </div>
    </div>
  );
}

export function TrustedPeople({ initial, timeZone }: { initial: TrustedPerson[]; timeZone: string }) {
  const [people, setPeople] = useState(initial);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function remove(p: TrustedPerson) {
    setFailure(null);
    const res = await apiCall(`/client/contacts/${p.id}`, { method: 'DELETE', retryOnAuth: true });
    setConfirm(null);
    if (!res.ok) {
      if (res.error?.reason === 'CONTACT_HAS_VISIT') {
        const prm = (res.error.params ?? {}) as { nom?: string; date?: string | null };
        return setFailure(t('ui.client.profile.contacts.hasVisit', { nom: prm.nom ?? p.fullName, date: prm.date ? longDate(prm.date, timeZone) : '' }));
      }
      return setFailure(errorMessage(res.error, { offline: res.offline, status: res.status }));
    }
    setPeople((list) => list.filter((x) => x.id !== p.id));
    showToast({ message: t('ui.client.profile.contacts.removed') });
  }

  return (
    <section className={s.section} aria-labelledby="proches-titre" id="proches">
      <div className={s.sectionHead}>
        <h2 id="proches-titre" className={s.sectionTitle}>
          {t('ui.client.profile.sections.contacts')}
        </h2>
      </div>
      <p className={s.help}>{t('ui.client.profile.contacts.intro')}</p>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      {people.length === 0 && editing !== 'new' ? <p className={s.emptyLine}>{t('ui.client.profile.contacts.empty')}</p> : null}
      <ul role="list" className={s.people}>
        {people.map((p) =>
          editing === p.id ? (
            <li key={p.id}>
              <PersonForm
                isNew={false}
                initial={{ ...EMPTY, ...p, relation: p.relation ?? '', phone: p.phone ?? '', email: p.email ?? '', notes: p.notes ?? '', informed: true, id: p.id } as Draft}
                onDone={(np) => {
                  setPeople((list) => list.map((x) => (x.id === np.id ? np : x)));
                  setEditing(null);
                  showToast({ message: t('ui.client.profile.saved') });
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={p.id} className={s.person}>
              <span className={s.personIcon} aria-hidden="true">
                <Icon name="user" size={20} />
              </span>
              <span className={s.personText}>
                <span className={s.personName}>{p.fullName}</span>
                <span className={s.help}>{[p.relation, p.phone, p.email].filter(Boolean).join(' · ')}</span>
                {p.canVisitOnBehalf ? <span className={s.badgeSoft}>{t('ui.client.profile.contacts.visitor')}</span> : null}
              </span>
              {confirm === p.id ? (
                <span className={s.confirm}>
                  <span>{t('ui.client.profile.contacts.deleteConfirm', { nom: p.fullName })}</span>
                  <Button variant="danger" size="S" onClick={() => void remove(p)}>
                    {t('ui.client.profile.contacts.delete')}
                  </Button>
                  <Button variant="tertiary" size="S" onClick={() => setConfirm(null)}>
                    {t('ui.common.cancel')}
                  </Button>
                </span>
              ) : (
                <span className={s.personActions}>
                  <Button variant="secondary" size="S" onClick={() => setEditing(p.id)}>
                    {t('ui.client.profile.contacts.edit')}
                  </Button>
                  <Button variant="tertiary" size="S" onClick={() => setConfirm(p.id)}>
                    {t('ui.client.profile.contacts.delete')}
                  </Button>
                </span>
              )}
            </li>
          ),
        )}
      </ul>
      {editing === 'new' ? (
        <PersonForm
          isNew
          initial={EMPTY}
          onDone={(np) => {
            setPeople((list) => [...list, np]);
            setEditing(null);
            showToast({ message: t('ui.client.profile.contacts.added') });
          }}
          onCancel={() => setEditing(null)}
        />
      ) : people.length < CLIENT_CONTACTS_MAX ? (
        <Button variant="secondary" size="M" icon="plus" onClick={() => setEditing('new')}>
          {t('ui.client.profile.contacts.add')}
        </Button>
      ) : (
        <p className={s.help}>{t('ui.client.profile.contacts.limit')}</p>
      )}
    </section>
  );
}
