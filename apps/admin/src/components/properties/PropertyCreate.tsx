'use client';
// CTL-041 — create a property, two entries: a TYPOLOGY of a programme (the programme, then type, rooms, surface; place,
// standing, promoter and delivery come from the programme, MOD-200), or a STANDALONE property (promoter, type, rooms,
// surface, country, region, city, standing, delivery, price; its single lot is created with it, MOD-212). The reference
// is given at creation and never changes; the title is generated (MOD-210). Lands on the new record.
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DATE_PRECISIONS, DELIVERY_STATUSES, PROPERTY_TYPES, STANDINGS } from '@dp/contracts';
import { Button, ErrorSummary, Icon } from '@dp/ui';
import { adminCall, newIdempotencyKey } from '@/lib/admin-client';
import { t } from '@/lib/i18n';
import { PageHeader, Surface } from '../shell/Page';
import { SelectInput, TextInput, formStyles as f, useUnsavedGuard } from '../shell/forms';
import { useCatalogueReference } from '../catalogue/reference';
import { catalogueStyles as s, FailureBanner, useCall } from '../catalogue/parts';
import { propertyPath } from './PropertiesList';
import st from './properties.module.css';

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[\s  ]/g, '').replace(',', '.')));

export function PropertyCreate({ programId }: { programId: string | null }) {
  const router = useRouter();
  const ref = useCatalogueReference();
  const [key] = useState(newIdempotencyKey);
  const [mode, setMode] = useState<'typology' | 'standalone'>(programId ? 'typology' : 'typology');
  const [v, setV] = useState({
    programId: programId ?? '',
    promoterId: '',
    type: 'APARTMENT',
    rooms: '3',
    surfaceM2: '',
    countryCode: 'DZ',
    regionId: '',
    cityId: '',
    standing: 'STANDING',
    deliveryStatus: 'ON_PLAN',
    deliveryDate: '',
    deliveryDatePrecision: 'QUARTER',
    price: '',
  });
  const [done, setDone] = useState(false);
  const { pending, failure, errors, run } = useCall();
  useUnsavedGuard(!done && v.surfaceM2 !== '');
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value, ...(k === 'regionId' ? { cityId: '' } : {}) }));
  const programs = (ref?.programs ?? []).filter((p) => p.publication !== 'ARCHIVED');
  const promoters = (ref?.promoters ?? []).filter((p) => p.status !== 'ENDED');
  const regions = (ref?.regions ?? []).filter((r) => r.countryCode === v.countryCode);
  const cities = (ref?.cities ?? []).filter((c) => c.regionId === v.regionId);
  const withRooms = v.type !== 'LAND' && v.type !== 'COMMERCIAL' && v.type !== 'STUDIO';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const common = { type: v.type, rooms: withRooms ? num(v.rooms) : v.type === 'STUDIO' ? 1 : null, surfaceM2: num(v.surfaceM2) };
    const body =
      mode === 'typology'
        ? { ...common, programId: v.programId || null }
        : {
            ...common,
            programId: null,
            promoterId: v.promoterId || undefined,
            countryCode: v.countryCode,
            regionId: v.regionId || undefined,
            cityId: v.cityId || null,
            standing: v.standing,
            deliveryStatus: v.deliveryStatus,
            deliveryDate: v.deliveryDate || null,
            deliveryDatePrecision: v.deliveryDatePrecision,
            price: v.price.replace(/[\s  ]/g, '').replace(',', '.') || undefined,
          };
    const created = await run(() => adminCall<{ id: string }>('/admin/properties', { body, idempotencyKey: key }), t('ui.admin-properties.toast.created'));
    if (created) {
      setDone(true);
      router.push(propertyPath(created.id));
    }
  }
  const labels: Record<string, string> = {
    programId: t('ui.admin-properties.createPage.program'),
    promoterId: t('ui.admin-properties.createPage.promoter'),
    type: t('ui.admin-properties.field.type'),
    rooms: t('ui.admin-properties.field.rooms'),
    surfaceM2: t('ui.admin-properties.field.surface'),
    regionId: t('ui.admin-programs.field.region'),
    standing: t('ui.admin-programs.field.standing'),
    deliveryStatus: t('ui.admin-programs.field.deliveryStatus'),
    deliveryDate: t('ui.admin-programs.field.deliveryDate'),
    price: t('ui.admin-properties.createPage.price'),
  };

  return (
    <div className={s.createPage}>
      <PageHeader
        title={t('ui.admin-properties.createPage.title')}
        crumbs={[{ label: t('ui.admin-shell.menu.group.catalogue') }, { label: t('ui.admin-properties.title'), href: '/catalogue/biens' }, { label: t('ui.admin-properties.createPage.title') }]}
        intro={t('ui.admin-properties.createPage.intro')}
      />
      <form className={s.createForm} onSubmit={submit} noValidate>
        <div className={st.modes} role="radiogroup" aria-label={t('ui.admin-properties.filter.kind')}>
          {(['typology', 'standalone'] as const).map((m) => (
            <label key={m} className={st.mode} data-on={mode === m ? '1' : undefined}>
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
              <Icon name={m === 'typology' ? 'building' : 'home'} size={24} />
              <span>
                <strong>{t(`ui.admin-properties.createPage.${m}`)}</strong>
                <span className={s.sub}>{t(`ui.admin-properties.createPage.${m}Hint`)}</span>
              </span>
            </label>
          ))}
        </div>
        <FailureBanner failure={failure} />
        <ErrorSummary title={t('ui.common.error.summary', { n: Object.keys(errors).length })} items={Object.entries(errors).map(([field, message]) => ({ fieldId: `property-${field}`, label: labels[field] ?? field, message }))} />
        <Surface title={t('ui.admin-properties.section.identity')}>
          <div className={f.form}>
            {mode === 'typology' ? (
              <SelectInput id="property-programId" label={t('ui.admin-properties.createPage.program')} value={v.programId} onChange={set('programId')} error={errors.programId}>
                <option value="" disabled>
                  {t('ui.admin-programs.field.none')}
                </option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectInput>
            ) : (
              <SelectInput id="property-promoterId" label={t('ui.admin-properties.createPage.promoter')} value={v.promoterId} onChange={set('promoterId')} error={errors.promoterId}>
                <option value="" disabled>
                  {t('ui.admin-programs.field.none')}
                </option>
                {promoters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectInput>
            )}
            <div className={f.row}>
              <SelectInput id="property-type" label={t('ui.admin-properties.field.type')} value={v.type} onChange={set('type')} error={errors.type}>
                {PROPERTY_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t(`ui.enum.PropertyType.${x}`)}
                  </option>
                ))}
              </SelectInput>
              {withRooms ? <TextInput id="property-rooms" label={t('ui.admin-properties.field.rooms')} inputMode="numeric" value={v.rooms} onChange={set('rooms')} error={errors.rooms} /> : null}
              <TextInput id="property-surfaceM2" label={t('ui.admin-properties.field.surface')} inputMode="decimal" value={v.surfaceM2} onChange={set('surfaceM2')} error={errors.surfaceM2} />
            </div>
          </div>
        </Surface>
        {mode === 'standalone' ? (
          <>
            <Surface title={t('ui.admin-properties.section.location')}>
              <div className={f.form}>
                <div className={f.row}>
                  <SelectInput id="property-regionId" label={t('ui.admin-programs.field.region')} value={v.regionId} onChange={set('regionId')} error={errors.regionId}>
                    <option value="" disabled>
                      {t('ui.admin-programs.field.none')}
                    </option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </SelectInput>
                  <SelectInput id="property-cityId" label={t('ui.admin-programs.field.city')} optional value={v.cityId} onChange={set('cityId')}>
                    <option value="">{t('ui.admin-programs.field.none')}</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectInput>
                  <SelectInput id="property-standing" label={t('ui.admin-programs.field.standing')} value={v.standing} onChange={set('standing')}>
                    {STANDINGS.map((x) => (
                      <option key={x} value={x}>
                        {t(`ui.enum.Standing.${x}`)}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>
            </Surface>
            <Surface title={t('ui.admin-properties.section.delivery')}>
              <div className={f.row}>
                <SelectInput id="property-deliveryStatus" label={t('ui.admin-programs.field.deliveryStatus')} value={v.deliveryStatus} onChange={set('deliveryStatus')}>
                  {DELIVERY_STATUSES.map((x) => (
                    <option key={x} value={x}>
                      {t(`ui.enum.DeliveryStatus.${x}`)}
                    </option>
                  ))}
                </SelectInput>
                <TextInput id="property-deliveryDate" label={t('ui.admin-programs.field.deliveryDate')} type="date" optional={v.deliveryStatus === 'DELIVERED'} value={v.deliveryDate} onChange={set('deliveryDate')} error={errors.deliveryDate} />
                <SelectInput id="property-deliveryDatePrecision" label={t('ui.admin-programs.field.deliveryPrecision')} value={v.deliveryDatePrecision} onChange={set('deliveryDatePrecision')}>
                  {DATE_PRECISIONS.map((x) => (
                    <option key={x} value={x}>
                      {t(`ui.enum.DatePrecision.${x}`)}
                    </option>
                  ))}
                </SelectInput>
              </div>
            </Surface>
            <Surface title={t('ui.admin-properties.section.lot')}>
              <TextInput id="property-price" label={t('ui.admin-properties.createPage.price')} inputMode="decimal" value={v.price} onChange={set('price')} error={errors.price} />
            </Surface>
          </>
        ) : null}
        <p className={s.sub}>{t('ui.admin-properties.createPage.reference')}</p>
        <div className={f.actions}>
          <Button type="submit" variant="tool" size="M" pending={pending}>
            {t('ui.admin-properties.createPage.submit')}
          </Button>
          <Button type="button" variant="secondary" size="M" onClick={() => router.back()}>
            {t('ui.common.cancel')}
          </Button>
        </div>
      </form>
    </div>
  );
}
