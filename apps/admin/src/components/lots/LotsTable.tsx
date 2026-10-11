'use client';
// CTL-060 … CTL-062 — the table of lots, editable line by line: all the lots of a programme (with the typology column
// and its filter, drafts included), or those of one typology. Price in the property's currency with its equivalent in
// the reference currency (CTL-061); a price change is historised (MOD-231, « Historique des prix »). Selection: « Modifier
// le prix » (± x % or a fixed amount, with a summary first; lots with an active reservation included and flagged,
// MOD-313) and « Marquer livrés » (never a future date, Q-014). A lot held by a dossier shows the dossier and its
// deadline: its status is not changed here (CYC-100). Other changes ask for a note, and announce who depends on the
// lot before « vendu » or « retiré » (CYC-073, CYC-102). Columns that are empty for every lot are left out.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ORIENTATIONS, type AdminLot, type LotBulkPriceResult, type LotPriceChange, type LotsResponse } from '@dp/contracts';
import { BulkBar, Button, DataTable, EmptyState, Icon, Menu, Modal, SkeletonRows, StatusTag, type DataTableColumn, type MenuItem, type StatusTone } from '@dp/ui';
import { adminCall, newIdempotencyKey } from '@/lib/admin-client';
import { DASH, money, shortDate, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Surface } from '../shell/Page';
import { isDeliveredPath } from '../shell/menu';
import { useShell } from '../shell/ShellContext';
import { SelectInput, TextArea, TextInput, formStyles as f } from '../shell/forms';
import { catalogueStyles as s, ConfirmDialog, DialogButtons, FailureBanner, LinkButton, tableLabels, useCall } from '../catalogue/parts';

export interface LotsTableProps {
  scope: { programId: string } | { propertyId: string };
  /** `catalogue.write` (CTL-160). */
  canWrite: boolean;
  /** `catalogue.import` — the link to the lot import of the programme (CTL-100). */
  canImport?: boolean;
  /** Called after a change that moves the stock, the price range or the availability of the record. */
  onChanged?: () => void;
}

export const LOT_STATUS_TONE: Record<string, StatusTone> = { AVAILABLE: 'success', OPTIONED: 'pending', RESERVED: 'info', SOLD: 'neutral', WITHDRAWN: 'inactive' };

interface Draft {
  reference: string;
  building: string;
  floor: string;
  door: string;
  orientation: string;
  surfaceM2: string;
  terraceM2: string;
  landM2: string;
  price: string;
  parkingIncluded: string;
  extras: string;
}

const toDraft = (l?: AdminLot): Draft => ({
  reference: l?.reference ?? '',
  building: l?.building ?? '',
  floor: l?.floor === null || l?.floor === undefined ? '' : String(l.floor),
  door: l?.door ?? '',
  orientation: l?.orientation ?? '',
  surfaceM2: l ? String(Number(l.surfaceM2)) : '',
  terraceM2: l?.terraceM2 ? String(Number(l.terraceM2)) : '',
  landM2: l?.landM2 ? String(Number(l.landM2)) : '',
  price: l ? String(Number(l.price)) : '',
  parkingIncluded: l?.parkingIncluded === null || l?.parkingIncluded === undefined ? '' : l.parkingIncluded ? 'yes' : 'no',
  extras: l?.extras ?? '',
});

/** TRV-026 — « 22 350 000 », « 22350000 » and « 22350000,5 » read the same; the API checks the bounds. */
const num = (v: string) => v.replace(/[\s  ]/g, '').replace(',', '.');
const fromDraft = (d: Draft, partial: boolean) => {
  const out: Record<string, unknown> = {
    reference: d.reference.trim(),
    building: d.building.trim() || null,
    floor: d.floor === '' ? null : Number(d.floor),
    door: d.door.trim() || null,
    orientation: d.orientation || null,
    surfaceM2: Number(num(d.surfaceM2)),
    terraceM2: d.terraceM2 === '' ? null : Number(num(d.terraceM2)),
    landM2: d.landM2 === '' ? null : Number(num(d.landM2)),
    price: num(d.price),
    parkingIncluded: d.parkingIncluded === '' ? null : d.parkingIncluded === 'yes',
    extras: d.extras.trim() || null,
  };
  if (partial && !d.reference.trim()) delete out.reference;
  return out;
};

