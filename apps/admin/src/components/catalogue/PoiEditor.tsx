'use client';
// CTL-140 — « À proximité »: up to eight points of interest of a programme or of a standalone property (label,
// category, minutes, mode), ordered by hand; the site shows the first five (FIC-062). The list is edited as a whole
// and saved in one call (`PUT …/pois`). Hidden when `features.poi` is off.
import { useEffect, useState } from 'react';
import { POI_CATEGORIES, TRAVEL_MODES, type AdminPoi } from '@dp/contracts';
import { Button, EmptyState, Icon, SkeletonRows } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { t } from '@/lib/i18n';
import { useUnsavedGuard } from '../shell/forms';
import { Surface } from '../shell/Page';
import { useCatalogueReference } from './reference';
import { catalogueStyles as s, FailureBanner, useCall } from './parts';

export interface PoiEditorProps {
  scope: { programId: string } | { propertyId: string };
  canWrite: boolean;
}

type Row = { id?: string; label: string; category: string; minutes: string; mode: string };
const toRows = (items: AdminPoi[]): Row[] => items.map((p) => ({ id: p.id, label: p.label, category: p.category, minutes: String(p.minutes), mode: p.mode }));

export function PoiEditor({ scope, canWrite }: PoiEditorProps) {
  const ref = useCatalogueReference();
  const path = 'programId' in scope ? `/admin/programs/${scope.programId}/pois` : `/admin/properties/${scope.propertyId}/pois`;
  const [saved, setSaved] = useState<Row[] | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const { pending, failure, errors, run } = useCall();
  useEffect(() => {
    void adminCall<AdminPoi[]>(path).then((r) => {
      if (r.ok) {
        setSaved(toRows(r.data));
        setRows(toRows(r.data));
      }
    });
  }, [path]);
  const dirty = saved !== null && JSON.stringify(rows) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);
  if (ref && !ref.settings.poi) return <p className={s.notice}>{t('ui.admin-programs.nearby.disabled')}</p>;
  if (!saved) return <SkeletonRows rows={4} label={t('ui.common.loading')} />;

  const set = (i: number, patch: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((list) => {
      const next = [...list];
      const [x] = next.splice(i, 1);
      next.splice(i + d, 0, x!);
      return next;
    });
  const add = () => setRows((list) => [...list, { label: '', category: 'TRANSPORT', minutes: '5', mode: 'WALK' }]);
  async function save() {
    const items = rows.map((r) => ({ ...(r.id ? { id: r.id } : {}), label: r.label.trim(), category: r.category, minutes: Number(r.minutes), mode: r.mode }));
    const out = await run(() => adminCall<AdminPoi[]>(path, { method: 'PUT', body: { items } }), t('ui.admin-programs.nearby.toast'));
    if (out) {
      setSaved(toRows(out));
      setRows(toRows(out));
    }
  }

  const actions = canWrite ? (
    <span className={s.toolbar}>
      <Button variant="secondary" size="S" icon="plus" onClick={add} disabled={rows.length >= 8} title={rows.length >= 8 ? t('ui.admin-programs.nearby.max') : undefined}>
        {t('ui.admin-programs.nearby.add')}
      </Button>
      {dirty ? (
        <>
          <Button variant="tertiary" size="S" onClick={() => setRows(saved)}>
            {t('ui.common.cancel')}
          </Button>
          <Button variant="tool" size="S" pending={pending} onClick={() => void save()}>
            {t('ui.common.save')}
          </Button>
        </>
      ) : null}
    </span>
  ) : null;

  return (
    <Surface title={t('ui.admin-programs.nearby.title')} actions={actions}>
      <div className={s.sectionBody}>
        <p className={s.muted}>{t('ui.admin-programs.nearby.intro')}</p>
        <FailureBanner failure={failure} />
        {rows.length === 0 ? (
          <EmptyState icon="map-pin" title={t('ui.admin-programs.nearby.empty.title')} text={t('ui.admin-programs.nearby.empty.text')} compact />
        ) : (
          <ol className={s.poiList}>
            {rows.map((r, i) => (
              <li key={r.id ?? `new-${i}`} className={s.poiRow} data-hidden-on-site={i >= 5 ? '1' : undefined}>
                <span className={s.poiRank}>{i + 1}</span>
                {canWrite ? (
                  <>
                    <input className={s.cellInput} value={r.label} maxLength={80} placeholder={t('ui.admin-programs.nearby.label')} aria-label={t('ui.admin-programs.nearby.label')} aria-invalid={errors[`items.${i}.label`] ? true : undefined} onChange={(e) => set(i, { label: e.target.value })} />
                    <select className={s.cellInput} value={r.category} aria-label={t('ui.admin-programs.nearby.category')} onChange={(e) => set(i, { category: e.target.value })}>
                      {POI_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {t(`ui.enum.PoiCategory.${c}`)}
                        </option>
                      ))}
                    </select>
                    <input className={s.cellInput} inputMode="numeric" value={r.minutes} aria-label={t('ui.admin-programs.nearby.minutes')} aria-invalid={errors[`items.${i}.minutes`] ? true : undefined} onChange={(e) => set(i, { minutes: e.target.value.replace(/\D/g, '') })} />
                    <select className={s.cellInput} value={r.mode} aria-label={t('ui.admin-programs.nearby.mode')} onChange={(e) => set(i, { mode: e.target.value })}>
                      {TRAVEL_MODES.map((m) => (
                        <option key={m} value={m}>
                          {t(`ui.enum.TravelMode.${m}`)}
                        </option>
                      ))}
                    </select>
                    <span className={s.toolbar}>
                      <Button variant="tertiary" size="S" aria-label={t('ui.admin-programs.nearby.moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
                        <Icon name="chevron-up" size={16} />
                      </Button>
                      <Button variant="tertiary" size="S" aria-label={t('ui.admin-programs.nearby.moveDown')} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                        <Icon name="chevron-down" size={16} />
                      </Button>
                      <Button variant="tertiary" size="S" aria-label={t('ui.admin-programs.nearby.remove')} onClick={() => setRows((list) => list.filter((_, j) => j !== i))}>
                        <Icon name="trash" size={16} />
                      </Button>
                    </span>
                  </>
                ) : (
                  <span className={s.poiRead}>
                    <strong>{r.label}</strong>
                    <span className={s.sub}>
                      {t(`ui.enum.PoiCategory.${r.category as 'OTHER'}`)} · {t('ui.admin-programs.nearby.minutesLabel', { n: r.minutes, mode: t(`ui.enum.TravelMode.${r.mode as 'WALK'}`) })}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Surface>
  );
}
