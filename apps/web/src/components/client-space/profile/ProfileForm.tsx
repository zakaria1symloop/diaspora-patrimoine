'use client';
// EC-50 — the profile in five sections, each with its own « Enregistrer » (PRO-001, PRO-002): saving one section never
// touches the others; a version changed meanwhile (the advisor edited the record) answers 409 → TRV-094; leaving
// with unsaved changes asks first (TRV-093, browser navigation). « Profil complété à {n} % » (PRO-003).
// D-098: the page uses the whole width — a rail that stays in view (where the profile stands, said as an encouragement,
// what is still missing among the nine pieces of information of PRO-003, and the sections with their state), and the
// sections beside it, on two columns when the screen allows.
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { ClientProfile, ProfileSection } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { Encouragement } from '../kit/Encouragement';
import k from '../kit/kit.module.css';
import type { MessageKey } from '@dp/i18n';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import { CheckboxField, SelectField, TextField } from '@/components/forms/fields';
import { Banner, errorMessage, fieldErrors } from '@/components/auth/kit';
import { signalSpaceChanged } from '../SpaceContext';
import { UnsavedGuard, useUnsavedGuard } from '../UnsavedGuard';
import { EmailChange } from './EmailChange';
import s from './profile.module.css';

type Values = Record<string, unknown>;
const ENUMS = {
  preferredContactChannel: ['EMAIL', 'PHONE', 'WHATSAPP'],
  preferredContactSlot: ['MORNING', 'NOON', 'AFTERNOON', 'EVENING', 'ANYTIME'],
  residencyStatus: ['NON_RESIDENT', 'EXPATRIATE', 'RESIDENT', 'OTHER'],
  employmentType: ['PERMANENT', 'FIXED_TERM', 'CIVIL_SERVANT', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'RETIRED', 'OTHER'],
  purchasePurpose: ['HOLIDAY_HOME', 'RETURN_HOME', 'FAMILY', 'RENTAL_INVESTMENT', 'OTHER'],
  purchaseTimeframe: ['LT_6M', 'M6_12', 'GT_12M', 'UNDEFINED'],
  financingPreference: ['CONVENTIONAL', 'ISLAMIC', 'NO_PREFERENCE', 'CASH'],
} as const;
const ENUM_NAME: Record<keyof typeof ENUMS, string> = {
  preferredContactChannel: 'ContactChannel',
  preferredContactSlot: 'ContactTimeSlot',
  residencyStatus: 'ResidencyStatus',
  employmentType: 'EmploymentType',
  purchasePurpose: 'PurchasePurpose',
  purchaseTimeframe: 'PurchaseTimeframe',
  financingPreference: 'FinancingPreference',
};
const TYPES = ['APARTMENT', 'STUDIO', 'DUPLEX', 'VILLA', 'LAND', 'COMMERCIAL'] as const;
const label = (f: string) => t(`ui.client.profile.fields.${f}` as MessageKey);
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
/** « 1 500,50 » → « 1500.50 » (API-002 decimal strings). */
const decimal = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[\s  ]/g, '').replace(',', '.');
  return s === '' ? null : s;
};