export function LotsTable({ scope, canWrite, canImport, onChanged }: LotsTableProps) {
  const { can, timeZone } = useShell();
  const endpoint = 'programId' in scope ? `/admin/programs/${scope.programId}/lots` : `/admin/properties/${scope.propertyId}/lots`;
  const [data, setData] = useState<LotsResponse | null>(null);
  const [loadFailure, setLoadFailure] = useState<Parameters<typeof FailureBanner>[0]['failure']>(null);
  const [typology, setTypology] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [dialog, setDialog] = useState<{ kind: 'add' | 'status' | 'correct' | 'history' | 'duplicate' | 'delete' | 'bulk' | 'delivered'; lot?: AdminLot } | null>(null);
  const row = useCall();

  const load = useCallback(async () => {
    const r = await adminCall<LotsResponse>(endpoint);
    if (r.ok) {
      setData(r.data);
      setLoadFailure(null);
    } else if (!r.aborted) setLoadFailure(r);
  }, [endpoint]);
  useEffect(() => {
    void load();
  }, [load]);
  const changed = () => {
    void load();
    setSelected(new Set());
    onChanged?.();
  };

  const lots = useMemo(() => (data?.data ?? []).filter((l) => !typology || l.propertyId === typology), [data, typology]);
  const isProgram = 'programId' in scope;
  const any = (pick: (l: AdminLot) => unknown) => (data?.data ?? []).some((l) => pick(l) !== null && pick(l) !== undefined && pick(l) !== '');
  const dossierHref = (ref: string) => `/dossiers/${ref.toLowerCase()}`;

  async function saveRow(lot: AdminLot) {
    const ok = await row.run(() => adminCall(`/admin/lots/${lot.id}`, { method: 'PATCH', body: { ...fromDraft(draft, true), version: lot.version } }), t('ui.admin-programs.lots.toast.saved'));
    if (ok !== null) {
      setEditing(null);
      changed();
    }
  }

  if (loadFailure) return <FailureBanner failure={loadFailure} />;
  if (!data) return <SkeletonRows rows={6} label={t('ui.common.loading')} />;

  const edit = (l: AdminLot) => editing === l.id;
  const input = (l: AdminLot, key: keyof Draft, opts: { width?: string; mode?: 'numeric' | 'decimal' } = {}) =>
    edit(l) ? (
      <input
        className={s.cellInput}
        style={opts.width ? { width: opts.width } : undefined}
        inputMode={opts.mode}
        value={draft[key]}
        aria-label={t(`ui.admin-programs.lots.column.${key === 'surfaceM2' ? 'surface' : key === 'terraceM2' ? 'terrace' : key === 'landM2' ? 'land' : key === 'parkingIncluded' ? 'parking' : (key as 'reference')}` as never)}
        aria-invalid={row.errors[key] ? true : undefined}
        title={row.errors[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void saveRow(l);
          if (e.key === 'Escape') setEditing(null);
        }}
      />
    ) : null;

  const m2 = (v: string | null) => (v ? `${Number(v).toLocaleString('fr-FR')} m²` : DASH);
  const columns: DataTableColumn<AdminLot>[] = [
    {
      key: 'reference',
      header: t('ui.admin-programs.lots.column.reference'),
      width: '9rem',
      cell: (l) =>
        input(l, 'reference', { width: '7rem' }) ?? (
          <span className={s.nameText}>
            <strong>{l.reference}</strong>
            {l.referencePending ? (
              <StatusTag tone="warning" icon="edit">
                {t('ui.admin-programs.lots.referencePending')}
              </StatusTag>
            ) : null}
          </span>
        ),
    },
    ...(isProgram && !typology
      ? [
          {
            key: 'typology',
            header: t('ui.admin-programs.lots.column.typology'),
            width: '10rem',
            // inside a programme its name is implied: the typology part of the title (« Appartement T2 »)
            cell: (l: AdminLot) => (
              <span className={s.nameText} title={l.propertyTitle}>
                <span>{l.propertyTitle.split(' – ')[0]}</span>
                <span className={s.sub}>{l.propertyReference}</span>
              </span>
            ),
            text: (l: AdminLot) => l.propertyTitle,
          },
        ]
      : []),
    { key: 'building', header: t('ui.admin-programs.lots.column.building'), cell: (l) => input(l, 'building', { width: '4rem' }) ?? (l.building ?? DASH) },
    { key: 'floor', header: t('ui.admin-programs.lots.column.floor'), align: 'end', cell: (l) => input(l, 'floor', { width: '3.5rem', mode: 'numeric' }) ?? <span className={s.num}>{l.floor === null ? DASH : l.floor === 0 ? t('ui.admin-programs.lots.groundFloor') : l.floor}</span> },
    ...(any((l) => l.door) || editing ? [{ key: 'door', header: t('ui.admin-programs.lots.column.door'), cell: (l: AdminLot) => input(l, 'door', { width: '4rem' }) ?? (l.door ?? DASH) }] : []),
    ...(any((l) => l.orientation) || editing
      ? [
          {
            key: 'orientation',
            header: t('ui.admin-programs.lots.column.orientation'),
            cell: (l: AdminLot) =>
              edit(l) ? (
                <select className={s.cellInput} value={draft.orientation} onChange={(e) => setDraft((d) => ({ ...d, orientation: e.target.value }))} aria-label={t('ui.admin-programs.lots.column.orientation')}>
                  <option value="">{DASH}</option>
                  {ORIENTATIONS.map((o) => (
                    <option key={o} value={o}>
                      {t(`ui.enum.Orientation.${o}`)}
                    </option>
                  ))}
                </select>
              ) : l.orientation ? (
                t(`ui.enum.Orientation.${l.orientation}`)
              ) : (
                DASH
              ),
          },
        ]
      : []),
    { key: 'surface', header: t('ui.admin-programs.lots.column.surface'), align: 'end', cell: (l) => input(l, 'surfaceM2', { width: '5rem', mode: 'decimal' }) ?? <span className={s.num}>{m2(l.surfaceM2)}</span> },
    ...(any((l) => l.terraceM2) || editing ? [{ key: 'terrace', header: t('ui.admin-programs.lots.column.terrace'), align: 'end' as const, cell: (l: AdminLot) => input(l, 'terraceM2', { width: '4.5rem', mode: 'decimal' }) ?? <span className={s.num}>{m2(l.terraceM2)}</span> }] : []),
    ...(any((l) => l.landM2) || editing ? [{ key: 'land', header: t('ui.admin-programs.lots.column.land'), align: 'end' as const, cell: (l: AdminLot) => input(l, 'landM2', { width: '4.5rem', mode: 'decimal' }) ?? <span className={s.num}>{m2(l.landM2)}</span> }] : []),
    {
      key: 'price',
      header: t('ui.admin-programs.lots.column.price'),
      align: 'end',
      width: '9rem',
      cell: (l) =>
        input(l, 'price', { width: '8rem', mode: 'decimal' }) ?? (
          <span className={s.nameText} style={{ textAlign: 'end' }}>
            <strong className={s.num}>{money(l.price, l.currency)}</strong>
            {l.priceRef ? <span className={s.sub}>{t('ui.admin-programs.common.equivalent', { montant: money(l.priceRef, data.referenceCurrency) })}</span> : null}
          </span>
        ),
    },
    { key: 'pricePerM2', header: t('ui.admin-programs.lots.column.pricePerM2'), align: 'end', cell: (l) => <span className={`${s.num} ${s.muted}`}>{money(l.pricePerM2, l.currency)}</span> },
    {
      key: 'status',
      header: t('ui.admin-programs.lots.column.status'),
      width: '11rem',
      cell: (l) => (
        <span className={s.nameText}>
          <span className={s.tags}>
            <StatusTag tone={LOT_STATUS_TONE[l.status] ?? 'neutral'}>{t(`ui.enum.LotStatus.${l.status}`)}</StatusTag>
            {l.externalSale && (l.status === 'SOLD' || l.status === 'RESERVED') ? <span className={s.sub}>{t('ui.admin-programs.lots.external')}</span> : null}
          </span>
          {l.hold?.dossierReference ? (
            <span className={s.sub}>
              {isDeliveredPath(dossierHref(l.hold.dossierReference)) ? (
                <Link href={dossierHref(l.hold.dossierReference)}>{t('ui.admin-programs.lots.heldBy', { reference: l.hold.dossierReference })}</Link>
              ) : (
                t('ui.admin-programs.lots.heldBy', { reference: l.hold.dossierReference })
              )}
              {l.hold.dueAt ? ` · ${t('ui.admin-programs.lots.until', { date: shortDate(l.hold.dueAt, timeZone) })}` : ''}
            </span>
          ) : null}
        </span>
      ),
    },
    ...(any((l) => l.parkingIncluded) || editing
      ? [
          {
            key: 'parking',
            header: t('ui.admin-programs.lots.column.parking'),
            cell: (l: AdminLot) =>
              edit(l) ? (
                <select className={s.cellInput} value={draft.parkingIncluded} onChange={(e) => setDraft((d) => ({ ...d, parkingIncluded: e.target.value }))} aria-label={t('ui.admin-programs.lots.column.parking')}>
                  <option value="">{DASH}</option>
                  <option value="yes">{t('ui.common.yes')}</option>
                  <option value="no">{t('ui.common.no')}</option>
                </select>
              ) : l.parkingIncluded === null ? (
                DASH
              ) : l.parkingIncluded ? (
                t('ui.common.yes')
              ) : (
                t('ui.common.no')
              ),
          },
        ]
      : []),
    ...(any((l) => l.extras) || editing ? [{ key: 'extras', header: t('ui.admin-programs.lots.column.extras'), cell: (l: AdminLot) => input(l, 'extras', { width: '9rem' }) ?? <span className={s.sub}>{l.extras ?? DASH}</span>, text: (l: AdminLot) => l.extras }] : []),
    ...(any((l) => (l.hasPlan ? true : null)) ? [{ key: 'plan', header: t('ui.admin-programs.lots.column.plan'), cell: (l: AdminLot) => (l.hasPlan ? <Icon name="file" size={16} /> : DASH) }] : []),
    ...(any((l) => l.deliveredAt) ? [{ key: 'deliveredAt', header: t('ui.admin-programs.lots.column.deliveredAt'), cell: (l: AdminLot) => <span className={s.num}>{shortDay(l.deliveredAt)}</span> }] : []),
  ];

  const rowActions = (l: AdminLot) => {
    if (edit(l)) {
      return (
        <span className={s.toolbar}>
          <Button size="S" variant="tool" pending={row.pending} onClick={() => void saveRow(l)}>
            {t('ui.admin-programs.lots.save')}
          </Button>
          <Button size="S" variant="tertiary" onClick={() => setEditing(null)}>
            {t('ui.common.cancel')}
          </Button>
        </span>
      );
    }
    const heldByDossier = Boolean(l.hold) && (l.status === 'OPTIONED' || l.status === 'RESERVED' || (l.status === 'SOLD' && !l.externalSale));
    const items: MenuItem[] = [
      ...(canWrite ? [{ key: 'edit', label: t('ui.admin-programs.lots.edit'), icon: 'edit' as const, onSelect: () => (setDraft(toDraft(l)), row.reset(), setEditing(l.id)) }] : []),
      ...(canWrite && !(l.status === 'SOLD' && l.externalSale)
        ? [
            {
              key: 'status',
              label: t('ui.admin-programs.lots.status'),
              onSelect: () => setDialog({ kind: 'status', lot: l }),
              disabledReason: heldByDossier || l.status === 'OPTIONED' ? (l.status === 'SOLD' ? t('ui.admin-programs.lots.statusLockedSale') : t('ui.admin-programs.lots.statusLocked', { statut: t(`ui.enum.LotStatus.${l.status}`).toLowerCase() })) : null,
            },
          ]
        : []),
      ...(l.status === 'SOLD' && l.externalSale && can('catalogue.publish') ? [{ key: 'correct', label: t('ui.admin-programs.lots.correctSale'), onSelect: () => setDialog({ kind: 'correct', lot: l }) }] : []),
      { key: 'history', label: t('ui.admin-programs.lots.history'), icon: 'clock', onSelect: () => setDialog({ kind: 'history', lot: l }) },
      ...(canWrite && isProgram ? [{ key: 'duplicate', label: t('ui.admin-programs.lots.duplicate'), icon: 'copy' as const, onSelect: () => setDialog({ kind: 'duplicate', lot: l }), separated: true }] : []),
      ...(canWrite && isProgram
        ? [{ key: 'delete', label: t('ui.admin-programs.lots.delete'), icon: 'trash' as const, danger: true, onSelect: () => setDialog({ kind: 'delete', lot: l }), disabledReason: l.status === 'OPTIONED' || l.status === 'RESERVED' || l.status === 'SOLD' ? t('ui.admin-shell.reason.LOT_HELD') : null }]
        : []),
    ];
    return <Menu label={t('ui.admin-programs.lots.rowActions', { reference: l.reference })} items={items} />;
  };

  const counts = {
    a: (data.data ?? []).filter((l) => l.status === 'AVAILABLE').length,
    h: (data.data ?? []).filter((l) => l.status === 'OPTIONED' || l.status === 'RESERVED').length,
    s: (data.data ?? []).filter((l) => l.status === 'SOLD').length,
  };
  const importHref = isProgram ? `/catalogue/import?programme=${(scope as { programId: string }).programId}` : null;
  const toolbar = (
    <span className={s.toolbar}>
      {importHref && canImport && isDeliveredPath(importHref) ? (
        <LinkButton href={importHref} variant="secondary" size="S" icon="upload">
          {t('ui.admin-programs.action.importLots')}
        </LinkButton>
      ) : null}
      {canWrite && (data.typologies.length > 0 || !isProgram) ? (
        <Button variant="tool" size="S" icon="plus" onClick={() => setDialog({ kind: 'add' })}>
          {t('ui.admin-programs.lots.add')}
        </Button>
      ) : null}
    </span>
  );

  return (
    <Surface title={t('ui.admin-programs.lots.title')} actions={toolbar}>
      <div className={s.sectionBody}>
        {data.data.length > 0 ? (
          <div className={s.tableHead}>
            <span className={s.summary}>{t('ui.admin-programs.lots.summary', { n: data.data.length, a: counts.a, h: counts.h, s: counts.s })}</span>
            {isProgram && data.typologies.length > 1 ? (
              <label className={s.toolbar}>
                <span className={s.muted}>{t('ui.admin-programs.lots.filterTypology')}</span>
                <select className={s.cellInput} style={{ width: '18rem' }} value={typology} onChange={(e) => setTypology(e.target.value)}>
                  <option value="">{t('ui.admin-programs.lots.allTypologies')}</option>
                  {data.typologies.map((x) => (
                    <option key={x.id} value={x.id}>
                      {`${x.reference} · ${x.title}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
        {row.failure ? <FailureBanner failure={row.failure} /> : null}
        {data.data.length === 0 ? (
          <EmptyState
            icon="key"
            title={t('ui.admin-programs.lots.empty.title')}
            text={isProgram && data.typologies.length === 0 ? t('ui.admin-programs.lots.empty.noTypology') : t('ui.admin-programs.lots.empty.text')}
            actions={toolbar}
            compact
          />
        ) : (
          <>
            {selected.size > 0 && canWrite ? (
              <BulkBar
                count={selected.size}
                countLabel={t('ui.admin-programs.lots.selected', { n: selected.size })}
                clearLabel={t('ui.common.list.unselectAll')}
                onClear={() => setSelected(new Set())}
              >
                <Button size="S" variant="secondary" icon="coins" onClick={() => setDialog({ kind: 'bulk' })}>
                  {t('ui.admin-programs.lots.bulkPrice')}
                </Button>
                <Button size="S" variant="secondary" icon="check" onClick={() => setDialog({ kind: 'delivered' })}>
                  {t('ui.admin-programs.lots.markDelivered')}
                </Button>
              </BulkBar>
            ) : null}
            <DataTable<AdminLot>
              rows={lots}
              rowId={(l) => l.id}
              rowLabel={(l) => l.reference}
              labels={tableLabels(t('ui.admin-programs.lots.title'))}
              columns={columns}
              selection={canWrite ? { selected, onChange: setSelected } : undefined}
              rowActions={rowActions}
            />
          </>
        )}
      </div>

      <AddLotDialog open={dialog?.kind === 'add'} scope={scope} typologies={data.typologies} onClose={() => setDialog(null)} onDone={() => (setDialog(null), changed())} />
      {dialog?.kind === 'status' && dialog.lot ? <LotStatusDialog lot={dialog.lot} onClose={() => setDialog(null)} onDone={() => (setDialog(null), changed())} /> : null}
      {dialog?.kind === 'correct' && dialog.lot ? <CorrectSaleDialog lot={dialog.lot} onClose={() => setDialog(null)} onDone={() => (setDialog(null), changed())} /> : null}
      {dialog?.kind === 'history' && dialog.lot ? <HistoryDialog lot={dialog.lot} onClose={() => setDialog(null)} /> : null}
      <ConfirmDialog
        open={dialog?.kind === 'duplicate'}
        title={t('ui.admin-programs.lots.dialog.duplicate.title', { reference: dialog?.lot?.reference ?? '' })}
        text={t('ui.admin-programs.lots.dialog.duplicate.text')}
        submit={t('ui.admin-programs.lots.duplicate')}
        call={() => adminCall(`/admin/lots/${dialog!.lot!.id}/duplicate`, { method: 'POST' })}
        success={t('ui.admin-programs.lots.toast.duplicated')}
        onClose={() => setDialog(null)}
        onDone={() => (setDialog(null), changed())}
      />
      <ConfirmDialog<{ outcome: 'DELETED' | 'WITHDRAWN' }>
        open={dialog?.kind === 'delete'}
        title={t('ui.admin-programs.lots.dialog.delete.title', { reference: dialog?.lot?.reference ?? '' })}
        text={t('ui.admin-programs.lots.dialog.delete.text')}
        submit={t('ui.admin-programs.lots.delete')}
        danger
        call={() => adminCall<{ outcome: 'DELETED' | 'WITHDRAWN' }>(`/admin/lots/${dialog!.lot!.id}`, { method: 'DELETE' })}
        onClose={() => setDialog(null)}
        onDone={(r) => {
          setDialog(null);
          changed();
          toastOutcome(r.outcome);
        }}
      />
      {dialog?.kind === 'bulk' ? <BulkPriceDialog lotIds={[...selected]} onClose={() => setDialog(null)} onDone={() => (setDialog(null), changed())} /> : null}
      {dialog?.kind === 'delivered' ? <DeliveredDialog lotIds={[...selected]} onClose={() => setDialog(null)} onDone={() => (setDialog(null), changed())} /> : null}
    </Surface>
  );

  function toastOutcome(outcome: 'DELETED' | 'WITHDRAWN') {
    row.notify(outcome === 'DELETED' ? t('ui.admin-programs.lots.toast.deleted') : t('ui.admin-programs.lots.toast.withdrawn'));
  }
}

// ─── Windows ────────────────────────────────────────────────────────────────

function AddLotDialog({ open, scope, typologies, onClose, onDone }: { open: boolean; scope: LotsTableProps['scope']; typologies: LotsResponse['typologies']; onClose: () => void; onDone: () => void }) {
  const [propertyId, setPropertyId] = useState('');
  const [d, setD] = useState<Draft>(toDraft());
  const [key, setKey] = useState(newIdempotencyKey);
  const { pending, failure, errors, run, reset } = useCall();
  const target = 'propertyId' in scope ? scope.propertyId : propertyId || typologies[0]?.id || '';
  const close = () => {
    reset();
    setD(toDraft());
    setKey(newIdempotencyKey());
    onClose();
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => adminCall(`/admin/properties/${target}/lots`, { body: fromDraft(d, false), idempotencyKey: key }), t('ui.admin-programs.lots.toast.created'));
    if (ok !== null) {
      setD(toDraft());
      setKey(newIdempotencyKey());
      onDone();
    }
  }
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((v) => ({ ...v, [k]: e.target.value }));
  return (
    <Modal open={open} onClose={close} title={t('ui.admin-programs.lots.dialog.add.title')} closeLabel={t('ui.common.close')} width={720}>
      <form className={f.form} onSubmit={submit} noValidate>
        <FailureBanner failure={failure} />
        {'programId' in scope ? (
          <SelectInput label={t('ui.admin-programs.lots.dialog.add.typology')} value={target} onChange={(e) => setPropertyId(e.target.value)}>
            {typologies.map((x) => (
              <option key={x.id} value={x.id}>
                {`${x.reference} · ${x.title}`}
              </option>
            ))}
          </SelectInput>
        ) : null}
        <div className={f.row}>
          <TextInput label={t('ui.admin-programs.lots.column.reference')} value={d.reference} onChange={set('reference')} maxLength={40} error={errors.reference} autoFocus />
          <TextInput label={t('ui.admin-programs.lots.column.price')} inputMode="decimal" value={d.price} onChange={set('price')} error={errors.price} />
          <TextInput label={t('ui.admin-programs.lots.column.surface')} inputMode="decimal" value={d.surfaceM2} onChange={set('surfaceM2')} error={errors.surfaceM2} />
        </div>
        <div className={f.row}>
          <TextInput label={t('ui.admin-programs.lots.column.building')} optional value={d.building} onChange={set('building')} maxLength={40} error={errors.building} />
          <TextInput label={t('ui.admin-programs.lots.column.floor')} optional inputMode="numeric" value={d.floor} onChange={set('floor')} error={errors.floor} />
          <TextInput label={t('ui.admin-programs.lots.column.door')} optional value={d.door} onChange={set('door')} maxLength={20} error={errors.door} />
        </div>
        <div className={f.row}>
          <SelectInput label={t('ui.admin-programs.lots.column.orientation')} optional value={d.orientation} onChange={set('orientation')}>
            <option value="">{DASH}</option>
            {ORIENTATIONS.map((o) => (
              <option key={o} value={o}>
                {t(`ui.enum.Orientation.${o}`)}
              </option>
            ))}
          </SelectInput>
          <TextInput label={t('ui.admin-programs.lots.column.terrace')} optional inputMode="decimal" value={d.terraceM2} onChange={set('terraceM2')} error={errors.terraceM2} />
          <TextInput label={t('ui.admin-programs.lots.column.land')} optional inputMode="decimal" value={d.landM2} onChange={set('landM2')} error={errors.landM2} />
        </div>
        <div className={f.row}>
          <SelectInput label={t('ui.admin-programs.lots.column.parking')} optional value={d.parkingIncluded} onChange={set('parkingIncluded')}>
            <option value="">{DASH}</option>
            <option value="yes">{t('ui.common.yes')}</option>
            <option value="no">{t('ui.common.no')}</option>
          </SelectInput>
          <TextInput label={t('ui.admin-programs.lots.column.extras')} optional value={d.extras} onChange={set('extras')} maxLength={300} error={errors.extras} />
        </div>
        <DialogButtons close={close} pending={pending} label={t('ui.admin-programs.lots.dialog.add.submit')} disabled={!target} />
      </form>
    </Modal>
  );
}

const MANUAL_TARGETS: Record<string, string[]> = { AVAILABLE: ['RESERVED', 'SOLD', 'WITHDRAWN'], WITHDRAWN: ['AVAILABLE'], RESERVED: ['AVAILABLE', 'SOLD'], SOLD: ['AVAILABLE'] };

export type StatusLot = Pick<AdminLot, 'id' | 'version' | 'reference' | 'status' | 'referencePending' | 'dossiers'>;

/** CYC-100, CTL-062 — a status changed by hand (also the single lot of a standalone property, CTL-063). */
export function LotStatusDialog({ lot, onClose, onDone }: { lot: StatusLot; onClose: () => void; onDone: () => void }) {
  const targets = MANUAL_TARGETS[lot.status] ?? [];
  const [to, setTo] = useState(targets[0] ?? '');
  const [note, setNote] = useState('');
  const { pending, failure, errors, run } = useCall();
  const announce = (to === 'SOLD' || to === 'WITHDRAWN') && (lot.dossiers.considering > 0 || lot.dossiers.targeting > 0);
  const blocked = to === 'AVAILABLE' && lot.referencePending;
  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => adminCall(`/admin/lots/${lot.id}/change-status`, { body: { status: to, note, version: lot.version } }), t('ui.admin-programs.lots.toast.status'));
    if (ok !== null) onDone();
  }
  return (
    <Modal open onClose={onClose} title={t('ui.admin-programs.lots.dialog.status.title', { reference: lot.reference })} closeLabel={t('ui.common.close')} width={560}>
      <form className={f.form} onSubmit={submit} noValidate>
        <FailureBanner failure={failure} />
        <fieldset className={s.radioGroup}>
          <legend className={s.muted}>{t('ui.admin-programs.lots.dialog.status.to')}</legend>
          {targets.map((x) => (
            <label key={x} className={s.radio}>
              <input type="radio" name="to" value={x} checked={to === x} onChange={() => setTo(x)} />
              {t(`ui.admin-programs.lots.dialog.status.${x as 'AVAILABLE'}`)}
            </label>
          ))}
        </fieldset>
        {blocked ? <p className={`${s.notice} ${s.noticeWarn}`}>{t('ui.admin-programs.lots.dialog.status.pendingReference')}</p> : null}
        <TextArea label={t('ui.admin-programs.lots.dialog.status.note')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} error={errors.note} hint={t('ui.admin-programs.lots.dialog.status.noteHint')} />
        {announce ? (
          <p className={`${s.notice} ${s.noticeWarn}`}>
            <Icon name="status-warning" size={16} />
            {t('ui.admin-programs.lots.dialog.status.impact', { c: lot.dossiers.considering, t: lot.dossiers.targeting })}
          </p>
        ) : null}
        <DialogButtons close={onClose} pending={pending} label={t('ui.admin-programs.lots.dialog.status.submit')} disabled={!to || blocked || !note.trim()} danger={to === 'SOLD' || to === 'WITHDRAWN'} />
      </form>
    </Modal>
  );
}

function CorrectSaleDialog({ lot, onClose, onDone }: { lot: AdminLot; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const { pending, failure, errors, run } = useCall();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => adminCall(`/admin/lots/${lot.id}/correct-sale`, { body: { note, version: lot.version } }), t('ui.admin-programs.lots.toast.status'));
    if (ok !== null) onDone();
  }
  return (
    <Modal open onClose={onClose} title={t('ui.admin-programs.lots.dialog.correct.title', { reference: lot.reference })} closeLabel={t('ui.common.close')}>
      <form className={f.form} onSubmit={submit} noValidate>
        <p>{t('ui.admin-programs.lots.dialog.correct.text')}</p>
        <FailureBanner failure={failure} />
        <TextArea label={t('ui.admin-programs.lots.dialog.correct.reason')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} error={errors.note} />
        <DialogButtons close={onClose} pending={pending} label={t('ui.admin-programs.lots.dialog.correct.submit')} disabled={!note.trim()} />
      </form>
    </Modal>
  );
}

function HistoryDialog({ lot, onClose }: { lot: AdminLot; onClose: () => void }) {
  const { timeZone } = useShell();
  const [rows, setRows] = useState<LotPriceChange[] | null>(null);
  useEffect(() => {
    void adminCall<LotPriceChange[]>(`/admin/lots/${lot.id}/price-history`).then((r) => r.ok && setRows(r.data));
  }, [lot.id]);
  return (
    <Modal open onClose={onClose} title={t('ui.admin-programs.lots.dialog.history.title', { reference: lot.reference })} closeLabel={t('ui.common.close')} width={560}>
      {!rows ? (
        <SkeletonRows rows={3} label={t('ui.common.loading')} />
      ) : rows.length === 0 ? (
        <p className={s.muted}>{t('ui.admin-programs.lots.dialog.history.empty')}</p>
      ) : (
        <ol className={s.history}>
          {rows.map((r, i) => (
            <li key={`${r.at}-${i}`}>
              <span className={s.num}>{shortDate(r.at, timeZone)}</span>
              <span>
                {r.before ? (
                  <>
                    <span className={s.strike}>{money(r.before, lot.currency)}</span> → <strong>{money(r.after, lot.currency)}</strong>
                  </>
                ) : (
                  <>
                    {t('ui.admin-programs.lots.dialog.history.created')} : <strong>{money(r.after, lot.currency)}</strong>
                  </>
                )}
              </span>
              <span className={s.sub}>{r.author ?? t('ui.admin-programs.lots.dialog.history.system')}</span>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

function BulkPriceDialog({ lotIds, onClose, onDone }: { lotIds: string[]; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'PERCENT' | 'SET'>('PERCENT');
  const [value, setValue] = useState('');
  const [preview, setPreview] = useState<LotBulkPriceResult | null>(null);
  const { pending, failure, errors, run } = useCall();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { lotIds, mode, value: value.replace(/[\s  ]/g, '').replace(',', '.'), preview: !preview };
    const r = await run(() => adminCall<LotBulkPriceResult>('/admin/lots/bulk-price', { body }), preview ? t('ui.admin-programs.lots.toast.prices', { n: lotIds.length }) : undefined);
    if (!r) return;
    if (r.applied) onDone();
    else setPreview(r);
  }
  return (
    <Modal open onClose={onClose} title={t('ui.admin-programs.lots.dialog.bulk.title', { n: lotIds.length })} closeLabel={t('ui.common.close')} width={720}>
      <form className={f.form} onSubmit={submit} noValidate>
        <FailureBanner failure={failure} />
        {!preview ? (
          <>
            <fieldset className={s.radioGroup}>
              <label className={s.radio}>
                <input type="radio" name="mode" checked={mode === 'PERCENT'} onChange={() => setMode('PERCENT')} />
                {t('ui.admin-programs.lots.dialog.bulk.percent')}
              </label>
              <label className={s.radio}>
                <input type="radio" name="mode" checked={mode === 'SET'} onChange={() => setMode('SET')} />
                {t('ui.admin-programs.lots.dialog.bulk.set')}
              </label>
            </fieldset>
            <TextInput
              label={mode === 'PERCENT' ? `${t('ui.admin-programs.lots.dialog.bulk.percent')} (%)` : t('ui.admin-programs.lots.dialog.bulk.set')}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              error={errors.value}
              hint={mode === 'PERCENT' ? t('ui.admin-programs.lots.dialog.bulk.percentHint') : undefined}
              autoFocus
            />
            <DialogButtons close={onClose} pending={pending} label={t('ui.admin-programs.lots.dialog.bulk.preview')} disabled={!value.trim()} />
          </>
        ) : (
          <>
            <h3 className={s.subTitle}>{t('ui.admin-programs.lots.dialog.bulk.summary')}</h3>
            <table className={s.miniTable}>
              <thead>
                <tr>
                  <th>{t('ui.admin-programs.lots.column.reference')}</th>
                  <th className={s.end}>{t('ui.admin-programs.lots.dialog.bulk.before')}</th>
                  <th className={s.end}>{t('ui.admin-programs.lots.dialog.bulk.after')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((l) => (
                  <tr key={l.lotId}>
                    <td>
                      {l.reference}
                      {l.reserved ? <span className={s.sub}> · {t('ui.admin-programs.lots.dialog.bulk.reserved')}</span> : null}
                    </td>
                    <td className={`${s.end} ${s.num}`}>{money(l.before, l.currency)}</td>
                    <td className={`${s.end} ${s.num}`}>
                      <strong>{money(l.after, l.currency)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={`${f.actions} ${f.actionsEnd}`}>
              <Button variant="secondary" size="M" type="button" onClick={() => setPreview(null)}>
                {t('ui.admin-programs.lots.dialog.bulk.back')}
              </Button>
              <Button variant="tool" size="M" type="submit" pending={pending}>
                {t('ui.admin-programs.lots.dialog.bulk.submit')}
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

function DeliveredDialog({ lotIds, onClose, onDone }: { lotIds: string[]; onClose: () => void; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const { pending, failure, errors, run } = useCall();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => adminCall('/admin/lots/mark-delivered', { body: { lotIds, date } }), t('ui.admin-programs.lots.toast.delivered', { n: lotIds.length }));
    if (ok !== null) onDone();
  }
  return (
    <Modal open onClose={onClose} title={t('ui.admin-programs.lots.dialog.delivered.title', { n: lotIds.length })} closeLabel={t('ui.common.close')}>
      <form className={f.form} onSubmit={submit} noValidate>
        <FailureBanner failure={failure} />
        <TextInput label={t('ui.admin-programs.lots.dialog.delivered.date')} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} hint={t('ui.admin-programs.lots.dialog.delivered.hint')} />
        <DialogButtons close={onClose} pending={pending} label={t('ui.admin-programs.lots.dialog.delivered.submit')} disabled={!date} />
      </form>
    </Modal>
  );
}

