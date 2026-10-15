'use client';
// CRM-046 « Projet et finances », CRM-048 « Modifier la fiche » — the sections of the client's profile (PRO-001), each read
// at a glance and edited on its own (BO-046: « Modifier » → « Enregistrer » · « Annuler », the version checked, TRV-094).
// The sensitive amounts and fields need `client.sensitive.read` (ROL-019): « Réservé » otherwise, and never editable.
// The e-mail address is edited here only for a client WITHOUT an account (CRM-048).
import type { ApiErrorBody } from '@dp/contracts';
import { changesText, ConflictNotice, isConflict } from '../shell/ConflictNotice';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ClientDetail, ClientProjectTab } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Banner, Button, Modal, Skeleton, useToast } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { money, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Facts, Surface } from '../shell/Page';
import { Checkbox, SelectInput, TextInput, formStyles as f, useUnsavedGuard } from '../shell/forms';
import { countryName } from './client-parts';
import s from './clients.module.css';

type Section = 'identity' | 'contact' | 'situation' | 'project' | 'finances' | 'email';
type Values = Record<string, unknown>;

const ENUMS = {
  residencyStatus: ['NON_RESIDENT', 'EXPATRIATE', 'RESIDENT', 'OTHER'],
  employmentType: ['PERMANENT', 'FIXED_TERM', 'CIVIL_SERVANT', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'RETIRED', 'OTHER'],
  preferredContactChannel: ['EMAIL', 'PHONE', 'WHATSAPP'],
  preferredContactSlot: ['MORNING', 'NOON', 'AFTERNOON', 'EVENING', 'ANYTIME'],
  purchasePurpose: ['HOLIDAY_HOME', 'RETURN_HOME', 'FAMILY', 'RENTAL_INVESTMENT', 'OTHER'],
  purchaseTimeframe: ['LT_6M', 'M6_12', 'GT_12M', 'UNDEFINED'],
  financingPreference: ['CONVENTIONAL', 'ISLAMIC', 'NO_PREFERENCE', 'CASH'],
  preferredTypes: ['APARTMENT', 'STUDIO', 'DUPLEX', 'VILLA', 'LAND', 'COMMERCIAL'],
} as const;
const ENUM_NAME: Record<string, string> = {
  residencyStatus: 'ResidencyStatus',
  employmentType: 'EmploymentType',
  preferredContactChannel: 'ContactChannel',
  preferredContactSlot: 'ContactTimeSlot',
  purchasePurpose: 'PurchasePurpose',
  purchaseTimeframe: 'PurchaseTimeframe',
  financingPreference: 'FinancingPreference',
  preferredTypes: 'PropertyType',
};
const enumLabel = (field: string, value: string) => {
  const key = `ui.enum.${ENUM_NAME[field]}.${value}`;
  return hasMessage(key) ? t(key as MessageKey) : value;
};