/** What each section sends (the API checks the same schema). */
function payload(section: ProfileSection, v: Values): Values {
  switch (section) {
    case 'identity':
      return { firstName: String(v.firstName ?? '').trim(), lastName: String(v.lastName ?? '').trim(), birthDate: blankToNull(v.birthDate), nationalities: v.nationalities };
    case 'contact':
      return {
        phone: blankToNull(String(v.phone ?? '').replace(/[\s.()-]/g, '')),
        whatsappOptIn: Boolean(v.whatsappOptIn),
        countryOfResidence: blankToNull(v.countryOfResidence),
        cityOfResidence: blankToNull(v.cityOfResidence),
        preferredContactChannel: blankToNull(v.preferredContactChannel),
        preferredContactSlot: blankToNull(v.preferredContactSlot),
        timezone: blankToNull(v.timezone),
      };
    case 'situation':
      return { residencyStatus: blankToNull(v.residencyStatus), employmentType: blankToNull(v.employmentType), profession: blankToNull(v.profession), employerName: blankToNull(v.employerName), employedSince: blankToNull(v.employedSince) };
    case 'project':
      return {
        preferredRegionIds: v.preferredRegionIds,
        preferredTypes: v.preferredTypes,
        minRooms: v.minRooms === '' || v.minRooms === null || v.minRooms === undefined ? null : Number(v.minRooms),
        budgetMax: decimal(v.budgetMax),
        budgetCurrency: blankToNull(v.budgetCurrency),
        budgetMonthly: decimal(v.budgetMonthly),
        purchasePurpose: blankToNull(v.purchasePurpose),
        purchaseTimeframe: blankToNull(v.purchaseTimeframe),
        financingPreference: blankToNull(v.financingPreference),
      };
    case 'finances':
      return { currency: blankToNull(v.currency), monthlyIncome: decimal(v.monthlyIncome), otherMonthlyIncome: decimal(v.otherMonthlyIncome), monthlyDebts: decimal(v.monthlyDebts), downPayment: decimal(v.downPayment) };
  }
}

function initialOf(p: ClientProfile, section: ProfileSection): Values {
  if (section === 'project') return { ...p.project, minRooms: p.project.minRooms ?? '' };
  return { ...(p[section] as unknown as Values) };
}

function Section({
  id,
  section,
  profile,
  version,
  onSaved,
  onDirty,
  children,
  note,
}: {
  id: string;
  section: ProfileSection;
  profile: ClientProfile;
  version: number;
  onSaved: (p: ClientProfile) => void;
  onDirty: (section: ProfileSection, dirty: boolean) => void;
  children: (v: Values, set: (k: string, val: unknown) => void, errors: Record<string, string>) => ReactNode;
  note?: ReactNode;
}) {
  const [initial, setInitial] = useState(() => initialOf(profile, section));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<ReactNode>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const dirty = JSON.stringify(payload(section, values)) !== JSON.stringify(payload(section, initial));
  useEffect(() => onDirty(section, dirty), [dirty, section, onDirty]);

  const set = (k: string, val: unknown) => setValues((v) => ({ ...v, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFailure(null);
    if (!dirty) return showToast({ message: t('ui.client.profile.nothing'), tone: 'info' });
    setPending(true);
    const res = await apiCall<ClientProfile>('/client/me', { method: 'PATCH', body: { section, version, values: payload(section, values) }, retryOnAuth: true });
    setPending(false);
    if (!res.ok) {
      if (res.error?.code === 'CONFLICT_VERSION') {
        const p = (res.error.params ?? {}) as { prenom?: string | null; at?: string };
        const heure = p.at ? new Date(p.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ') : '';
        setFailure(
          <>
            <p>{p.prenom ? t('ui.client.profile.conflict', { prenom: p.prenom, heure }) : t('ui.client.profile.conflictNoName', { heure })}</p>
            <Button variant="secondary" size="S" onClick={() => router.refresh()}>
              {t('ui.client.profile.reload')}
            </Button>
          </>,
        );
        return;
      }
      const fe = fieldErrors(res.error);
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(fe)) mapped[k.replace(/^values\./, '')] = v;
      if (Object.keys(mapped).length) setErrors(mapped);
      else setFailure(errorMessage(res.error, { offline: res.offline, status: res.status }));
      return;
    }
    setErrors({});
    const next = initialOf(res.data, section);
    setInitial(next);
    setValues(next);
    onSaved(res.data);
    showToast({ message: t('ui.client.profile.saved') });
    signalSpaceChanged();
  }

  return (
    <form id={id} className={s.section} onSubmit={(e) => void save(e)} noValidate aria-labelledby={`${id}-titre`}>
      <div className={s.sectionHead}>
        <h2 id={`${id}-titre`} className={s.sectionTitle}>
          {t(`ui.client.profile.sections.${section}` as MessageKey)}
        </h2>
        {dirty ? <span className={s.dirty}>{t('ui.client.profile.unsavedSection')}</span> : null}
      </div>
      {note}
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <div className={s.fields}>{children(values, set, errors)}</div>
      <div className={s.sectionActions}>
        <Button type="submit" variant="tool" size="M" pending={pending} disabled={!dirty && !pending}>
          {t('ui.client.profile.save')}
        </Button>
      </div>
    </form>
  );
}

function EnumSelect({ name, value, onChange, error }: { name: keyof typeof ENUMS; value: unknown; onChange: (v: string) => void; error?: string }) {
  const id = useId();
  return (
    <SelectField id={id} label={label(name)} optional value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} error={error}>
      <option value="">{label('choose')}</option>
      {ENUMS[name].map((v) => (
        <option key={v} value={v}>
          {t(`ui.enum.${ENUM_NAME[name]}.${v}` as MessageKey)}
        </option>
      ))}
    </SelectField>
  );
}

function Text({ name, value, onChange, error, optional, type = 'text', ...rest }: { name: string; value: unknown; onChange: (v: string) => void; error?: string; optional?: boolean; type?: string } & Record<string, unknown>) {
  const id = useId();
  return <TextField id={id} type={type} label={label(name)} optional={optional} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} error={error} {...rest} />;
}

