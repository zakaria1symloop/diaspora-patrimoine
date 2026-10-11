'use client';
// CTL-003 — the tabs of a promoter's record: Identité · Contacts · Sélection (Q-003) · Convention (only with
// `partner.convention.manage`) · Documents (PartnerDocument: upload API-080, opening through a signed address MED-030,
// expiry 30 days before, AUT-073) · Page publique (« Visible sur le site » only for a selected promoter, presentation,
// references, logo and cover) · Programmes (its programmes and their properties, with their publication).
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PARTNER_DOCUMENT_CATEGORIES, type AdminPartnerDocument, type AdminPromoterContact, type AdminPromoterDetail, type VettingLine } from '@dp/contracts';
import { Banner, Button, DataTable, EmptyState, Icon, Menu, Modal, StatusTag } from '@dp/ui';
import { sha256Hex } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { DASH, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { AVAILABILITY_TONE, PUBLICATION_TONE } from '@/lib/tones';
import { Surface } from '../shell/Page';
import { Checkbox, SelectInput, TextArea, TextInput, formStyles as f, useUnsavedGuard } from '../shell/forms';
import { useCatalogueReference } from '../catalogue/reference';
import { catalogueStyles as s, ConfirmDialog, DialogButtons, EditableSection, FailureBanner, LinkButton, ReadGrid, StockMeter, tableLabels, useCall } from '../catalogue/parts';
import { ImageSlot } from '../media/ImageSlot';
import st from './promoters.module.css';

const nullable = (v: string) => (v.trim() === '' ? null : v.trim());

// ─── Identité ───────────────────────────────────────────────────────────────

export function PromoterIdentity({ p }: { p: AdminPromoterDetail }) {
  const ref = useCatalogueReference();
  const patch = (body: Record<string, unknown>) => adminCall(`/admin/promoters/${p.id}`, { method: 'PATCH', body: { ...body, version: p.version } });
  return (
    <div className={s.sectionBody}>
      <EditableSection
        title={t('ui.admin-promoters.section.company')}
        canEdit={p.can.write}
        initial={{ legalName: p.legalName, brandName: p.brandName ?? '', registrationNumber: p.registrationNumber ?? '', taxId: p.taxId ?? '', licenseNumber: p.licenseNumber ?? '' }}
        save={(v) => patch({ legalName: v.legalName.trim(), brandName: nullable(v.brandName), registrationNumber: nullable(v.registrationNumber), taxId: nullable(v.taxId), licenseNumber: nullable(v.licenseNumber) })}
        view={
          <ReadGrid
            columns={3}
            items={[
              { label: t('ui.admin-promoters.field.legalName'), value: p.legalName },
              { label: t('ui.admin-promoters.field.brandName'), value: p.brandName },
              { label: t('ui.admin-promoters.field.registrationNumber'), value: p.registrationNumber },
              { label: t('ui.admin-promoters.field.taxId'), value: p.taxId },
              { label: t('ui.admin-promoters.field.licenseNumber'), value: p.licenseNumber },
            ]}
          />
        }
        form={(v, set, e) => (
          <>
            <div className={f.row}>
              <TextInput label={t('ui.admin-promoters.field.legalName')} value={v.legalName} onChange={(x) => set('legalName', x.target.value)} maxLength={160} error={e.legalName} />
              <TextInput label={t('ui.admin-promoters.field.brandName')} optional value={v.brandName} onChange={(x) => set('brandName', x.target.value)} maxLength={160} error={e.brandName} />
            </div>
            <div className={f.row}>
              <TextInput label={t('ui.admin-promoters.field.registrationNumber')} optional value={v.registrationNumber} onChange={(x) => set('registrationNumber', x.target.value)} maxLength={60} error={e.registrationNumber} />
              <TextInput label={t('ui.admin-promoters.field.taxId')} optional value={v.taxId} onChange={(x) => set('taxId', x.target.value)} maxLength={60} error={e.taxId} />
              <TextInput label={t('ui.admin-promoters.field.licenseNumber')} optional value={v.licenseNumber} onChange={(x) => set('licenseNumber', x.target.value)} maxLength={60} error={e.licenseNumber} />
            </div>
          </>
        )}
      />
      <EditableSection
        title={t('ui.admin-promoters.section.address')}
        canEdit={p.can.write}
        initial={{ regionId: p.regionId ?? '', cityId: p.cityId ?? '', addressLine: p.addressLine ?? '', website: p.website ?? '', email: p.email ?? '', phone: p.phone ?? '' }}
        save={(v) => patch({ regionId: v.regionId || null, cityId: v.cityId || null, addressLine: nullable(v.addressLine), website: nullable(v.website), email: nullable(v.email), phone: nullable(v.phone) })}
        view={
          <ReadGrid
            columns={3}
            items={[
              { label: t('ui.admin-promoters.field.country'), value: p.country },
              { label: t('ui.admin-promoters.field.region'), value: p.region },
              { label: t('ui.admin-promoters.field.city'), value: p.city },
              { label: t('ui.admin-promoters.field.addressLine'), value: p.addressLine },
              {
                label: t('ui.admin-promoters.field.website'),
                value: p.website ? (
                  <a href={p.website} target="_blank" rel="noreferrer" className={f.link}>
                    {p.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : null,
              },
              { label: t('ui.admin-promoters.field.email'), value: p.email },
              { label: t('ui.admin-promoters.field.phone'), value: p.phone },
            ]}
          />
        }
        form={(v, set, e) => (
          <>
            <div className={f.row}>
              <SelectInput label={t('ui.admin-promoters.field.region')} optional value={v.regionId} onChange={(x) => (set('regionId', x.target.value), set('cityId', ''))} error={e.regionId}>
                <option value="">{t('ui.admin-promoters.field.none')}</option>
                {(ref?.regions ?? []).filter((r) => r.countryCode === p.countryCode).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectInput>
              <SelectInput label={t('ui.admin-promoters.field.city')} optional value={v.cityId} onChange={(x) => set('cityId', x.target.value)} error={e.cityId}>
                <option value="">{t('ui.admin-promoters.field.none')}</option>
                {(ref?.cities ?? []).filter((c) => c.regionId === v.regionId).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectInput>
              <TextInput label={t('ui.admin-promoters.field.addressLine')} optional value={v.addressLine} onChange={(x) => set('addressLine', x.target.value)} maxLength={200} error={e.addressLine} />
            </div>
            <div className={f.row}>
              <TextInput label={t('ui.admin-promoters.field.website')} optional inputMode="url" value={v.website} onChange={(x) => set('website', x.target.value)} maxLength={200} error={e.website} />
              <TextInput label={t('ui.admin-promoters.field.email')} optional type="email" value={v.email} onChange={(x) => set('email', x.target.value)} error={e.email} />
              <TextInput label={t('ui.admin-promoters.field.phone')} optional type="tel" value={v.phone} onChange={(x) => set('phone', x.target.value)} maxLength={20} error={e.phone} />
            </div>
          </>
        )}
      />
    </div>
  );
}

// ─── Contacts ───────────────────────────────────────────────────────────────

export function PromoterContacts({ p }: { p: AdminPromoterDetail }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminPromoterContact | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminPromoterContact | null>(null);
  const add = p.can.write ? (
    <Button variant="tool" size="S" icon="plus" onClick={() => setEditing('new')}>
      {t('ui.admin-promoters.contacts.add')}
    </Button>
  ) : null;
  return (
    <Surface title={t('ui.admin-promoters.contacts.title')} actions={add}>
      {p.contacts.length === 0 ? (
        <EmptyState icon="user" title={t('ui.admin-promoters.contacts.empty.title')} text={t('ui.admin-promoters.contacts.empty.text')} actions={add} compact />
      ) : (
        <ul className={st.cards}>
          {p.contacts.map((c) => (
            <li key={c.id} className={st.contact} data-primary={c.isPrimary ? '1' : undefined}>
              <span className={st.avatar} aria-hidden="true">
                {c.fullName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((x) => x[0])
                  .join('')
                  .toUpperCase()}
              </span>
              <div className={st.contactText}>
                <strong>{c.fullName}</strong>
                <span className={s.sub}>{c.role ?? DASH}</span>
                <span className={s.tags}>
                  {c.isPrimary ? <StatusTag tone="info">{t('ui.admin-promoters.contacts.primary')}</StatusTag> : null}
                  {c.hasAccount ? <StatusTag tone="success">{t('ui.admin-promoters.contacts.account')}</StatusTag> : null}
                </span>
                {c.email ? (
                  <a href={`mailto:${c.email}`} className={st.line}>
                    <Icon name="mail" size={16} />
                    {c.email}
                  </a>
                ) : null}
                {c.phone ? (
                  <a href={`tel:${c.phone}`} className={st.line}>
                    <Icon name="phone" size={16} />
                    {c.phone}
                  </a>
                ) : null}
                {c.notes ? <p className={s.sub}>{c.notes}</p> : null}
              </div>
              {p.can.write ? (
                <Menu
                  label={t('ui.admin-programs.common.moreActions')}
                  items={[
                    { key: 'edit', label: t('ui.admin-promoters.contacts.edit'), icon: 'edit', onSelect: () => setEditing(c) },
                    { key: 'delete', label: t('ui.admin-promoters.contacts.delete'), icon: 'trash', danger: true, onSelect: () => setDeleting(c) },
                  ]}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editing ? <ContactDialog promoterId={p.id} contact={editing === 'new' ? null : editing} first={p.contacts.length === 0} onClose={() => setEditing(null)} onDone={() => (setEditing(null), router.refresh())} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        title={t('ui.admin-promoters.contacts.deleteTitle', { nom: deleting?.fullName ?? '' })}
        text={t('ui.admin-promoters.contacts.deleteText')}
        submit={t('ui.admin-promoters.contacts.delete')}
        danger
        call={() => adminCall(`/admin/promoters/${p.id}/contacts/${deleting!.id}`, { method: 'DELETE' })}
        success={t('ui.admin-promoters.contacts.toast')}
        onClose={() => setDeleting(null)}
        onDone={() => (setDeleting(null), router.refresh())}
      />
    </Surface>
  );
}

function ContactDialog({ promoterId, contact, first, onClose, onDone }: { promoterId: string; contact: AdminPromoterContact | null; first: boolean; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ fullName: contact?.fullName ?? '', role: contact?.role ?? '', email: contact?.email ?? '', phone: contact?.phone ?? '', notes: contact?.notes ?? '', isPrimary: contact?.isPrimary ?? first });
  const { pending, failure, errors, run } = useCall();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { fullName: v.fullName.trim(), role: v.role || null, email: v.email || null, phone: v.phone || null, notes: v.notes || null, isPrimary: v.isPrimary };
    const ok = await run(() => (contact ? adminCall(`/admin/promoters/${promoterId}/contacts/${contact.id}`, { method: 'PATCH', body }) : adminCall(`/admin/promoters/${promoterId}/contacts`, { body })), t('ui.admin-promoters.contacts.toast'));
    if (ok !== null) onDone();
  }
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title={t('ui.admin-promoters.contacts.dialogTitle')} closeLabel={t('ui.common.close')} width={560}>
      <form className={f.form} onSubmit={submit} noValidate>
        <FailureBanner failure={failure} />
        <div className={f.row}>
          <TextInput label={t('ui.admin-promoters.contacts.fullName')} value={v.fullName} onChange={set('fullName')} maxLength={120} error={errors.fullName} autoFocus />
          <TextInput label={t('ui.admin-promoters.contacts.role')} optional value={v.role} onChange={set('role')} maxLength={80} error={errors.role} />
        </div>
        <div className={f.row}>
          <TextInput label={t('ui.admin-promoters.contacts.email')} optional type="email" value={v.email} onChange={set('email')} error={errors.email} />
          <TextInput label={t('ui.admin-promoters.contacts.phone')} optional type="tel" value={v.phone} onChange={set('phone')} maxLength={20} error={errors.phone} />
        </div>
        <TextArea label={t('ui.admin-promoters.contacts.notes')} optional value={v.notes} onChange={set('notes')} maxLength={1000} rows={3} error={errors.notes} />
        <Checkbox label={t('ui.admin-promoters.contacts.makePrimary')} checked={v.isPrimary} onChange={(isPrimary) => setV((x) => ({ ...x, isPrimary }))} />
        <DialogButtons close={onClose} pending={pending} label={t('ui.common.save')} disabled={!v.fullName.trim()} />
      </form>
    </Modal>
  );
}

// ─── Sélection (Q-003) ──────────────────────────────────────────────────────

export function PromoterVetting({ p }: { p: AdminPromoterDetail }) {
  const router = useRouter();
  const [lines, setLines] = useState<VettingLine[]>(p.vettingChecklist);
  const [date, setDate] = useState(p.vettedAt ?? '');
  const { pending, failure, run } = useCall();
  const dirty = JSON.stringify(lines) !== JSON.stringify(p.vettingChecklist) || date !== (p.vettedAt ?? '');
  useUnsavedGuard(dirty);
  const set = (i: number, patch: Partial<VettingLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  async function save() {
    const ok = await run(() => adminCall(`/admin/promoters/${p.id}/vetting`, { method: 'PUT', body: { version: p.version, lines: lines.filter((l) => l.label.trim()), vettedAt: date || null } }), t('ui.admin-promoters.toast.saved'));
    if (ok !== null) router.refresh();
  }
  const doneCount = lines.filter((l) => l.done).length;
  return (
    <Surface
      title={t('ui.admin-promoters.vetting.title')}
      actions={
        p.can.write && dirty ? (
          <span className={s.toolbar}>
            <Button variant="tertiary" size="S" onClick={() => (setLines(p.vettingChecklist), setDate(p.vettedAt ?? ''))}>
              {t('ui.common.cancel')}
            </Button>
            <Button variant="tool" size="S" pending={pending} onClick={() => void save()}>
              {t('ui.common.save')}
            </Button>
          </span>
        ) : null
      }
    >
      <div className={s.sectionBody}>
        <div className={s.tableHead}>
          <span className={s.muted}>{t('ui.admin-promoters.vetting.intro')}</span>
          <span className={st.progressLabel}>
            <StockMeter available={doneCount} total={lines.length || 1} compact />
            {t('ui.admin-promoters.vetting.done', { n: doneCount, t: lines.length })}
          </span>
        </div>
        <FailureBanner failure={failure} />
        <ol className={st.checklist}>
          {lines.map((l, i) => (
            <li key={i} data-done={l.done ? '1' : undefined}>
              <input type="checkbox" checked={l.done} disabled={!p.can.write} aria-label={l.label} onChange={(e) => set(i, { done: e.target.checked })} />
              {p.can.write ? (
                <>
                  <input className={s.cellInput} value={l.label} maxLength={120} aria-label={t('ui.admin-promoters.vetting.line')} onChange={(e) => set(i, { label: e.target.value })} />
                  <input className={s.cellInput} value={l.note ?? ''} maxLength={500} placeholder={t('ui.admin-promoters.vetting.note')} aria-label={t('ui.admin-promoters.vetting.note')} onChange={(e) => set(i, { note: e.target.value || null })} />
                  <Button variant="tertiary" size="S" aria-label={t('ui.admin-promoters.vetting.remove')} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                    <Icon name="trash" size={16} />
                  </Button>
                </>
              ) : (
                <span className={s.nameText}>
                  <span>{l.label}</span>
                  {l.note ? <span className={s.sub}>{l.note}</span> : null}
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className={s.toolbar}>
          {p.can.write ? (
            <Button variant="secondary" size="S" icon="plus" onClick={() => setLines((ls) => [...ls, { label: '', done: false, note: null }])}>
              {t('ui.admin-promoters.vetting.addLine')}
            </Button>
          ) : null}
          <span className={st.dateField}>
            <TextInput label={t('ui.admin-promoters.vetting.date')} type="date" value={date} disabled={!p.can.write} onChange={(e) => setDate(e.target.value)} />
          </span>
        </div>
      </div>
    </Surface>
  );
}

// ─── Convention ─────────────────────────────────────────────────────────────

export function PromoterConvention({ p }: { p: AdminPromoterDetail }) {
  return (
    <div className={s.sectionBody}>
      {p.conventionState === 'EXPIRED' ? (
        <Banner tone="warning">
          <p>{t('ui.admin-promoters.conventionTab.expired')}</p>
        </Banner>
      ) : null}
      <EditableSection
        title={t('ui.admin-promoters.conventionTab.title')}
        canEdit={p.can.convention}
        initial={{ conventionSignedAt: p.conventionSignedAt ?? '', conventionExpiresAt: p.conventionExpiresAt ?? '', commissionTerms: p.commissionTerms ?? '' }}
        save={(v) => adminCall(`/admin/promoters/${p.id}`, { method: 'PATCH', body: { version: p.version, conventionSignedAt: v.conventionSignedAt || null, conventionExpiresAt: v.conventionExpiresAt || null, commissionTerms: nullable(v.commissionTerms) } })}
        view={
          <ReadGrid
            items={[
              { label: t('ui.admin-promoters.conventionTab.signedAt'), value: p.conventionSignedAt ? shortDay(p.conventionSignedAt) : null },
              { label: t('ui.admin-promoters.conventionTab.expiresAt'), value: p.conventionExpiresAt ? shortDay(p.conventionExpiresAt) : null },
              { label: t('ui.admin-promoters.conventionTab.terms'), value: p.commissionTerms ? <span className={s.prose}>{p.commissionTerms}</span> : null, wide: true },
            ]}
          />
        }
        form={(v, set, e) => (
          <>
            <div className={f.row}>
              <TextInput label={t('ui.admin-promoters.conventionTab.signedAt')} type="date" optional value={v.conventionSignedAt} onChange={(x) => set('conventionSignedAt', x.target.value)} error={e.conventionSignedAt} />
              <TextInput label={t('ui.admin-promoters.conventionTab.expiresAt')} type="date" optional value={v.conventionExpiresAt} onChange={(x) => set('conventionExpiresAt', x.target.value)} error={e.conventionExpiresAt} />
            </div>
            <TextArea label={t('ui.admin-promoters.conventionTab.terms')} optional value={v.commissionTerms} onChange={(x) => set('commissionTerms', x.target.value)} maxLength={2000} rows={5} hint={t('ui.admin-promoters.conventionTab.termsHint')} error={e.commissionTerms} />
          </>
        )}
      />
    </div>
  );
}

// ─── Documents ──────────────────────────────────────────────────────────────

const EXPIRY_TONE = { EXPIRED: 'error', EXPIRING: 'warning', OK: 'success', NONE: 'neutral' } as const;

export function PromoterDocuments({ p }: { p: AdminPromoterDetail }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ kind: 'add' | 'edit' | 'delete'; doc?: AdminPartnerDocument } | null>(null);
  const call = useCall();
  async function open(d: AdminPartnerDocument) {
    const r = await call.run(() => adminCall<{ url: string }>(`/admin/promoters/${p.id}/documents/${d.id}/file`));
    if (r) window.open(r.url, '_blank', 'noopener');
  }
  const add = p.can.write ? (
    <Button variant="tool" size="S" icon="plus" onClick={() => setDialog({ kind: 'add' })}>
      {t('ui.admin-promoters.documents.add')}
    </Button>
  ) : null;
  return (
    <Surface title={t('ui.admin-promoters.documents.title')} actions={add}>
      <div className={s.sectionBody}>
        <FailureBanner failure={call.failure} />
        {p.documents.length === 0 ? (
          <EmptyState icon="file" title={t('ui.admin-promoters.documents.empty.title')} text={t('ui.admin-promoters.documents.empty.text')} actions={add} compact />
        ) : (
          <DataTable<AdminPartnerDocument>
            rows={p.documents}
            rowId={(d) => d.id}
            rowLabel={(d) => d.label}
            labels={tableLabels(t('ui.admin-promoters.documents.title'))}
            columns={[
              {
                key: 'label',
                header: t('ui.admin-promoters.documents.label'),
                cell: (d) => (
                  <span className={s.nameCell}>
                    <span className={`${s.thumb} ${s.thumbS}`} aria-hidden="true">
                      <Icon name="file" size={16} />
                    </span>
                    <span className={s.nameText}>
                      <button type="button" className={st.linkish} onClick={() => void open(d)} disabled={d.scanStatus !== 'CLEAN'}>
                        {d.label}
                      </button>
                      <span className={s.sub}>{d.fileName}</span>
                    </span>
                  </span>
                ),
                text: (d) => d.label,
              },
              { key: 'category', header: t('ui.admin-promoters.documents.category'), cell: (d) => d.category },
              { key: 'issuedAt', header: t('ui.admin-promoters.documents.issuedAt'), cell: (d) => <span className={s.num}>{shortDay(d.issuedAt)}</span> },
              {
                key: 'expiresAt',
                header: t('ui.admin-promoters.documents.expiresAt'),
                cell: (d) => (
                  <span className={s.tags}>
                    <span className={s.num}>{shortDay(d.expiresAt)}</span>
                    {d.expiry !== 'NONE' ? <StatusTag tone={EXPIRY_TONE[d.expiry]}>{t(`ui.admin-promoters.documents.expiry.${d.expiry}`)}</StatusTag> : null}
                  </span>
                ),
              },
              { key: 'scan', header: '', cell: (d) => (d.scanStatus !== 'CLEAN' ? <span className={s.sub}>{t('ui.admin-promoters.documents.scanning')}</span> : null) },
            ]}
            rowActions={(d) => (
              <Menu
                label={t('ui.admin-programs.common.moreActions')}
                items={[
                  { key: 'open', label: t('ui.admin-promoters.documents.open'), icon: 'external-link', onSelect: () => void open(d), disabledReason: d.scanStatus !== 'CLEAN' ? t('ui.admin-promoters.documents.scanning') : null },
                  ...(p.can.write
                    ? [
                        { key: 'edit', label: t('ui.admin-promoters.documents.edit'), icon: 'edit' as const, onSelect: () => setDialog({ kind: 'edit', doc: d }) },
                        { key: 'delete', label: t('ui.admin-promoters.documents.delete'), icon: 'trash' as const, danger: true, onSelect: () => setDialog({ kind: 'delete', doc: d }) },
                      ]
                    : []),
                ]}
              />
            )}
          />
        )}
      </div>
      {dialog?.kind === 'add' || dialog?.kind === 'edit' ? <DocumentDialog promoterId={p.id} doc={dialog.doc ?? null} onClose={() => setDialog(null)} onDone={() => (setDialog(null), router.refresh())} /> : null}
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title={t('ui.admin-promoters.documents.deleteTitle', { label: dialog?.doc?.label ?? '' })}
        text={t('ui.admin-promoters.documents.deleteText')}
        submit={t('ui.admin-promoters.documents.delete')}
        danger
        call={() => adminCall(`/admin/promoters/${p.id}/documents/${dialog!.doc!.id}`, { method: 'DELETE' })}
        success={t('ui.admin-promoters.documents.toast.deleted')}
        onClose={() => setDialog(null)}
        onDone={() => (setDialog(null), router.refresh())}
      />
    </Surface>
  );
}

function DocumentDialog({ promoterId, doc, onClose, onDone }: { promoterId: string; doc: AdminPartnerDocument | null; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ label: doc?.label ?? '', category: doc?.category ?? 'Registre de commerce', issuedAt: doc?.issuedAt ?? '', expiresAt: doc?.expiresAt ?? '' });
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const { pending, failure, errors, run, setErrors } = useCall();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const meta = { label: v.label.trim(), category: v.category, issuedAt: v.issuedAt || null, expiresAt: v.expiresAt || null };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setUploadError(null);
    if (doc) {
      const ok = await run(() => adminCall(`/admin/promoters/${promoterId}/documents/${doc.id}`, { method: 'PATCH', body: meta }), t('ui.admin-promoters.documents.toast.saved'));
      if (ok !== null) onDone();
      return;
    }
    if (!file) return setErrors({ file: t('ui.validation.REQUIRED') });
    setProgress(0);
    const sha256 = await sha256Hex(await file.arrayBuffer());
    const announced = await adminCall<{ id: string; uploadUrl: string }>(`/admin/promoters/${promoterId}/document-uploads`, { body: { fileName: file.name, contentType: file.type || 'application/octet-stream', size: file.size, sha256 } });
    if (!announced.ok) {
      setProgress(null);
      return setUploadError(errorText(announced));
    }
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', announced.data.uploadUrl);
      xhr.withCredentials = true;
      xhr.setRequestHeader('content-type', 'application/octet-stream');
      xhr.setRequestHeader('X-CSRF-Token', document.cookie.match(/(?:^|; )dp_admin_csrf=([^;]*)/)?.[1] ?? '');
      xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(file);
    });
    setProgress(null);
    if (!ok) return setUploadError(errorText({ status: 0, offline: true }));
    const done = await run(() => adminCall(`/admin/promoters/${promoterId}/document-uploads/${announced.data.id}/complete`, { body: meta }), t('ui.admin-promoters.documents.toast.added'));
    if (done !== null) onDone();
  }
  return (
    <Modal open onClose={onClose} title={doc ? t('ui.admin-promoters.documents.edit') : t('ui.admin-promoters.documents.add')} closeLabel={t('ui.common.close')} width={560}>
      <form className={f.form} onSubmit={submit} noValidate>
        <FailureBanner failure={failure} />
        {uploadError ? (
          <Banner tone="error">
            <p>{uploadError}</p>
          </Banner>
        ) : null}
        <div className={f.row}>
          <TextInput label={t('ui.admin-promoters.documents.label')} value={v.label} onChange={(e) => setV((x) => ({ ...x, label: e.target.value }))} maxLength={160} error={errors.label} autoFocus />
          <SelectInput label={t('ui.admin-promoters.documents.category')} value={v.category} onChange={(e) => setV((x) => ({ ...x, category: e.target.value }))}>
            {PARTNER_DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectInput>
        </div>
        <div className={f.row}>
          <TextInput label={t('ui.admin-promoters.documents.issuedAt')} type="date" optional value={v.issuedAt} onChange={(e) => setV((x) => ({ ...x, issuedAt: e.target.value }))} error={errors.issuedAt} />
          <TextInput label={t('ui.admin-promoters.documents.expiresAt')} type="date" optional value={v.expiresAt} onChange={(e) => setV((x) => ({ ...x, expiresAt: e.target.value }))} error={errors.expiresAt} />
        </div>
        {!doc ? (
          <TextInput
            label={t('ui.admin-promoters.documents.file')}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)}
            error={errors.file}
            hint={progress !== null ? t('ui.admin-promoters.documents.uploading', { p: progress }) : t('ui.admin-promoters.documents.fileHint')}
          />
        ) : null}
        <DialogButtons close={onClose} pending={pending || progress !== null} label={t('ui.common.save')} disabled={!v.label.trim()} />
      </form>
    </Modal>
  );
}

// ─── Page publique ──────────────────────────────────────────────────────────

export function PromoterPublicPage({ p, webUrl }: { p: AdminPromoterDetail; webUrl: string }) {
  const router = useRouter();
  const patch = (body: Record<string, unknown>) => adminCall(`/admin/promoters/${p.id}`, { method: 'PATCH', body: { ...body, version: p.version } });
  return (
    <div className={s.sectionBody}>
      <EditableSection
        title={t('ui.admin-promoters.section.visibility')}
        canEdit={p.can.write}
        initial={{ isPublic: p.isPublic }}
        save={(v) => patch({ isPublic: v.isPublic })}
        view={
          <div className={s.tableHead}>
            <span className={s.tags}>
              {p.isPublic ? <StatusTag tone="success">{t('ui.admin-promoters.publicYes')}</StatusTag> : <StatusTag tone="neutral">{t('ui.admin-promoters.publicNo')}</StatusTag>}
              <span className={s.sub}>{t('ui.admin-promoters.field.isPublicHint')}</span>
            </span>
            {p.publicPath ? (
              <a className={st.publicLink} href={`${webUrl}${p.publicPath}`} target="_blank" rel="noreferrer">
                <Icon name="external-link" size={16} />
                {t('ui.admin-promoters.action.openPublic')}
              </a>
            ) : null}
          </div>
        }
        form={(v, set) => (
          <>
            <Checkbox label={t('ui.admin-promoters.field.isPublic')} checked={v.isPublic} onChange={(on) => set('isPublic', on)} />
            <p className={s.sub}>{t('ui.admin-promoters.field.isPublicHint')}</p>
          </>
        )}
      />
      <EditableSection
        title={t('ui.admin-promoters.section.presentation')}
        canEdit={p.can.write}
        initial={{ descriptionPublic: p.descriptionPublic ?? '', referencesPublic: p.referencesPublic ?? '', foundedYear: p.foundedYear ? String(p.foundedYear) : '', deliveredUnits: p.deliveredUnits === null ? '' : String(p.deliveredUnits) }}
        save={(v) => patch({ descriptionPublic: nullable(v.descriptionPublic), referencesPublic: nullable(v.referencesPublic), foundedYear: v.foundedYear ? Number(v.foundedYear) : null, deliveredUnits: v.deliveredUnits === '' ? null : Number(v.deliveredUnits) })}
        view={
          <>
            <ReadGrid
              items={[
                { label: t('ui.admin-promoters.field.foundedYear'), value: p.foundedYear },
                { label: t('ui.admin-promoters.field.deliveredUnits'), value: p.deliveredUnits },
                { label: t('ui.admin-promoters.field.descriptionPublic'), value: p.descriptionPublic ? <span className={s.prose}>{p.descriptionPublic}</span> : null, wide: true },
                { label: t('ui.admin-promoters.field.referencesPublic'), value: p.referencesPublic ? <span className={s.prose}>{p.referencesPublic}</span> : null, wide: true },
              ]}
            />
          </>
        }
        form={(v, set, e) => (
          <>
            <div className={f.row}>
              <TextInput label={t('ui.admin-promoters.field.foundedYear')} optional inputMode="numeric" value={v.foundedYear} onChange={(x) => set('foundedYear', x.target.value.replace(/\D/g, '').slice(0, 4))} error={e.foundedYear} />
              <TextInput label={t('ui.admin-promoters.field.deliveredUnits')} optional inputMode="numeric" value={v.deliveredUnits} onChange={(x) => set('deliveredUnits', x.target.value.replace(/\D/g, ''))} error={e.deliveredUnits} />
            </div>
            <TextArea label={t('ui.admin-promoters.field.descriptionPublic')} optional value={v.descriptionPublic} onChange={(x) => set('descriptionPublic', x.target.value)} maxLength={2000} rows={5} error={e.descriptionPublic} />
            <TextArea label={t('ui.admin-promoters.field.referencesPublic')} optional value={v.referencesPublic} onChange={(x) => set('referencesPublic', x.target.value)} maxLength={600} rows={3} error={e.referencesPublic} />
          </>
        )}
      />
      <Surface title={t('ui.admin-promoters.section.images')}>
        <div className={s.twoCols}>
          <ImageSlot ownerType="PROMOTER" ownerId={p.id} kind="LOGO" label={t('ui.admin-promoters.field.logo')} image={p.logo} canWrite={p.can.write} onChanged={() => router.refresh()} />
          <ImageSlot ownerType="PROMOTER" ownerId={p.id} kind="PHOTO" label={t('ui.admin-promoters.field.cover')} hint={t('ui.admin-promoters.field.coverHint')} image={p.cover} canWrite={p.can.write} onChanged={() => router.refresh()} />
        </div>
      </Surface>
    </div>
  );
}

// ─── Programmes ─────────────────────────────────────────────────────────────

export function PromoterPrograms({ p }: { p: AdminPromoterDetail }) {
  const newProgram = p.can.write && p.status !== 'ENDED' ? (
    <LinkButton href={`/catalogue/programmes/nouveau?promoteur=${p.id}`} variant="secondary" size="S" icon="plus">
      {t('ui.admin-promoters.action.newProgram')}
    </LinkButton>
  ) : null;
  return (
    <Surface title={t('ui.admin-promoters.programs.title')} actions={newProgram}>
      {p.programs.length === 0 && p.standalone.length === 0 ? (
        <EmptyState icon="building" title={t('ui.admin-promoters.programs.empty.title')} text={t('ui.admin-promoters.programs.empty.text')} actions={newProgram} compact />
      ) : (
        <div className={st.programs}>
          {p.programs.map((x) => (
            <section key={x.id} className={st.program}>
              <header className={st.programHead}>
                <Link href={`/catalogue/programmes/${x.id}`} className={s.nameLink}>
                  {x.name}
                </Link>
                <span className={s.sub}>{x.region}</span>
                <StatusTag tone={PUBLICATION_TONE[x.publication] ?? 'neutral'}>{t(`ui.enum.PublicationStatus.${x.publication}`)}</StatusTag>
                <StockMeter available={x.lotsAvailable} total={x.lotsTotal} compact />
              </header>
              <ul className={st.propertyList}>
                {x.properties.map((y) => (
                  <li key={y.id}>
                    <Link href={`/catalogue/biens/${y.id}`}>{y.title}</Link>
                    <span className={s.sub}>{y.reference}</span>
                    <StatusTag tone={PUBLICATION_TONE[y.publication] ?? 'neutral'}>{t(`ui.enum.PublicationStatus.${y.publication}`)}</StatusTag>
                    <StatusTag tone={AVAILABILITY_TONE[y.availability] ?? 'neutral'}>{t(`ui.enum.Availability.${y.availability as 'AVAILABLE'}`)}</StatusTag>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {p.standalone.length ? (
            <section className={st.program}>
              <header className={st.programHead}>
                <strong>{t('ui.admin-promoters.programs.standalone')}</strong>
              </header>
              <ul className={st.propertyList}>
                {p.standalone.map((y) => (
                  <li key={y.id}>
                    <Link href={`/catalogue/biens/${y.id}`}>{y.title}</Link>
                    <span className={s.sub}>{y.reference}</span>
                    <StatusTag tone={PUBLICATION_TONE[y.publication] ?? 'neutral'}>{t(`ui.enum.PublicationStatus.${y.publication}`)}</StatusTag>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </Surface>
  );
}
