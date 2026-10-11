'use client';
// CTL-022 — a new programme: the essentials (promoter, name, standing, place, delivery), born DRAFT; the rest is
// completed on its record, where it lands. Only promoters whose relationship is not ended are proposed. The form sends
// its idempotency key (TRV-091).
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DATE_PRECISIONS, DELIVERY_STATUSES, STANDINGS } from '@dp/contracts';
import { Button, ErrorSummary, Icon } from '@dp/ui';
import { adminCall, newIdempotencyKey } from '@/lib/admin-client';
import { t } from '@/lib/i18n';
import { PageHeader, Surface } from '../shell/Page';
import { SelectInput, TextInput, formStyles as f, useUnsavedGuard } from '../shell/forms';
import { refreshCatalogueReference, useCatalogueReference } from '../catalogue/reference';
import { catalogueStyles as s, FailureBanner, LinkButton, useCall } from '../catalogue/parts';
import { programPath } from './ProgramsList';

export function ProgramCreate({ promoterId }: { promoterId: string | null }) {
  const router = useRouter();
  const ref = useCatalogueReference();
  const [key] = useState(newIdempotencyKey);
  const [v, setV] = useState({ promoterId: promoterId ?? '', name: '', standing: 'STANDING', countryCode: 'DZ', regionId: '', cityId: '', deliveryStatus: 'ON_PLAN', deliveryDate: '', deliveryDatePrecision: 'QUARTER' });
  const { pending, failure, errors, run } = useCall();
  const [done, setDone] = useState(false);
  useUnsavedGuard(!done && (v.name !== '' || v.regionId !== ''));
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value, ...(k === 'countryCode' ? { regionId: '', cityId: '' } : k === 'regionId' ? { cityId: '' } : {}) }));
  const promoters = (ref?.promoters ?? []).filter((p) => p.status !== 'ENDED');
  const countries = (ref?.countries ?? []).filter((c) => c.catalogueActive);
  const regions = (ref?.regions ?? []).filter((r) => r.countryCode === v.countryCode);
  const cities = (ref?.cities ?? []).filter((c) => c.regionId === v.regionId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { ...v, cityId: v.cityId || null, deliveryDate: v.deliveryDate || null, name: v.name.trim() };
    const created = await run(() => adminCall<{ id: string }>('/admin/programs', { body, idempotencyKey: key }), t('ui.admin-programs.toast.created'));
    if (created) {
      setDone(true);
      refreshCatalogueReference();
      router.push(programPath(created.id));
    }
  }
  const labels: Record<string, string> = {
    promoterId: t('ui.admin-programs.field.promoter'),
    name: t('ui.admin-programs.field.name'),
    regionId: t('ui.admin-programs.field.region'),
    deliveryDate: t('ui.admin-programs.field.deliveryDate'),
  };

  return (
    <div className={s.createPage}>
      <PageHeader
        title={t('ui.admin-programs.createPage.title')}
        crumbs={[{ label: t('ui.admin-shell.menu.group.catalogue') }, { label: t('ui.admin-programs.title'), href: '/catalogue/programmes' }, { label: t('ui.admin-programs.createPage.title') }]}
        intro={t('ui.admin-programs.createPage.intro')}
      />
      {ref && promoters.length === 0 ? (
        <Surface>
          <p className={s.notice}>
            <Icon name="info" size={16} />
            {t('ui.admin-programs.createPage.noPromoter')}
          </p>
          <LinkButton href="/promoteurs" variant="secondary" size="S">
            {t('ui.admin-programs.field.promoter')}
          </LinkButton>
        </Surface>
      ) : (
        <form className={s.createForm} onSubmit={submit} noValidate>
          <FailureBanner failure={failure} />
          <ErrorSummary title={t('ui.common.error.summary', { n: Object.keys(errors).length })} items={Object.entries(errors).map(([field, message]) => ({ fieldId: `program-${field}`, label: labels[field] ?? field, message }))} />
          <Surface title={t('ui.admin-programs.section.identity')}>
            <div className={f.form}>
              <div className={f.row}>
                <SelectInput id="program-promoterId" label={t('ui.admin-programs.field.promoter')} value={v.promoterId} onChange={set('promoterId')} error={errors.promoterId} hint={t('ui.admin-programs.field.promoterHint')}>
                  <option value="" disabled>
                    {t('ui.admin-programs.field.none')}
                  </option>
                  {promoters.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </SelectInput>
                <TextInput id="program-name" label={t('ui.admin-programs.field.name')} value={v.name} onChange={set('name')} maxLength={120} error={errors.name} autoFocus />
              </div>
              <SelectInput id="program-standing" label={t('ui.admin-programs.field.standing')} value={v.standing} onChange={set('standing')} error={errors.standing}>
                {STANDINGS.map((x) => (
                  <option key={x} value={x}>
                    {t(`ui.enum.Standing.${x}`)}
                  </option>
                ))}
              </SelectInput>
            </div>
          </Surface>
          <Surface title={t('ui.admin-programs.section.location')}>
            <div className={f.form}>
              <div className={f.row}>
                <SelectInput id="program-countryCode" label={t('ui.admin-programs.field.country')} value={v.countryCode} onChange={set('countryCode')} error={errors.countryCode}>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
                <SelectInput id="program-regionId" label={t('ui.admin-programs.field.region')} value={v.regionId} onChange={set('regionId')} error={errors.regionId}>
                  <option value="" disabled>
                    {t('ui.admin-programs.field.none')}
                  </option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </SelectInput>
                <SelectInput id="program-cityId" label={t('ui.admin-programs.field.city')} optional value={v.cityId} onChange={set('cityId')} error={errors.cityId}>
                  <option value="">{t('ui.admin-programs.field.none')}</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <p className={s.notice}>
                <Icon name="lock" size={16} />
                {t('ui.admin-programs.field.privateNotice')}
              </p>
            </div>
          </Surface>
          <Surface title={t('ui.admin-programs.section.delivery')}>
            <div className={f.row}>
              <SelectInput id="program-deliveryStatus" label={t('ui.admin-programs.field.deliveryStatus')} value={v.deliveryStatus} onChange={set('deliveryStatus')}>
                {DELIVERY_STATUSES.map((x) => (
                  <option key={x} value={x}>
                    {t(`ui.enum.DeliveryStatus.${x}`)}
                  </option>
                ))}
              </SelectInput>
              <TextInput id="program-deliveryDate" label={t('ui.admin-programs.field.deliveryDate')} type="date" optional={v.deliveryStatus === 'DELIVERED'} value={v.deliveryDate} onChange={set('deliveryDate')} error={errors.deliveryDate} />
              <SelectInput id="program-deliveryDatePrecision" label={t('ui.admin-programs.field.deliveryPrecision')} value={v.deliveryDatePrecision} onChange={set('deliveryDatePrecision')}>
                {DATE_PRECISIONS.map((x) => (
                  <option key={x} value={x}>
                    {t(`ui.enum.DatePrecision.${x}`)}
                  </option>
                ))}
              </SelectInput>
            </div>
          </Surface>
          <div className={f.actions}>
            <Button type="submit" variant="tool" size="M" pending={pending}>
              {t('ui.admin-programs.createPage.submit')}
            </Button>
            <Button type="button" variant="secondary" size="M" onClick={() => router.back()}>
              {t('ui.common.cancel')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