/** PRO-003 — the nine pieces of information, with the section that holds each (the budget counts once). */
const REQUIRED: { key: string; section: ProfileSection; anchor: string; missing: (p: ClientProfile) => boolean }[] = [
  { key: 'firstName', section: 'identity', anchor: 'identite', missing: (p) => !p.identity.firstName },
  { key: 'lastName', section: 'identity', anchor: 'identite', missing: (p) => !p.identity.lastName },
  { key: 'phone', section: 'contact', anchor: 'coordonnees', missing: (p) => !p.contact.phone },
  { key: 'countryOfResidence', section: 'contact', anchor: 'coordonnees', missing: (p) => !p.contact.countryOfResidence },
  { key: 'residencyStatus', section: 'situation', anchor: 'situation', missing: (p) => !p.situation.residencyStatus },
  { key: 'purchaseTimeframe', section: 'project', anchor: 'projet', missing: (p) => !p.project.purchaseTimeframe },
  { key: 'budget', section: 'project', anchor: 'projet', missing: (p) => !p.project.budgetMax && !p.project.budgetMonthly },
  { key: 'financingPreference', section: 'project', anchor: 'projet', missing: (p) => !p.project.financingPreference },
  { key: 'downPayment', section: 'finances', anchor: 'finances', missing: (p) => !p.finances.downPayment },
];
const SECTIONS: { section: ProfileSection | 'contacts'; anchor: string }[] = [
  { section: 'identity', anchor: 'identite' },
  { section: 'contact', anchor: 'coordonnees' },
  { section: 'situation', anchor: 'situation' },
  { section: 'project', anchor: 'projet' },
  { section: 'finances', anchor: 'finances' },
  { section: 'contacts', anchor: 'proches' },
];