export function ProjectTab({ client, onSaved, only, onClose }: { client: ClientDetail; onSaved: () => void; only?: 'email'; onClose?: () => void }) {
  const [data, setData] = useState<ClientProjectTab | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [editing, setEditing] = useState<Section | null>(only ?? null);
  const load = useCallback(async () => {
    const r = await adminCall<ClientProjectTab>(`/admin/clients/${client.id}/project`);
    if (r.ok) setData(r.data);
    else setFailed(errorText(r));
  }, [client.id]);
  useEffect(() => {
    void load();
  }, [load, client.version]);

  if (only) {
    return (
      <Modal open onClose={onClose ?? (() => undefined)} title={t('ui.admin-clients.project.email')} closeLabel={t('ui.common.close')}>
        {data ? <SectionForm section="email" client={client} data={data} close={onClose ?? (() => undefined)} saved={onSaved} /> : <Skeleton width="100%" />}
      </Modal>
    );
  }
  if (failed) return <Banner tone="error">{failed}</Banner>;
  if (!data) return <Skeleton width="100%" height="12rem" />;

  const reserved = <span className={s.muted}>{t('ui.admin-clients.reserved')}</span>;
  const pick = (field: string, v: string | null) => (v ? enumLabel(field, v) : null);
  const regions = data.project.preferredRegionIds.map((id) => data.options.regions.find((r) => r.id === id)?.name ?? id).join(', ');
  const can = client.can.update && !client.masked;
  const edit = (section: Section) => (can && (section !== 'situation' && section !== 'finances' ? true : client.can.sensitive) ? <Button variant="tertiary" size="S" icon="edit" onClick={() => setEditing(section)} aria-label={t('ui.admin-clients.project.editSection', { section: t(`ui.admin-clients.project.${section}` as MessageKey) })}>{t('ui.common.edit')}</Button> : undefined);

  return (
    <div className={s.sections}>
      <Surface title={t('ui.admin-clients.project.identity')} actions={edit('identity')}>
        <Facts
          columns={2}
          items={[
            { label: t('ui.admin-clients.field.firstName'), value: data.identity.firstName },
            { label: t('ui.admin-clients.field.lastName'), value: data.identity.lastName },
            { label: t('ui.admin-clients.field.birthDate'), value: data.withheld.includes('birthDate') ? reserved : shortDay(data.identity.birthDate) },
            { label: t('ui.admin-clients.field.nationalities'), value: data.identity.nationalities.map(countryName).join(', ') || null },
          ]}
        />
      </Surface>
      <Surface title={t('ui.admin-clients.project.contact')} actions={edit('contact')}>
        <Facts
          columns={2}
          items={[
            { label: t('ui.admin-clients.field.email'), value: client.coordinates.email },
            { label: t('ui.admin-clients.field.phone'), value: data.contact.phone },
            { label: t('ui.admin-clients.field.country'), value: data.contact.countryOfResidence ? countryName(data.contact.countryOfResidence) : null },
            { label: t('ui.admin-clients.field.city'), value: data.contact.cityOfResidence },
            { label: t('ui.admin-clients.field.channel'), value: pick('preferredContactChannel', data.contact.preferredContactChannel) },
            { label: t('ui.admin-clients.field.slot'), value: pick('preferredContactSlot', data.contact.preferredContactSlot) },
            { label: t('ui.admin-clients.field.timezone'), value: data.contact.timezone },
            { label: t('ui.admin-clients.field.whatsapp'), value: data.contact.whatsappOptIn ? t('ui.common.yes') : t('ui.common.no') },
          ]}
        />
        {client.can.editEmail ? (
          <div className={s.sectionFoot}>
            <Button variant="tertiary" size="S" icon="mail" onClick={() => setEditing('email')}>
              {client.coordinates.email ? t('ui.admin-clients.project.changeEmail') : t('ui.admin-clients.action.addEmail')}
            </Button>
          </div>
        ) : client.account !== 'NONE' ? (
          <p className={s.sectionNote}>{t('ui.admin-clients.project.emailAccount')}</p>
        ) : null}
      </Surface>
      <Surface title={t('ui.admin-clients.project.situation')} actions={edit('situation')}>
        <Facts
          columns={2}
          items={[
            { label: t('ui.admin-clients.field.residencyStatus'), value: pick('residencyStatus', data.situation.residencyStatus) },
            { label: t('ui.admin-clients.field.employmentType'), value: data.withheld.includes('employmentType') ? reserved : pick('employmentType', data.situation.employmentType) },
            { label: t('ui.admin-clients.field.profession'), value: data.withheld.includes('profession') ? reserved : data.situation.profession },
            { label: t('ui.admin-clients.field.employer'), value: data.withheld.includes('employerName') ? reserved : data.situation.employerName },
            { label: t('ui.admin-clients.field.employedSince'), value: data.withheld.includes('employedSince') ? reserved : shortDay(data.situation.employedSince) },
          ]}
        />
      </Surface>
      <Surface title={t('ui.admin-clients.project.project')} actions={edit('project')}>
        <Facts
          columns={2}
          items={[
            { label: t('ui.admin-clients.field.budgetMax'), value: data.project.budgetMax && data.project.budgetCurrency ? money(data.project.budgetMax, data.project.budgetCurrency) : null },
            { label: t('ui.admin-clients.field.budgetMonthly'), value: data.project.budgetMonthly && data.project.budgetMonthlyCurrency ? money(data.project.budgetMonthly, data.project.budgetMonthlyCurrency) : null },
            { label: t('ui.admin-clients.field.timeframe'), value: pick('purchaseTimeframe', data.project.purchaseTimeframe) },
            { label: t('ui.admin-clients.field.financing'), value: pick('financingPreference', data.project.financingPreference) },
            { label: t('ui.admin-clients.field.purpose'), value: pick('purchasePurpose', data.project.purchasePurpose) },
            { label: t('ui.admin-clients.field.minRooms'), value: data.project.minRooms ? String(data.project.minRooms) : null },
            { label: t('ui.admin-clients.field.regions'), value: regions || null },
            { label: t('ui.admin-clients.field.types'), value: data.project.preferredTypes.map((x) => enumLabel('preferredTypes', x)).join(', ') || null },
          ]}
        />
      </Surface>
      <Surface title={t('ui.admin-clients.project.finances')} actions={edit('finances')}>
        {data.finances ? (
          <Facts
            columns={2}
            items={[
              { label: t('ui.admin-clients.field.monthlyIncome'), value: data.finances.monthlyIncome && data.finances.currency ? money(data.finances.monthlyIncome, data.finances.currency) : null },
              { label: t('ui.admin-clients.field.otherIncome'), value: data.finances.otherMonthlyIncome && data.finances.currency ? money(data.finances.otherMonthlyIncome, data.finances.currency) : null },
              { label: t('ui.admin-clients.field.debts'), value: data.finances.monthlyDebts && data.finances.currency ? money(data.finances.monthlyDebts, data.finances.currency) : null },
              { label: t('ui.admin-clients.field.downPayment'), value: data.finances.downPayment && data.finances.currency ? money(data.finances.downPayment, data.finances.currency) : null },
            ]}
          />
        ) : (
          <p className={s.muted}>{t('ui.admin-clients.project.financesReserved')}</p>
        )}
        {data.lastEligibility ? (
          <p className={s.sectionNote}>
            {t('ui.admin-clients.project.lastEligibility', { date: shortDay(data.lastEligibility.createdAt.slice(0, 10)), statut: data.lastEligibility.status && hasMessage(`ui.enum.EligibilityStatus.${data.lastEligibility.status}`) ? t(`ui.enum.EligibilityStatus.${data.lastEligibility.status}` as MessageKey) : (data.lastEligibility.status ?? '—') })}
          </p>
        ) : null}
      </Surface>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing ? t(`ui.admin-clients.project.${editing}` as MessageKey) : ''} closeLabel={t('ui.common.close')} width={720}>
        {editing ? (
          <SectionForm
            section={editing}
            client={client}
            data={data}
            close={() => setEditing(null)}
            saved={() => {
              setEditing(null);
              void load();
              onSaved();
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function initialValues(section: Section, data: ClientProjectTab, client: ClientDetail): Values {
  switch (section) {
    case 'identity':
      return { firstName: data.identity.firstName ?? '', lastName: data.identity.lastName ?? '', birthDate: data.identity.birthDate ?? '', nationalities: data.identity.nationalities };
    case 'contact':
      return { ...data.contact, phone: data.contact.phone ?? '', cityOfResidence: data.contact.cityOfResidence ?? '', timezone: data.contact.timezone ?? '' };
    case 'situation':
      return { ...data.situation, profession: data.situation.profession ?? '', employerName: data.situation.employerName ?? '', employedSince: data.situation.employedSince ?? '' };
    case 'project':
      return { ...data.project, budgetMax: data.project.budgetMax ?? '', budgetMonthly: data.project.budgetMonthly ?? '', minRooms: data.project.minRooms ?? '' };
    case 'finances':
      return { currency: data.finances?.currency ?? data.project.budgetCurrency ?? '', monthlyIncome: data.finances?.monthlyIncome ?? '', otherMonthlyIncome: data.finances?.otherMonthlyIncome ?? '', monthlyDebts: data.finances?.monthlyDebts ?? '', downPayment: data.finances?.downPayment ?? '' };
    default:
      return { email: client.coordinates.email ?? '' };
  }
}

const orNull = (v: unknown) => (v === '' || v === undefined ? null : v);
const decimal = (v: unknown) => (v === '' || v === null || v === undefined ? null : String(v).replace(/\s/g, '').replace(',', '.'));

function toPayload(section: Section, v: Values): Values {
  switch (section) {
    case 'identity':
      return { firstName: v.firstName, lastName: v.lastName, birthDate: orNull(v.birthDate), nationalities: v.nationalities };
    case 'contact':
      return { phone: orNull(String(v.phone ?? '').replace(/[\s.()-]/g, '')), whatsappOptIn: Boolean(v.whatsappOptIn), countryOfResidence: orNull(v.countryOfResidence), cityOfResidence: orNull(v.cityOfResidence), preferredContactChannel: orNull(v.preferredContactChannel), preferredContactSlot: orNull(v.preferredContactSlot), timezone: orNull(v.timezone) };
    case 'situation':
      return { residencyStatus: orNull(v.residencyStatus), employmentType: orNull(v.employmentType), profession: orNull(v.profession), employerName: orNull(v.employerName), employedSince: orNull(v.employedSince) };
    case 'project':
      return { preferredRegionIds: v.preferredRegionIds, preferredTypes: v.preferredTypes, minRooms: v.minRooms === '' || v.minRooms === null ? null : Number(v.minRooms), budgetMax: decimal(v.budgetMax), budgetCurrency: orNull(v.budgetCurrency), budgetMonthly: decimal(v.budgetMonthly), purchasePurpose: orNull(v.purchasePurpose), purchaseTimeframe: orNull(v.purchaseTimeframe), financingPreference: orNull(v.financingPreference) };
    case 'finances':
      return { currency: orNull(v.currency), monthlyIncome: decimal(v.monthlyIncome), otherMonthlyIncome: decimal(v.otherMonthlyIncome), monthlyDebts: decimal(v.monthlyDebts), downPayment: decimal(v.downPayment) };
    default:
      return { email: orNull(String(v.email ?? '').trim().toLowerCase()) };
  }
}

function SectionForm({ section, client, data, close, saved }: { section: Section; client: ClientDetail; data: ClientProjectTab; close: () => void; saved: () => void }) {
  const toast = useToast();
  const [initial] = useState(() => initialValues(section, data, client));
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ApiErrorBody['error'] | null>(null);
  const [pending, setPending] = useState(false);
  useUnsavedGuard(JSON.stringify(v) !== JSON.stringify(initial));
  const set = (k: string) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const err = (k: string) => errors[`values.${k}`] ?? errors[k];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setFailure(null);
    setConflict(null);
    const r = await adminCall(`/admin/clients/${client.id}`, { method: 'PATCH', body: { section, version: data.version, values: toPayload(section, v) } });
    setPending(false);
    if (!r.ok) {
      const fields = fieldErrors(r.error);
      if (Object.keys(fields).length) return setErrors(fields);
      if (isConflict(r.error)) return setConflict(r.error ?? null); // TRV-094
      return setFailure(errorText(r));
    }
    toast({ text: t('ui.common.saved') });
    saved();
  }

  const select = (k: keyof typeof ENUMS, label: string) => (
    <SelectInput label={label} value={String(v[k] ?? '')} onChange={set(k)} error={err(k)} optional>
      <option value="">{t('ui.admin-clients.notSaid')}</option>
      {ENUMS[k].map((x) => (
        <option key={x} value={x}>
          {enumLabel(k, x)}
        </option>
      ))}
    </SelectInput>
  );
  const multi = (k: string, options: { value: string; label: string }[], label: string) => {
    const list = (v[k] as string[]) ?? [];
    return (
      <fieldset className={s.multi}>
        <legend className={s.multiLegend}>{label}</legend>
        <div className={s.multiChips}>
          {options.map((o) => {
            const on = list.includes(o.value);
            return (
              <button key={o.value} type="button" aria-pressed={on} className={on ? s.chipOn : s.chip} onClick={() => setV((x) => ({ ...x, [k]: on ? list.filter((y) => y !== o.value) : [...list, o.value] }))}>
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  };
  const currency = (k: string) => (
    <SelectInput label={t('ui.admin-clients.field.currency')} value={String(v[k] ?? '')} onChange={set(k)} error={err(k)}>
      <option value="">—</option>
      {data.options.currencies.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </SelectInput>
  );

  return (
    <form className={f.form} onSubmit={submit} noValidate>
      {conflict ? <ConflictNotice error={conflict} onReload={saved} changes={() => changesText(v)} /> : null}
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      {section === 'identity' ? (
        <>
          <div className={f.row}>
            <TextInput label={t('ui.admin-clients.field.firstName')} value={String(v.firstName)} onChange={set('firstName')} error={err('firstName')} />
            <TextInput label={t('ui.admin-clients.field.lastName')} value={String(v.lastName)} onChange={set('lastName')} error={err('lastName')} />
          </div>
          {client.can.sensitive ? <TextInput type="date" label={t('ui.admin-clients.field.birthDate')} optional value={String(v.birthDate)} onChange={set('birthDate')} error={err('birthDate')} /> : null}
          {multi('nationalities', data.options.countries.map((c) => ({ value: c.code, label: c.name })).slice(0, 40), t('ui.admin-clients.field.nationalities'))}
        </>
      ) : null}
      {section === 'contact' ? (
        <>
          <div className={f.row}>
            <TextInput type="tel" label={t('ui.admin-clients.field.phone')} optional value={String(v.phone)} onChange={set('phone')} error={err('phone')} hint={t('ui.admin-clients.create.phoneHint')} />
            <SelectInput label={t('ui.admin-clients.field.country')} optional value={String(v.countryOfResidence ?? '')} onChange={set('countryOfResidence')} error={err('countryOfResidence')}>
              <option value="">{t('ui.admin-clients.notSaid')}</option>
              {data.options.countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </div>
          <Checkbox label={t('ui.admin-clients.field.whatsapp')} checked={Boolean(v.whatsappOptIn)} onChange={(x) => setV((y) => ({ ...y, whatsappOptIn: x }))} />
          <div className={f.row}>
            <TextInput label={t('ui.admin-clients.field.city')} optional value={String(v.cityOfResidence)} onChange={set('cityOfResidence')} error={err('cityOfResidence')} />
            <TextInput label={t('ui.admin-clients.field.timezone')} optional value={String(v.timezone)} onChange={set('timezone')} error={err('timezone')} hint={t('ui.admin-clients.field.timezoneHint')} />
          </div>
          <div className={f.row}>
            {select('preferredContactChannel', t('ui.admin-clients.field.channel'))}
            {select('preferredContactSlot', t('ui.admin-clients.field.slot'))}
          </div>
        </>
      ) : null}
      {section === 'situation' ? (
        <>
          <div className={f.row}>
            {select('residencyStatus', t('ui.admin-clients.field.residencyStatus'))}
            {select('employmentType', t('ui.admin-clients.field.employmentType'))}
          </div>
          <div className={f.row}>
            <TextInput label={t('ui.admin-clients.field.profession')} optional value={String(v.profession)} onChange={set('profession')} error={err('profession')} />
            <TextInput label={t('ui.admin-clients.field.employer')} optional value={String(v.employerName)} onChange={set('employerName')} error={err('employerName')} />
          </div>
          <TextInput type="date" label={t('ui.admin-clients.field.employedSince')} optional value={String(v.employedSince)} onChange={set('employedSince')} error={err('employedSince')} />
        </>
      ) : null}
      {section === 'project' ? (
        <>
          <div className={f.row}>
            <TextInput inputMode="decimal" label={t('ui.admin-clients.field.budgetMax')} optional value={String(v.budgetMax)} onChange={set('budgetMax')} error={err('budgetMax')} />
            <TextInput inputMode="decimal" label={t('ui.admin-clients.field.budgetMonthly')} optional value={String(v.budgetMonthly)} onChange={set('budgetMonthly')} error={err('budgetMonthly')} />
          </div>
          <div className={f.row}>
            {currency('budgetCurrency')}
            <TextInput type="number" min={1} max={10} label={t('ui.admin-clients.field.minRooms')} optional value={String(v.minRooms)} onChange={set('minRooms')} error={err('minRooms')} />
          </div>
          <div className={f.row}>
            {select('purchaseTimeframe', t('ui.admin-clients.field.timeframe'))}
            {select('financingPreference', t('ui.admin-clients.field.financing'))}
          </div>
          {select('purchasePurpose', t('ui.admin-clients.field.purpose'))}
          {multi('preferredRegionIds', data.options.regions.map((r) => ({ value: r.id, label: r.name })), t('ui.admin-clients.field.regions'))}
          {multi('preferredTypes', ENUMS.preferredTypes.map((x) => ({ value: x, label: enumLabel('preferredTypes', x) })), t('ui.admin-clients.field.types'))}
        </>
      ) : null}
      {section === 'finances' ? (
        <>
          {currency('currency')}
          <div className={f.row}>
            <TextInput inputMode="decimal" label={t('ui.admin-clients.field.monthlyIncome')} optional value={String(v.monthlyIncome)} onChange={set('monthlyIncome')} error={err('monthlyIncome')} />
            <TextInput inputMode="decimal" label={t('ui.admin-clients.field.otherIncome')} optional value={String(v.otherMonthlyIncome)} onChange={set('otherMonthlyIncome')} error={err('otherMonthlyIncome')} />
          </div>
          <div className={f.row}>
            <TextInput inputMode="decimal" label={t('ui.admin-clients.field.debts')} optional value={String(v.monthlyDebts)} onChange={set('monthlyDebts')} error={err('monthlyDebts')} />
            <TextInput inputMode="decimal" label={t('ui.admin-clients.field.downPayment')} optional value={String(v.downPayment)} onChange={set('downPayment')} error={err('downPayment')} />
          </div>
        </>
      ) : null}
      {section === 'email' ? (
        <>
          <p className={f.muted}>{t('ui.admin-clients.project.emailText')}</p>
          <TextInput type="email" inputMode="email" label={t('ui.admin-clients.field.email')} value={String(v.email)} onChange={set('email')} error={err('email')} autoFocus />
        </>
      ) : null}
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
