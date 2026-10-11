'use client';
// CTL-022 — the « Informations » tab of a programme, by sections, each edited in place (BO-046): Identité ·
// Localisation · Livraison · Description · Équipements · Garanties · Mise en avant · Référencement. Changing the place,
// the standing or the delivery of a programme that has properties announces « Ce changement s'applique aux {n} biens du
// programme. » (MOD-201). The exact address and position are never published (FIC-060).
import { DATE_PRECISIONS, DELIVERY_STATUSES, STANDINGS, type AdminProgramDetail } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useCatalogueReference } from '../catalogue/reference';
import { catalogueStyles as s, deliveryLabel, EditableSection, ReadGrid } from '../catalogue/parts';
import { Checkbox, SelectInput, TextArea, TextInput, formStyles as f } from '../shell/forms';

const nullable = (v: string) => (v.trim() === '' ? null : v.trim());

export function ProgramInfo({ program, webUrl }: { program: AdminProgramDetail; webUrl: string }) {
  const ref = useCatalogueReference();
  const p = program;
  const canEdit = p.can.write;
  const patch = (body: Record<string, unknown>) => adminCall(`/admin/programs/${p.id}`, { method: 'PATCH', body: { ...body, version: p.version } });
  const inheritNotice = (changed: boolean) =>
    changed && p.counts.properties > 0 ? (
      <p className={`${s.notice} ${s.noticeWarn}`}>
        <Icon name="info" size={16} />
        {t('ui.admin-programs.inheritNotice', { n: p.counts.properties })}
      </p>
    ) : null;
  const amenityLabel = (code: string) => ref?.amenities.find((a) => a.code === code)?.label ?? code;
  const promoters = (ref?.promoters ?? []).filter((x) => x.status !== 'ENDED' || x.id === p.promoter.id);
  const countries = (ref?.countries ?? []).filter((c) => c.catalogueActive);

  return (
    <div className={s.sectionBody}>
      {/* Identité */}
      <EditableSection
        title={t('ui.admin-programs.section.identity')}
        canEdit={canEdit}
        initial={{ name: p.name, promoterId: p.promoter.id, tagline: p.tagline ?? '', standing: p.standing as string, totalUnits: p.totalUnits === null ? '' : String(p.totalUnits) }}
        save={(v) => patch({ name: v.name.trim(), promoterId: v.promoterId, tagline: nullable(v.tagline), standing: v.standing, totalUnits: v.totalUnits === '' ? null : Number(v.totalUnits) })}
        aside={(v) => inheritNotice(v.standing !== p.standing || v.promoterId !== p.promoter.id)}
        view={
          <ReadGrid
            items={[
              { label: t('ui.admin-programs.field.name'), value: p.name },
              { label: t('ui.admin-programs.field.promoter'), value: p.promoter.name },
              { label: t('ui.admin-programs.field.tagline'), value: p.tagline, wide: true },
              { label: t('ui.admin-programs.field.standing'), value: t(`ui.enum.Standing.${p.standing}`) },
              { label: t('ui.admin-programs.field.totalUnits'), value: p.totalUnits },
            ]}
          />
        }
        form={(v, set, e) => (
          <>
            <div className={f.row}>
              <TextInput label={t('ui.admin-programs.field.name')} value={v.name} onChange={(x) => set('name', x.target.value)} maxLength={120} error={e.name} />
              <SelectInput label={t('ui.admin-programs.field.promoter')} value={v.promoterId} onChange={(x) => set('promoterId', x.target.value)} error={e.promoterId} hint={t('ui.admin-programs.field.promoterHint')}>
                {promoters.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <TextInput label={t('ui.admin-programs.field.tagline')} optional value={v.tagline} onChange={(x) => set('tagline', x.target.value)} maxLength={160} error={e.tagline} />
            <div className={f.row}>
              <SelectInput label={t('ui.admin-programs.field.standing')} value={v.standing} onChange={(x) => set('standing', x.target.value)} error={e.standing}>
                {STANDINGS.map((x) => (
                  <option key={x} value={x}>
                    {t(`ui.enum.Standing.${x}`)}
                  </option>
                ))}
              </SelectInput>
              <TextInput label={t('ui.admin-programs.field.totalUnits')} optional inputMode="numeric" value={v.totalUnits} onChange={(x) => set('totalUnits', x.target.value.replace(/\D/g, ''))} error={e.totalUnits} />
            </div>
          </>
        )}
      />

      {/* Localisation */}
      <EditableSection
        title={t('ui.admin-programs.section.location')}
        canEdit={canEdit}
        initial={{ countryCode: p.countryCode, regionId: p.regionId, cityId: p.cityId ?? '', addressLine: p.addressLine ?? '', latitude: p.latitude === null ? '' : String(p.latitude), longitude: p.longitude === null ? '' : String(p.longitude) }}
        save={(v) =>
          patch({
            countryCode: v.countryCode,
            regionId: v.regionId,
            cityId: v.cityId || null,
            addressLine: nullable(v.addressLine),
            latitude: v.latitude === '' ? null : Number(v.latitude.replace(',', '.')),
            longitude: v.longitude === '' ? null : Number(v.longitude.replace(',', '.')),
          })
        }
        aside={(v) => inheritNotice(v.countryCode !== p.countryCode || v.regionId !== p.regionId || v.cityId !== (p.cityId ?? ''))}
        view={
          <>
            <ReadGrid
              items={[
                { label: t('ui.admin-programs.field.country'), value: p.country },
                { label: t('ui.admin-programs.field.region'), value: p.region },
                { label: t('ui.admin-programs.field.city'), value: p.city },
                { label: t('ui.admin-programs.field.addressLine'), value: p.addressLine },
                {
                  label: t('ui.admin-programs.field.position'),
                  value:
                    p.latitude !== null && p.longitude !== null ? (
                      <a href={`https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=16/${p.latitude}/${p.longitude}`} target="_blank" rel="noreferrer" className={f.link}>
                        {`${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`} · {t('ui.admin-programs.field.openMap')}
                      </a>
                    ) : (
                      t('ui.admin-programs.field.noPosition')
                    ),
                  wide: true,
                },
              ]}
            />
            <p className={s.notice}>
              <Icon name="lock" size={16} />
              {t('ui.admin-programs.field.privateNotice')}
            </p>
          </>
        }
        form={(v, set, e) => {
          const regions = (ref?.regions ?? []).filter((r) => r.countryCode === v.countryCode);
          const cities = (ref?.cities ?? []).filter((c) => c.regionId === v.regionId);
          return (
            <>
              <div className={f.row}>
                <SelectInput label={t('ui.admin-programs.field.country')} value={v.countryCode} onChange={(x) => (set('countryCode', x.target.value), set('regionId', ''), set('cityId', ''))} error={e.countryCode}>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
                <SelectInput label={t('ui.admin-programs.field.region')} value={v.regionId} onChange={(x) => (set('regionId', x.target.value), set('cityId', ''))} error={e.regionId}>
                  <option value="" disabled>
                    {t('ui.admin-programs.field.none')}
                  </option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div className={f.row}>
                <SelectInput label={t('ui.admin-programs.field.city')} optional value={v.cityId} onChange={(x) => set('cityId', x.target.value)} error={e.cityId} hint={t('ui.admin-programs.field.cityHint')}>
                  <option value="">{t('ui.admin-programs.field.none')}</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
                <TextInput label={t('ui.admin-programs.field.addressLine')} optional value={v.addressLine} onChange={(x) => set('addressLine', x.target.value)} maxLength={200} error={e.addressLine} />
              </div>
              <div className={f.row}>
                <TextInput label={t('ui.admin-programs.field.latitude')} optional inputMode="decimal" value={v.latitude} onChange={(x) => set('latitude', x.target.value)} error={e.latitude} />
                <TextInput label={t('ui.admin-programs.field.longitude')} optional inputMode="decimal" value={v.longitude} onChange={(x) => set('longitude', x.target.value)} error={e.longitude} />
              </div>
              <p className={s.notice}>
                <Icon name="lock" size={16} />
                {t('ui.admin-programs.field.privateNotice')}
              </p>
            </>
          );
        }}
      />

      {/* Livraison */}
      <EditableSection
        title={t('ui.admin-programs.section.delivery')}
        canEdit={canEdit}
        initial={{ deliveryStatus: p.deliveryStatus as string, deliveryDate: p.deliveryDate ?? '', deliveryDatePrecision: p.deliveryDatePrecision as string }}
        save={(v) => patch({ deliveryStatus: v.deliveryStatus, deliveryDate: v.deliveryDate || null, deliveryDatePrecision: v.deliveryDatePrecision })}
        aside={(v) => inheritNotice(v.deliveryStatus !== p.deliveryStatus || v.deliveryDate !== (p.deliveryDate ?? '') || v.deliveryDatePrecision !== p.deliveryDatePrecision)}
        view={
          <ReadGrid
            items={[
              { label: t('ui.admin-programs.field.deliveryStatus'), value: t(`ui.enum.DeliveryStatus.${p.deliveryStatus}`) },
              {
                label: t('ui.admin-programs.field.deliveryDate'),
                value: p.deliveryLate ? (
                  <span className={s.late}>
                    <Icon name="status-warning" size={16} />
                    {deliveryLabel(p.deliveryStatus, p.deliveryDate, p.deliveryDatePrecision)} · {t('ui.admin-programs.common.delivery.late')}
                  </span>
                ) : (
                  deliveryLabel(p.deliveryStatus === 'DELIVERED' ? 'ON_PLAN' : p.deliveryStatus, p.deliveryDate, p.deliveryDatePrecision)
                ),
              },
            ]}
          />
        }
        form={(v, set, e) => (
          <div className={f.row}>
            <SelectInput label={t('ui.admin-programs.field.deliveryStatus')} value={v.deliveryStatus} onChange={(x) => set('deliveryStatus', x.target.value)} error={e.deliveryStatus}>
              {DELIVERY_STATUSES.map((x) => (
                <option key={x} value={x}>
                  {t(`ui.enum.DeliveryStatus.${x}`)}
                </option>
              ))}
            </SelectInput>
            <TextInput label={t('ui.admin-programs.field.deliveryDate')} type="date" optional={v.deliveryStatus === 'DELIVERED'} value={v.deliveryDate} onChange={(x) => set('deliveryDate', x.target.value)} error={e.deliveryDate} />
            <SelectInput label={t('ui.admin-programs.field.deliveryPrecision')} value={v.deliveryDatePrecision} onChange={(x) => set('deliveryDatePrecision', x.target.value)}>
              {DATE_PRECISIONS.map((x) => (
                <option key={x} value={x}>
                  {t(`ui.enum.DatePrecision.${x}`)}
                </option>
              ))}
            </SelectInput>
          </div>
        )}
      />

      {/* Description */}
      <EditableSection
        title={t('ui.admin-programs.section.description')}
        canEdit={canEdit}
        initial={{ description: p.description ?? '' }}
        save={(v) => patch({ description: nullable(v.description) })}
        view={p.description ? <p className={s.prose}>{p.description}</p> : <p className={s.muted}>{t('ui.admin-programs.common.missing.DESCRIPTION_LENGTH')}</p>}
        form={(v, set, e) => (
          <TextArea label={t('ui.admin-programs.field.description')} value={v.description} onChange={(x) => set('description', x.target.value)} maxLength={5000} rows={10} error={e.description} hint={t('ui.admin-programs.field.descriptionHint')} />
        )}
      />

      {/* Équipements */}
      <EditableSection
        title={t('ui.admin-programs.section.amenities')}
        canEdit={canEdit}
        initial={{ amenities: p.amenities }}
        save={(v) => patch({ amenities: v.amenities })}
        view={
          p.amenities.length ? (
            <ul className={s.chips}>
              {p.amenities.map((a) => (
                <li key={a} className={s.chip}>
                  {amenityLabel(a)}
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.muted}>{t('ui.admin-programs.field.none')}</p>
          )
        }
        form={(v, set) => (
          <div className={s.checkGrid}>
            {(ref?.amenities ?? []).map((a) => (
              <Checkbox key={a.code} label={a.label} checked={v.amenities.includes(a.code)} onChange={(on) => set('amenities', on ? [...v.amenities, a.code] : v.amenities.filter((x) => x !== a.code))} />
            ))}
          </div>
        )}
      />

      {/* Garanties · Mise en avant */}
      <div className={s.twoCols}>
        <EditableSection
          title={t('ui.admin-programs.section.guarantees')}
          canEdit={canEdit}
          initial={{ guarantees: p.guarantees ?? '' }}
          save={(v) => patch({ guarantees: nullable(v.guarantees) })}
          view={p.guarantees ? <p className={s.prose}>{p.guarantees}</p> : <p className={s.muted}>{t('ui.admin-programs.field.none')}</p>}
          form={(v, set, e) => <TextArea label={t('ui.admin-programs.field.guarantees')} value={v.guarantees} onChange={(x) => set('guarantees', x.target.value)} maxLength={600} rows={5} error={e.guarantees} />}
        />
        <EditableSection
          title={t('ui.admin-programs.section.highlight')}
          canEdit={canEdit}
          initial={{ highlightLabel: p.highlightLabel ?? '', highlightUntil: p.highlightUntil ?? '' }}
          save={(v) => patch({ highlightLabel: nullable(v.highlightLabel), highlightUntil: v.highlightUntil || null })}
          view={
            <ReadGrid
              items={[
                { label: t('ui.admin-programs.field.highlightLabel'), value: p.highlightLabel },
                { label: t('ui.admin-programs.field.highlightUntil'), value: p.highlightUntil ? shortDay(p.highlightUntil) : null },
              ]}
            />
          }
          form={(v, set, e) => (
            <div className={f.row}>
              <TextInput label={t('ui.admin-programs.field.highlightLabel')} optional value={v.highlightLabel} onChange={(x) => set('highlightLabel', x.target.value)} maxLength={40} error={e.highlightLabel} />
              <TextInput label={t('ui.admin-programs.field.highlightUntil')} optional type="date" value={v.highlightUntil} onChange={(x) => set('highlightUntil', x.target.value)} error={e.highlightUntil} />
            </div>
          )}
        />
      </div>

      {/* Référencement */}
      <EditableSection
        title={t('ui.admin-programs.section.seo')}
        canEdit={canEdit}
        initial={{ seoTitle: p.seoTitle ?? '', seoDescription: p.seoDescription ?? '' }}
        save={(v) => patch({ seoTitle: nullable(v.seoTitle), seoDescription: nullable(v.seoDescription) })}
        view={<SerpPreview url={`${webUrl}/programmes/${p.slug}`} title={p.seoTitle || p.name} text={p.seoDescription || p.tagline || p.description || ''} />}
        form={(v, set, e) => (
          <>
            <TextInput label={t('ui.admin-programs.field.seoTitle')} optional value={v.seoTitle} onChange={(x) => set('seoTitle', x.target.value)} maxLength={70} error={e.seoTitle} hint={`${v.seoTitle.length} / 70`} />
            <TextArea label={t('ui.admin-programs.field.seoDescription')} optional value={v.seoDescription} onChange={(x) => set('seoDescription', x.target.value)} maxLength={160} rows={3} error={e.seoDescription} />
            <SerpPreview url={`${webUrl}/programmes/${p.slug}`} title={v.seoTitle || p.name} text={v.seoDescription || p.tagline || p.description || ''} />
          </>
        )}
      />
    </div>
  );
}

/** CTL-022 — « aperçu du résultat de recherche ». */
export function SerpPreview({ url, title, text }: { url: string; title: string; text: string }) {
  return (
    <figure className={s.serp} aria-label={t('ui.admin-programs.field.seoPreview')}>
      <span className={s.serpUrl}>{url.replace(/^https?:\/\//, '')}</span>
      <span className={s.serpTitle}>{title.length > 70 ? `${title.slice(0, 69)}…` : title}</span>
      <span className={s.serpText}>{text.length > 160 ? `${text.slice(0, 159)}…` : text}</span>
    </figure>
  );
}
