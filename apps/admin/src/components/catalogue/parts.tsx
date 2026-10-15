'use client';
// Packages 3.4 to 3.6 — the pieces every catalogue screen shares: the label of a delivery (« T4 2027 »), the stock of a
// programme or a property (« 12 / 13 » with its gauge), a vignette, the list of what publishing lacks (CYC-120,
// CYC-125), a confirmation window that names the object and runs one call (TRV-095), a section of a record edited in
// place (BO-046: « Modifier » → « Enregistrer » · « Annuler », guard of unsaved changes, 409 of a newer version), and
// the labels of a table.
import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminImageRef } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Banner, Button, ButtonInner, buttonClass, Icon, Modal, useToast, type ButtonSize, type ButtonType, type DataTableLabels, type IconName } from '@dp/ui';
import { adminCall, type CallResult } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { DASH, money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useUnsavedGuard, formStyles as f } from '../shell/forms';
import { Surface } from '../shell/Page';
import { changesText, ConflictNotice } from '../shell/ConflictNotice';
import { FailureDetails } from '../shell/ReadFailure';
import s from './catalogue.module.css';

type Failure = Extract<CallResult<unknown>, { ok: false }>;

/** « T4 2027 » · « octobre 2027 » · « 2027 » · « Livré ». */
export function deliveryLabel(status: string, date: string | null, precision: string): string {
  if (status === 'DELIVERED') return t('ui.admin-programs.common.delivery.delivered');
  if (!date) return DASH;
  const [y, m] = date.split('-').map(Number) as [number, number];
  if (precision === 'YEAR') return t('ui.admin-programs.common.delivery.YEAR', { annee: y });
  if (precision === 'MONTH') {
    const mois = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
    return t('ui.admin-programs.common.delivery.MONTH', { mois, annee: y });
  }
  return t('ui.admin-programs.common.delivery.QUARTER', { q: Math.floor((m - 1) / 3) + 1, annee: y });
}

export const moneyOr = (amount: string | null | undefined, currency: string, fallback = DASH) => (amount ? money(amount, currency) : fallback);

/** « 12 / 13 » and a gauge: the important stock figure, readable at a glance. */
export function StockMeter({ available, total, compact, large }: { available: number; total: number; compact?: boolean; large?: boolean }) {
  if (total === 0) return <span className={s.muted}>{t('ui.admin-programs.row.noLot')}</span>;
  const pct = Math.round((available / total) * 100);
  return (
    <span className={[s.stock, compact && s.stockCompact, large && s.stockLarge].filter(Boolean).join(' ')} title={t('ui.admin-programs.common.stockLabel', { a: available, t: total })}>
      <span className={s.stockFigure}>{t('ui.admin-programs.common.stock', { a: available, t: total })}</span>
      <span className={s.gauge} aria-hidden="true">
        <span className={s.gaugeFill} style={{ width: `${pct}%` }} data-empty={available === 0 ? '1' : undefined} />
      </span>
    </span>
  );
}

/** A router link drawn as a button (the main action of a page is a `tool` button of size M, DSN-091). */
export function LinkButton({ href, variant = 'tool', size = 'M', icon, children }: { href: string; variant?: ButtonType; size?: ButtonSize; icon?: IconName; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size)}>
      <ButtonInner icon={icon} size={size}>
        {children}
      </ButtonInner>
    </Link>
  );
}

/** A vignette (thumb rendition), or a neutral visual when the object has no image yet (TRV-133). */
export function Thumb({ image, size = 'S' }: { image: AdminImageRef | null; size?: 'S' | 'M' | 'L' }) {
  return (
    <span className={`${s.thumb} ${s[`thumb${size}`]}`} aria-hidden="true">
      {image ? <img src={image.url} alt="" loading="lazy" /> : <Icon name="building" size={size === 'S' ? 16 : 24} />}
    </span>
  );
}

/** CYC-120, CYC-125 — what publishing lacks, in plain words. */
export function MissingList({ codes, minScore }: { codes: string[]; minScore?: number }) {
  return (
    <ul className={s.missing}>
      {codes.map((c) => (
        <li key={c}>
          <Icon name="status-warning" size={16} />
          {hasMessage(`ui.admin-programs.common.missing.${c}`) ? t(`ui.admin-programs.common.missing.${c}` as MessageKey, { n: minScore ?? 0 }) : c}
        </li>
      ))}
    </ul>
  );
}

/** A failure above a form: its sentence (TRV-110) and « Détails » for an unexpected one (TRV-117). */
export function FailureBanner({ failure }: { failure: Failure | null }) {
  if (!failure) return null;
  const missing = failure.error?.code === 'CONFLICT_STATE' ? (failure.error.details ?? []).filter((d) => d.code === 'MISSING_CONDITION').map((d) => d.field) : [];
  return (
    <Banner tone="error">
      <p>{errorText(failure)}</p>
      {missing.length ? <MissingList codes={missing} /> : null}
      <FailureDetails failure={failure} />
    </Banner>
  );
}

/** The pending state, the failure and the toast of one call (windows, quick actions). */
export function useCall() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = async <T,>(call: () => Promise<CallResult<T>>, success?: string): Promise<T | null> => {
    setPending(true);
    setFailure(null);
    setErrors({});
    const r = await call();
    setPending(false);
    if (r.ok) {
      if (success) toast({ text: success });
      return r.data;
    }
    if (r.aborted) return null;
    const fields = fieldErrors(r.error);
    if (Object.keys(fields).length) setErrors(fields);
    else setFailure(r);
    return null;
  };
  const reset = () => {
    setFailure(null);
    setErrors({});
  };
  const notify = (text: string) => toast({ text });
  return { pending, failure, errors, setErrors, run, reset, notify };
}

