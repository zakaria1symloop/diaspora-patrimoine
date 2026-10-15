'use client';
// CTL-042 — the « Informations » tab of a property, by sections: Identité (type, rooms, bedrooms, bathrooms, title and
// description with « automatique » / « Revenir au … automatique », MOD-210, MOD-211) · Surfaces · Caractéristiques ·
// Livraison (« Reprendre la livraison du programme ») · Localisation (standalone only) · Prix et lot (standalone only:
// its single lot, CTL-063) · Mise en avant (label, end date, home pin with its rank, CTL-150) · Référencement. After the
// first publication, type, rooms and programme are locked once the property received a request (MOD-213).
import { useState } from 'react';
import { DATE_PRECISIONS, DELIVERY_STATUSES, ORIENTATIONS, PROPERTY_TYPES, STANDINGS, type AdminPropertyDetail } from '@dp/contracts';
import { Button, Icon, StatusTag } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { DASH, money, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Checkbox, SelectInput, TextArea, TextInput, formStyles as f } from '../shell/forms';
import { useCatalogueReference } from '../catalogue/reference';
import { catalogueStyles as s, deliveryLabel, EditableSection, ReadGrid } from '../catalogue/parts';
import { LOT_STATUS_TONE, LotStatusDialog, PropagateDeliveryDialog } from '../lots/LotsTable';
import { SerpPreview } from '../programs/ProgramInfo';
import { PinDialog } from './PinDialog';

const nullable = (v: string) => (v.trim() === '' ? null : v.trim());
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[\s  ]/g, '').replace(',', '.')));
const m2 = (v: string | null) => (v ? `${Number(v).toLocaleString('fr-FR')} m²` : null);