export function ProfileForm({ profile: initialProfile, hasPassword, children }: { profile: ClientProfile; hasPassword: boolean; children?: ReactNode }) {
  const [profile, setProfile] = useState(initialProfile);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const onDirty = useMemo(() => (section: ProfileSection, d: boolean) => setDirty((x) => (x[section] === d ? x : { ...x, [section]: d })), []);
  const anyDirty = Object.values(dirty).some(Boolean);
  const countryId = useId();
  const natId = useId();
  const tzId = useId();
  const curId = useId();
  const budgetCurId = useId();
  const roomsId = useId();
  // The device's zone and the list of zones are the browser's: read after hydration (the server has neither).
  const [deviceZone, setDeviceZone] = useState<string | null>(null);
  const [zones, setZones] = useState<string[]>([]);
  useEffect(() => {
    setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    try {
      setZones((Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone'));
    } catch {
      /* an older browser: the current value only */
    }
  }, []);

  // TRV-093 — leaving the page with unsaved changes asks first: a reload or a close (the browser), a link of the site
  // (UnsavedGuard, D-107).
  useUnsavedGuard(anyDirty);

  const common = { profile, version: profile.version, onSaved: setProfile, onDirty };
  const countries = profile.options.countries;
  const countryName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;

  const missing = REQUIRED.filter((r) => r.missing(profile));
  const progress = { value: profile.completePct, label: t('ui.client.profile.complete', { n: profile.completePct }), tone: profile.completePct >= 100 ? ('green' as const) : ('gold' as const) };

  return (
    <div className={s.split}>
      <UnsavedGuard />
      <aside className={s.rail} aria-label={t('ui.client.profile.rail')}>
        {missing.length === 0 ? (
          <Encouragement tone="done" icon="status-success" title={t('ui.client.profile.encourage.done.title')} text={t('ui.client.profile.encourage.done.text')} progress={progress} />
        ) : (
          <Encouragement tone="progress" icon="user" title={t('ui.client.profile.complete', { n: profile.completePct })} text={t('ui.client.profile.encourage.left', { n: missing.length })} progress={progress} />
        )}
        {missing.length ? (
          <div className={s.missing}>
            <p className={s.missingTitle}>{t('ui.client.profile.missingTitle')}</p>
            <ul role="list" className={s.missingList}>
              {missing.map((m) => (
                <li key={m.key}>
                  <a href={`#${m.anchor}`} className={s.missingChip}>
                    <Icon name="plus" size={16} />
                    {t(`ui.client.profile.missing.${m.key}` as MessageKey)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <nav className={s.railNav} aria-label={t('ui.client.profile.sectionsNav')}>
          <ul role="list">
            {SECTIONS.map((x) => {
              const todo = missing.filter((m) => m.section === x.section).length;
              return (
                <li key={x.anchor}>
                  <a href={`#${x.anchor}`} className={s.railLink}>
                    <span className={[s.railDot, x.section !== 'contacts' && todo === 0 && s.railDotDone].filter(Boolean).join(' ')} aria-hidden="true">
                      {x.section !== 'contacts' && todo === 0 ? <Icon name="check" size={16} /> : null}
                    </span>
                    <span className={s.railLabel}>{t(`ui.client.profile.sections.${x.section}` as MessageKey)}</span>
                    {dirty[x.section] ? <span className={s.dirty}>{t('ui.client.profile.unsavedShort')}</span> : todo ? <span className={s.railTodo}>{t('ui.client.profile.todo', { n: todo })}</span> : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className={s.sections}>

      <Section id="identite" section="identity" {...common}>
        {(v, set, e) => (
          <>
            <Text name="firstName" value={v.firstName} onChange={(x) => set('firstName', x)} error={e.firstName} autoComplete="given-name" />
            <Text name="lastName" value={v.lastName} onChange={(x) => set('lastName', x)} error={e.lastName} autoComplete="family-name" />
            <Text name="birthDate" type="date" optional value={v.birthDate} onChange={(x) => set('birthDate', x)} error={e.birthDate} />
            <div className={s.wide}>
              <SelectField
                id={natId}
                label={label('nationalities')}
                optional
                hint={label('nationalitiesHint')}
                value=""
                disabled={(v.nationalities as string[]).length >= 3}
                onChange={(ev) => {
                  const code = ev.target.value;
                  const list = v.nationalities as string[];
                  if (code && !list.includes(code)) set('nationalities', [...list, code].slice(0, 3));
                }}
                error={e.nationalities}
              >
                <option value="">{label('choose')}</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              <ul role="list" className={s.chips}>
                {(v.nationalities as string[]).map((code) => (
                  <li key={code}>
                    <button type="button" className={s.chip} onClick={() => set('nationalities', (v.nationalities as string[]).filter((x) => x !== code))}>
                      {countryName(code)}
                      <Icon name="close" size={16} label={t('ui.common.delete')} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </Section>

      <Section id="coordonnees" section="contact" {...common}>
        {(v, set, e) => (
          <>
            <div className={`${s.wide} ${s.emailRow}`} id="adresse">
              <EmailChange email={profile.email} pendingEmail={profile.pendingEmail} hasPassword={hasPassword} />
            </div>
            <Text name="phone" type="tel" optional value={v.phone} onChange={(x) => set('phone', x)} error={e.phone} hint={label('phoneHint')} autoComplete="tel" />
            <div className={s.checkCell}>
              <CheckboxField id={`${countryId}-wa`} label={label('whatsappOptIn')} checked={Boolean(v.whatsappOptIn)} onChange={(x) => set('whatsappOptIn', x)} />
            </div>
            <SelectField id={countryId} label={label('countryOfResidence')} optional value={String(v.countryOfResidence ?? '')} onChange={(ev) => set('countryOfResidence', ev.target.value)} error={e.countryOfResidence}>
              <option value="">{label('choose')}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <Text name="cityOfResidence" optional value={v.cityOfResidence} onChange={(x) => set('cityOfResidence', x)} error={e.cityOfResidence} autoComplete="address-level2" />
            <EnumSelect name="preferredContactChannel" value={v.preferredContactChannel} onChange={(x) => set('preferredContactChannel', x)} error={e.preferredContactChannel} />
            <EnumSelect name="preferredContactSlot" value={v.preferredContactSlot} onChange={(x) => set('preferredContactSlot', x)} error={e.preferredContactSlot} />
            <div className={s.wide}>
              <SelectField id={tzId} label={label('timezone')} optional value={String(v.timezone ?? '')} onChange={(ev) => set('timezone', ev.target.value)} error={e.timezone}>
                <option value="">{label('choose')}</option>
                {(zones.length ? zones : [String(v.timezone ?? deviceZone ?? 'Europe/Paris')]).map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, ' ')}
                  </option>
                ))}
              </SelectField>
              {deviceZone && deviceZone !== v.timezone ? (
                <button type="button" className={s.link} onClick={() => set('timezone', deviceZone)}>
                  {t('ui.client.profile.fields.timezoneDetect', { fuseau: deviceZone.replace(/_/g, ' ') })}
                </button>
              ) : null}
            </div>
          </>
        )}
      </Section>

      <Section id="situation" section="situation" {...common}>
        {(v, set, e) => (
          <>
            <EnumSelect name="residencyStatus" value={v.residencyStatus} onChange={(x) => set('residencyStatus', x)} error={e.residencyStatus} />
            <EnumSelect name="employmentType" value={v.employmentType} onChange={(x) => set('employmentType', x)} error={e.employmentType} />
            <Text name="profession" optional value={v.profession} onChange={(x) => set('profession', x)} error={e.profession} />
            <Text name="employerName" optional value={v.employerName} onChange={(x) => set('employerName', x)} error={e.employerName} />
            <Text name="employedSince" type="date" optional value={v.employedSince} onChange={(x) => set('employedSince', x)} error={e.employedSince} />
          </>
        )}
      </Section>

      <Section id="projet" section="project" {...common}>
        {(v, set, e) => (
          <>
            <fieldset className={`${s.wide} ${s.choices}`}>
              <legend className={s.legend}>
                {label('preferredRegionIds')} <span className={s.optional}>{t('ui.common.optional')}</span>
              </legend>
              <div className={s.choiceGrid}>
                {profile.options.regions.map((r) => {
                  const list = v.preferredRegionIds as string[];
                  const on = list.includes(r.id);
                  return (
                    <label key={r.id} className={[s.choice, on && s.choiceOn].filter(Boolean).join(' ')}>
                      <input type="checkbox" checked={on} onChange={() => set('preferredRegionIds', on ? list.filter((x) => x !== r.id) : [...list, r.id].slice(0, 10))} />
                      {r.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className={`${s.wide} ${s.choices}`}>
              <legend className={s.legend}>
                {label('preferredTypes')} <span className={s.optional}>{t('ui.common.optional')}</span>
              </legend>
              <div className={s.choiceGrid}>
                {TYPES.map((ty) => {
                  const list = v.preferredTypes as string[];
                  const on = list.includes(ty);
                  return (
                    <label key={ty} className={[s.choice, on && s.choiceOn].filter(Boolean).join(' ')}>
                      <input type="checkbox" checked={on} onChange={() => set('preferredTypes', on ? list.filter((x) => x !== ty) : [...list, ty])} />
                      {t(`ui.enum.PropertyType.${ty}` as MessageKey)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <SelectField id={roomsId} label={label('minRooms')} optional value={String(v.minRooms ?? '')} onChange={(ev) => set('minRooms', ev.target.value)} error={e.minRooms}>
              <option value="">{label('choose')}</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectField>
            <SelectField id={budgetCurId} label={label('budgetCurrency')} optional value={String(v.budgetCurrency ?? '')} onChange={(ev) => set('budgetCurrency', ev.target.value)} error={e.budgetCurrency}>
              {profile.options.currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
            <Text name="budgetMax" optional inputMode="decimal" value={v.budgetMax} onChange={(x) => set('budgetMax', x)} error={e.budgetMax} suffix={String(v.budgetCurrency ?? '')} />
            <Text name="budgetMonthly" optional inputMode="decimal" value={v.budgetMonthly} onChange={(x) => set('budgetMonthly', x)} error={e.budgetMonthly} suffix={String(v.budgetCurrency ?? '')} />
            <EnumSelect name="purchasePurpose" value={v.purchasePurpose} onChange={(x) => set('purchasePurpose', x)} error={e.purchasePurpose} />
            <EnumSelect name="purchaseTimeframe" value={v.purchaseTimeframe} onChange={(x) => set('purchaseTimeframe', x)} error={e.purchaseTimeframe} />
            <EnumSelect name="financingPreference" value={v.financingPreference} onChange={(x) => set('financingPreference', x)} error={e.financingPreference} />
          </>
        )}
      </Section>

      <Section id="finances" section="finances" {...common} note={<p className={s.note}>{t('ui.client.profile.financesNote')}</p>}>
        {(v, set, e) => (
          <>
            <div className={s.wide}>
              <SelectField
                id={curId}
                label={label('currency')}
                optional
                value={String(v.currency ?? '')}
                onChange={(ev) => {
                  // MOD-303 — changing the currency converts nothing: the amounts are typed again.
                  const changed = v.currency && ev.target.value !== v.currency;
                  set('currency', ev.target.value);
                  if (changed) {
                    for (const k of ['monthlyIncome', 'otherMonthlyIncome', 'monthlyDebts', 'downPayment']) set(k, '');
                    showToast({ message: t('ui.client.profile.currencyChanged'), tone: 'info' });
                  }
                }}
                error={e.currency}
              >
                <option value="">{label('choose')}</option>
                {profile.options.currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
            </div>
            {(['monthlyIncome', 'otherMonthlyIncome', 'monthlyDebts', 'downPayment'] as const).map((k) => (
              <Text key={k} name={k} optional inputMode="decimal" value={v[k]} onChange={(x) => set(k, x)} error={e[k]} suffix={String(v.currency ?? '')} />
            ))}
          </>
        )}
      </Section>
        {children}
      </div>
    </div>
  );
}