export function DialogButtons({ close, pending, label, danger, disabled }: { close: () => void; pending: boolean; label: string; danger?: boolean; disabled?: boolean }) {
  return (
    <div className={`${f.actions} ${f.actionsEnd}`}>
      <Button variant="secondary" size="M" onClick={close} type="button">
        {t('ui.common.cancel')}
      </Button>
      <Button type="submit" variant={danger ? 'danger' : 'tool'} size="M" pending={pending} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}

/**
 * TRV-095 — a confirmation that names the object and announces its effects, then runs one call. `children` carries
 * the effects (numbers) and options; `onDone` receives the answer.
 */
export function ConfirmDialog<T>({
  open,
  title,
  text,
  children,
  submit,
  danger,
  call,
  success,
  onClose,
  onDone,
  width,
}: {
  open: boolean;
  title: string;
  text?: ReactNode;
  children?: ReactNode;
  submit: string;
  danger?: boolean;
  call: () => Promise<CallResult<T>>;
  success?: string;
  onClose: () => void;
  onDone: (data: T) => void;
  width?: 480 | 560 | 720;
}) {
  const { pending, failure, run, reset } = useCall();
  const close = () => {
    reset();
    onClose();
  };
  async function submitForm(e: FormEvent) {
    e.preventDefault();
    const data = await run(call, success);
    if (data !== null) {
      reset();
      onDone(data);
    }
  }
  return (
    <Modal open={open} onClose={close} title={title} closeLabel={t('ui.common.close')} width={width ?? 480}>
      <form className={f.form} onSubmit={submitForm} noValidate>
        {text ? <p className={s.dialogText}>{text}</p> : null}
        {children}
        <FailureBanner failure={failure} />
        <DialogButtons close={close} pending={pending} label={submit} danger={danger} />
      </form>
    </Modal>
  );
}

/**
 * BO-046 — one section of a record, read then edited in place: « Modifier » → the form, « Enregistrer » · « Annuler »;
 * leaving with changes asks first (TRV-093); a newer version (409) says who changed it and offers to reload.
 */
export function EditableSection<V extends Record<string, unknown>>({
  title,
  canEdit,
  initial,
  view,
  form,
  save,
  aside,
  onSaved,
  id,
}: {
  title: string;
  canEdit: boolean;
  initial: V;
  view: ReactNode;
  form: (values: V, set: <K extends keyof V>(key: K, value: V[K]) => void, errors: Record<string, string>) => ReactNode;
  save: (values: V) => Promise<CallResult<unknown>>;
  /** A short notice under the form (an inheritance warning computed from the values). */
  aside?: (values: V) => ReactNode;
  onSaved?: () => void;
  id?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<V>(initial);
  const { pending, failure, errors, run, reset } = useCall();
  const dirty = editing && JSON.stringify(values) !== JSON.stringify(initial);
  useUnsavedGuard(dirty);
  const set = <K extends keyof V>(key: K, value: V[K]) => setValues((v) => ({ ...v, [key]: value }));
  const start = () => {
    setValues(initial);
    reset();
    setEditing(true);
  };
  const cancel = () => {
    setValues(initial);
    reset();
    setEditing(false);
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    const done = await run(() => save(values), t('ui.admin-programs.common.saved'));
    if (done !== null) {
      setEditing(false);
      onSaved?.();
      router.refresh();
    }
  }
  const conflict = failure?.error?.code === 'CONFLICT_VERSION';
  return (
    <Surface
      title={title}
      actions={
        canEdit && !editing ? (
          <Button variant="tertiary" size="S" icon="edit" onClick={start} aria-label={t('ui.admin-programs.common.editSection', { section: title })}>
            {t('ui.admin-programs.common.edit')}
          </Button>
        ) : null
      }
    >
      <div id={id} className={s.sectionBody}>
        {editing ? (
          <form className={f.form} onSubmit={submit} noValidate>
            {conflict ? (
              <ConflictNotice error={failure?.error} onReload={() => router.refresh()} changes={() => changesText(values as Record<string, unknown>)} />
            ) : (
              <FailureBanner failure={failure} />
            )}
            {form(values, set, errors)}
            {aside?.(values)}
            <div className={f.actions}>
              <Button type="submit" variant="tool" size="M" pending={pending}>
                {t('ui.common.save')}
              </Button>
              <Button type="button" variant="secondary" size="M" onClick={cancel}>
                {t('ui.common.cancel')}
              </Button>
            </div>
          </form>
        ) : (
          view
        )}
      </div>
    </Surface>
  );
}

/** Values of a read-only section: a label and its value, « — » when missing. */
export function ReadGrid({ items, columns = 2 }: { items: { label: string; value: ReactNode; wide?: boolean }[]; columns?: 2 | 3 }) {
  return (
    <dl className={[s.readGrid, columns === 3 && s.readGrid3].filter(Boolean).join(' ')}>
      {items.map((it) => (
        <div key={it.label} className={it.wide ? s.readWide : undefined}>
          <dt>{it.label}</dt>
          <dd>{it.value === null || it.value === undefined || it.value === '' ? DASH : it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function tableLabels(caption: string): DataTableLabels {
  return {
    caption,
    sortAscending: t('ui.admin-shell.list.sortAsc'),
    sortDescending: t('ui.admin-shell.list.sortDesc'),
    selectAll: t('ui.admin-shell.list.selectAll'),
    selectRow: (name) => t('ui.admin-shell.list.selectRow', { nom: name }),
    actions: t('ui.admin-shell.list.actions'),
  };
}

/** `?onglet=` — the tab asked by the address, if the record has it. */
export function pickTab(asked: string | undefined, keys: string[]): string {
  return asked && keys.includes(asked) ? asked : keys[0]!;
}

export { s as catalogueStyles };