export function PropertyInfo({ property, webUrl, onChanged }: { property: AdminPropertyDetail; webUrl: string; onChanged: () => void }) {
  const ref = useCatalogueReference();
  const p = property;
  const canEdit = p.can.write;
  const [lotStatus, setLotStatus] = useState(false);
  // CTL-060 — saved as « Livré »: propose to carry the date over to its lots
  const [propagate, setPropagate] = useState(false);
  const [pin, setPin] = useState(false);
  const patch = (body: Record<string, unknown>) => adminCall(`/admin/properties/${p.id}`, { method: 'PATCH', body: { ...body, version: p.version } });
  const featureLabel = (code: string) => ref?.features.find((x) => x.code === code)?.label ?? code;
  const rooms = p.type !== 'LAND' && p.type !== 'COMMERCIAL';
  const standalone = !p.program;
  const lockNotice = p.identityLocked ? (
    <p className={`${s.notice} ${s.noticeWarn}`}>
      <Icon name="lock" size={16} />
      {t('ui.admin-properties.field.locked')}
    </p>
  ) : null;

  return (
    <div className={s.sectionBody}>
      {/* Identité */}
      <EditableSection
        id="identite"
        title={t('ui.admin-properties.section.identity')}
        canEdit={canEdit}
        initial={{
          type: p.type as string,
          rooms: p.rooms === null ? '' : String(p.rooms),
          bedrooms: p.bedrooms === null ? '' : String(p.bedrooms),
          bathrooms: p.bathrooms === null ? '' : String(p.bathrooms),
          titleAuto: p.titleAuto,
          title: p.title,
          descriptionAuto: p.descriptionAuto,
          description: p.description ?? '',
        }}
        save={(v) =>
          patch({
            ...(p.identityLocked ? {} : { type: v.type, rooms: v.type === 'LAND' || v.type === 'COMMERCIAL' ? null : v.type === 'STUDIO' ? 1 : num(v.rooms) }),
            bedrooms: num(v.bedrooms),
            bathrooms: num(v.bathrooms),
            ...(v.titleAuto ? (p.titleAuto ? {} : { titleAuto: true }) : v.title.trim() !== p.title || p.titleAuto ? { title: v.title.trim() } : {}),
            ...(v.descriptionAuto ? (p.descriptionAuto ? {} : { descriptionAuto: true }) : v.description.trim() !== (p.description ?? '') || p.descriptionAuto ? { description: v.description.trim() } : {}),
          })
        }
        view={
          <>
            <ReadGrid
              columns={3}
              items={[
                { label: t('ui.admin-properties.field.type'), value: t(`ui.enum.PropertyType.${p.type}`) },
                { label: t('ui.admin-properties.field.rooms'), value: rooms ? p.rooms : null },
                { label: t('ui.admin-properties.field.bedrooms'), value: p.bedrooms },
                { label: t('ui.admin-properties.field.bathrooms'), value: p.bathrooms },
                {
                  label: t('ui.admin-properties.field.title'),
                  value: (
                    <span className={s.tags}>
                      {p.title}
                      {p.titleAuto ? <StatusTag tone="neutral">{t('ui.admin-properties.field.titleAuto')}</StatusTag> : null}
                    </span>
                  ),
                  wide: true,
                },
              ]}
            />
            <div>
              <span className={s.sub}>
                {t('ui.admin-properties.field.description')}
                {p.descriptionAuto ? ` · ${t('ui.admin-properties.field.descriptionAuto')}` : ''}
              </span>
              <p className={s.prose}>{p.description ?? DASH}</p>
            </div>
            {lockNotice}
          </>
        }
        form={(v, set, e) => (
          <>
            {lockNotice}
            <div className={f.row}>
              <SelectInput label={t('ui.admin-properties.field.type')} value={v.type} onChange={(x) => set('type', x.target.value)} disabled={p.identityLocked} error={e.type}>
                {PROPERTY_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t(`ui.enum.PropertyType.${x}`)}
                  </option>
                ))}
              </SelectInput>
              {v.type !== 'LAND' && v.type !== 'COMMERCIAL' && v.type !== 'STUDIO' ? (
                <TextInput label={t('ui.admin-properties.field.rooms')} inputMode="numeric" value={v.rooms} onChange={(x) => set('rooms', x.target.value.replace(/\D/g, ''))} disabled={p.identityLocked} error={e.rooms} />
              ) : null}
              <TextInput label={t('ui.admin-properties.field.bedrooms')} optional inputMode="numeric" value={v.bedrooms} onChange={(x) => set('bedrooms', x.target.value.replace(/\D/g, ''))} error={e.bedrooms} />
              <TextInput label={t('ui.admin-properties.field.bathrooms')} optional inputMode="numeric" value={v.bathrooms} onChange={(x) => set('bathrooms', x.target.value.replace(/\D/g, ''))} error={e.bathrooms} />
            </div>
            <Checkbox label={t('ui.admin-properties.field.titleAuto')} checked={v.titleAuto} onChange={(on) => set('titleAuto', on)} />
            {!v.titleAuto ? <TextInput label={t('ui.admin-properties.field.title')} value={v.title} onChange={(x) => set('title', x.target.value)} maxLength={120} error={e.title} /> : <p className={s.sub}>{p.title}</p>}
            <Checkbox label={t('ui.admin-properties.field.descriptionAuto')} checked={v.descriptionAuto} onChange={(on) => set('descriptionAuto', on)} />
            {!v.descriptionAuto ? (
              <TextArea label={t('ui.admin-properties.field.description')} value={v.description} onChange={(x) => set('description', x.target.value)} maxLength={5000} rows={8} error={e.description} />
            ) : (
              <p className={s.sub}>{t('ui.admin-properties.field.autoHint')}</p>
            )}
          </>
        )}
      />

      <div className={s.twoCols}>
        {/* Surfaces */}
        <EditableSection
          id="surfaces"
          title={t('ui.admin-properties.section.surfaces')}
          canEdit={canEdit}
          initial={{ surfaceM2: String(Number(p.surfaceM2)), terraceM2: p.terraceM2 ? String(Number(p.terraceM2)) : '', landM2: p.landM2 ? String(Number(p.landM2)) : '' }}
          save={(v) => patch({ surfaceM2: num(v.surfaceM2), terraceM2: num(v.terraceM2), landM2: num(v.landM2) })}
          view={
            <ReadGrid
              items={[
                { label: t('ui.admin-properties.field.surface'), value: m2(p.surfaceM2) },
                { label: t('ui.admin-properties.field.terrace'), value: m2(p.terraceM2) },
                { label: t('ui.admin-properties.field.land'), value: m2(p.landM2) },
              ]}
            />
          }
          form={(v, set, e) => (
            <div className={f.row}>
              <TextInput label={t('ui.admin-properties.field.surface')} inputMode="decimal" value={v.surfaceM2} onChange={(x) => set('surfaceM2', x.target.value)} error={e.surfaceM2} />
              <TextInput label={t('ui.admin-properties.field.terrace')} optional inputMode="decimal" value={v.terraceM2} onChange={(x) => set('terraceM2', x.target.value)} error={e.terraceM2} />
              <TextInput label={t('ui.admin-properties.field.land')} optional inputMode="decimal" value={v.landM2} onChange={(x) => set('landM2', x.target.value)} error={e.landM2} />
            </div>
          )}
        />

        {/* Livraison */}
        <EditableSection
          id="livraison"
          title={t('ui.admin-properties.section.delivery')}
          canEdit={canEdit}
          initial={{ follow: Boolean(p.program) && !p.deliveryOverridden, deliveryStatus: p.deliveryStatus as string, deliveryDate: p.deliveryDate ?? '', deliveryDatePrecision: p.deliveryDatePrecision as string }}
          save={async (v) => {
            const own = !(p.program && v.follow);
            const r = await patch(own ? { deliveryStatus: v.deliveryStatus, deliveryDate: v.deliveryDate || null, deliveryDatePrecision: v.deliveryDatePrecision } : { deliveryOverridden: false });
            if (r.ok && own && v.deliveryStatus === 'DELIVERED' && p.deliveryStatus !== 'DELIVERED') setPropagate(true);
            return r;
          }}
          view={
            <ReadGrid
              items={[
                { label: t('ui.admin-programs.field.deliveryStatus'), value: t(`ui.enum.DeliveryStatus.${p.deliveryStatus}`) },
                { label: t('ui.admin-programs.field.deliveryDate'), value: deliveryLabel('ON_PLAN', p.deliveryDate, p.deliveryDatePrecision) },
                ...(p.program ? [{ label: t('ui.admin-properties.field.followProgram'), value: p.deliveryOverridden ? t('ui.common.no') : t('ui.common.yes'), wide: true }] : []),
              ]}
            />
          }
          form={(v, set, e) => (
            <>
              {p.program ? (
                <>
                  <Checkbox label={t('ui.admin-properties.field.followProgram')} checked={v.follow} onChange={(on) => set('follow', on)} />
                  <p className={s.sub}>{t('ui.admin-properties.field.programDelivery', { livraison: `${t(`ui.enum.DeliveryStatus.${p.program.deliveryStatus}`)} · ${deliveryLabel(p.program.deliveryStatus, p.program.deliveryDate, p.program.deliveryDatePrecision)}` })}</p>
                </>
              ) : null}
              {!p.program || !v.follow ? (
                <div className={f.row}>
                  <SelectInput label={t('ui.admin-programs.field.deliveryStatus')} value={v.deliveryStatus} onChange={(x) => set('deliveryStatus', x.target.value)}>
                    {DELIVERY_STATUSES.map((x) => (
                      <option key={x} value={x}>
                        {t(`ui.enum.DeliveryStatus.${x}`)}
                      </option>
                    ))}
                  </SelectInput>
                  <TextInput label={t('ui.admin-programs.field.deliveryDate')} type="date" value={v.deliveryDate} onChange={(x) => set('deliveryDate', x.target.value)} error={e.deliveryDate} />
                  <SelectInput label={t('ui.admin-programs.field.deliveryPrecision')} value={v.deliveryDatePrecision} onChange={(x) => set('deliveryDatePrecision', x.target.value)}>
                    {DATE_PRECISIONS.map((x) => (
                      <option key={x} value={x}>
                        {t(`ui.enum.DatePrecision.${x}`)}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              ) : null}
            </>
          )}
        />
      </div>

      {/* Caractéristiques */}
      <EditableSection
        id="caracteristiques"
        title={t('ui.admin-properties.section.features')}
        canEdit={canEdit}
        initial={{ features: p.features }}
        save={(v) => patch({ features: v.features })}
        view={
          p.features.length ? (
            <ul className={s.chips}>
              {p.features.map((x) => (
                <li key={x} className={s.chip}>
                  {featureLabel(x)}
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.muted}>{t('ui.admin-programs.field.none')}</p>
          )
        }
        form={(v, set) => (
          <div className={s.checkGrid}>
            {(ref?.features ?? []).map((x) => (
              <Checkbox key={x.code} label={x.label} checked={v.features.includes(x.code)} onChange={(on) => set('features', on ? [...v.features, x.code] : v.features.filter((c) => c !== x.code))} />
            ))}
          </div>
        )}
      />

      {standalone ? (
        <>
          {/* Localisation (standalone) */}
          <EditableSection
            id="localisation"
            title={t('ui.admin-properties.section.location')}
            canEdit={canEdit}
            initial={{ promoterId: p.promoter.id, standing: p.standing as string, regionId: p.regionId, cityId: p.cityId ?? '', addressLine: p.addressLine ?? '', latitude: p.latitude === null ? '' : String(p.latitude), longitude: p.longitude === null ? '' : String(p.longitude) }}
            save={(v) => patch({ promoterId: v.promoterId, standing: v.standing, regionId: v.regionId, cityId: v.cityId || null, addressLine: nullable(v.addressLine), latitude: num(v.latitude), longitude: num(v.longitude) })}
            view={
              <>
                <ReadGrid
                  columns={3}
                  items={[
                    { label: t('ui.admin-properties.detail.aside.promoter'), value: p.promoter.name },
                    { label: t('ui.admin-programs.field.standing'), value: t(`ui.enum.Standing.${p.standing}`) },
                    { label: t('ui.admin-programs.field.country'), value: p.country },
                    { label: t('ui.admin-programs.field.region'), value: p.region },
                    { label: t('ui.admin-programs.field.city'), value: p.city },
                    { label: t('ui.admin-programs.field.addressLine'), value: p.addressLine },
                    { label: t('ui.admin-programs.field.position'), value: p.latitude !== null && p.longitude !== null ? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}` : t('ui.admin-programs.field.noPosition'), wide: true },
                  ]}
                />
                <p className={s.notice}>
                  <Icon name="lock" size={16} />
                  {t('ui.admin-programs.field.privateNotice')}
                </p>
              </>
            }
            form={(v, set, e) => (
              <>
                <div className={f.row}>
                  <SelectInput label={t('ui.admin-properties.detail.aside.promoter')} value={v.promoterId} onChange={(x) => set('promoterId', x.target.value)} error={e.promoterId}>
                    {(ref?.promoters ?? []).filter((x) => x.status !== 'ENDED' || x.id === p.promoter.id).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </SelectInput>
                  <SelectInput label={t('ui.admin-programs.field.standing')} value={v.standing} onChange={(x) => set('standing', x.target.value)}>
                    {STANDINGS.map((x) => (
                      <option key={x} value={x}>
                        {t(`ui.enum.Standing.${x}`)}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div className={f.row}>
                  <SelectInput label={t('ui.admin-programs.field.region')} value={v.regionId} onChange={(x) => (set('regionId', x.target.value), set('cityId', ''))} error={e.regionId}>
                    {(ref?.regions ?? []).filter((r) => r.countryCode === p.countryCode).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </SelectInput>
                  <SelectInput label={t('ui.admin-programs.field.city')} optional value={v.cityId} onChange={(x) => set('cityId', x.target.value)} error={e.cityId}>
                    <option value="">{t('ui.admin-programs.field.none')}</option>
                    {(ref?.cities ?? []).filter((c) => c.regionId === v.regionId).map((c) => (
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
              </>
            )}
          />

          {/* Prix et lot (standalone, CTL-063) */}
          {p.lot ? (
            <EditableSection
              id="prix"
              title={t('ui.admin-properties.section.lot')}
              canEdit={canEdit}
              initial={{ price: String(Number(p.lot.price)), floor: p.lot.floor === null ? '' : String(p.lot.floor), orientation: p.lot.orientation ?? '', parking: p.lot.parkingIncluded === null ? '' : p.lot.parkingIncluded ? 'yes' : 'no', extras: p.lot.extras ?? '' }}
              save={(v) =>
                adminCall(`/admin/lots/${p.lot!.id}`, {
                  method: 'PATCH',
                  body: { version: p.lot!.version, price: String(num(v.price) ?? ''), floor: num(v.floor), orientation: v.orientation || null, parkingIncluded: v.parking === '' ? null : v.parking === 'yes', extras: nullable(v.extras) },
                })
              }
              onSaved={onChanged}
              view={
                <>
                  <ReadGrid
                    columns={3}
                    items={[
                      { label: t('ui.admin-properties.field.price'), value: <strong>{money(p.lot.price, p.currency)}</strong> },
                      {
                        label: t('ui.admin-properties.field.lotStatus'),
                        value: (
                          <span className={s.tags}>
                            <StatusTag tone={LOT_STATUS_TONE[p.lot.status] ?? 'neutral'}>{t(`ui.enum.LotStatus.${p.lot.status as 'AVAILABLE'}`)}</StatusTag>
                            {canEdit ? (
                              <Button variant="tertiary" size="S" onClick={() => setLotStatus(true)}>
                                {t('ui.admin-programs.lots.status')}
                              </Button>
                            ) : null}
                          </span>
                        ),
                      },
                      { label: t('ui.admin-properties.field.floor'), value: p.lot.floor === null ? null : p.lot.floor === 0 ? t('ui.admin-programs.lots.groundFloor') : p.lot.floor },
                      { label: t('ui.admin-properties.field.orientation'), value: p.lot.orientation ? t(`ui.enum.Orientation.${p.lot.orientation}`) : null },
                      { label: t('ui.admin-properties.field.parking'), value: p.lot.parkingIncluded === null ? null : p.lot.parkingIncluded ? t('ui.common.yes') : t('ui.common.no') },
                      { label: t('ui.admin-properties.field.extras'), value: p.lot.extras },
                    ]}
                  />
                </>
              }
              form={(v, set, e) => (
                <>
                  <div className={f.row}>
                    <TextInput label={`${t('ui.admin-properties.field.price')} (${p.currency})`} inputMode="decimal" value={v.price} onChange={(x) => set('price', x.target.value)} error={e.price} />
                    <TextInput label={t('ui.admin-properties.field.floor')} optional inputMode="numeric" value={v.floor} onChange={(x) => set('floor', x.target.value)} error={e.floor} />
                    <SelectInput label={t('ui.admin-properties.field.orientation')} optional value={v.orientation} onChange={(x) => set('orientation', x.target.value)}>
                      <option value="">{DASH}</option>
                      {ORIENTATIONS.map((o) => (
                        <option key={o} value={o}>
                          {t(`ui.enum.Orientation.${o}`)}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className={f.row}>
                    <SelectInput label={t('ui.admin-properties.field.parking')} optional value={v.parking} onChange={(x) => set('parking', x.target.value)}>
                      <option value="">{DASH}</option>
                      <option value="yes">{t('ui.common.yes')}</option>
                      <option value="no">{t('ui.common.no')}</option>
                    </SelectInput>
                    <TextInput label={t('ui.admin-properties.field.extras')} optional value={v.extras} onChange={(x) => set('extras', x.target.value)} maxLength={300} error={e.extras} />
                  </div>
                </>
              )}
            />
          ) : null}
        </>
      ) : null}

      <div className={s.twoCols}>
        {/* Mise en avant */}
        <EditableSection
          id="mise-en-avant"
          title={t('ui.admin-properties.section.highlight')}
          canEdit={canEdit}
          initial={{ highlightLabel: p.highlightLabel ?? '', highlightUntil: p.highlightUntil ?? '' }}
          save={(v) => patch({ highlightLabel: nullable(v.highlightLabel), highlightUntil: v.highlightUntil || null })}
          view={
            <>
              <ReadGrid
                items={[
                  { label: t('ui.admin-properties.field.highlightLabel'), value: p.highlightLabel },
                  { label: t('ui.admin-properties.field.highlightUntil'), value: p.highlightUntil ? shortDay(p.highlightUntil) : null },
                  {
                    label: t('ui.admin-properties.field.pinned'),
                    value: (
                      <span className={s.tags}>
                        {p.featuredRank ? <StatusTag tone="info" icon="star">{t('ui.admin-properties.field.pinnedRank', { n: p.featuredRank })}</StatusTag> : t('ui.admin-properties.field.notPinned')}
                        {p.can.publish && (p.featuredRank || p.publication === 'PUBLISHED') ? (
                          <Button variant="tertiary" size="S" icon="star" onClick={() => setPin(true)}>
                            {t('ui.admin-properties.action.pin')}
                          </Button>
                        ) : null}
                      </span>
                    ),
                    wide: true,
                  },
                ]}
              />
            </>
          }
          form={(v, set, e) => (
            <div className={f.row}>
              <TextInput label={t('ui.admin-properties.field.highlightLabel')} optional value={v.highlightLabel} onChange={(x) => set('highlightLabel', x.target.value)} maxLength={40} error={e.highlightLabel} />
              <TextInput label={t('ui.admin-properties.field.highlightUntil')} optional type="date" value={v.highlightUntil} onChange={(x) => set('highlightUntil', x.target.value)} error={e.highlightUntil} />
            </div>
          )}
        />

        {/* Référencement */}
        <EditableSection
          id="referencement"
          title={t('ui.admin-programs.section.seo')}
          canEdit={canEdit}
          initial={{ seoTitle: p.seoTitle ?? '', seoDescription: p.seoDescription ?? '' }}
          save={(v) => patch({ seoTitle: nullable(v.seoTitle), seoDescription: nullable(v.seoDescription) })}
          view={<SerpPreview url={`${webUrl}/biens/${p.slug}`} title={p.seoTitle || p.title} text={p.seoDescription || p.description || ''} />}
          form={(v, set, e) => (
            <>
              <TextInput label={t('ui.admin-programs.field.seoTitle')} optional value={v.seoTitle} onChange={(x) => set('seoTitle', x.target.value)} maxLength={70} error={e.seoTitle} hint={`${v.seoTitle.length} / 70`} />
              <TextArea label={t('ui.admin-programs.field.seoDescription')} optional value={v.seoDescription} onChange={(x) => set('seoDescription', x.target.value)} maxLength={160} rows={3} error={e.seoDescription} />
              <SerpPreview url={`${webUrl}/biens/${p.slug}`} title={v.seoTitle || p.title} text={v.seoDescription || p.description || ''} />
            </>
          )}
        />
      </div>

      {lotStatus && p.lot ? (
        <LotStatusDialog
          lot={{ id: p.lot.id, version: p.lot.version, reference: p.reference, status: p.lot.status as 'AVAILABLE', referencePending: false, dossiers: { considering: p.archiveImpact.considering, targeting: 0 } }}
          onClose={() => setLotStatus(false)}
          onDone={() => (setLotStatus(false), onChanged())}
        />
      ) : null}
      {pin ? <PinDialog property={p} onClose={() => setPin(false)} onDone={() => (setPin(false), onChanged())} /> : null}
      {propagate ? <PropagateDeliveryDialog scope={{ propertyId: p.id }} name={p.title} onClose={() => (setPropagate(false), onChanged())} /> : null}
    </div>
  );
}
