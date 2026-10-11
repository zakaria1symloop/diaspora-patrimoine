'use client';
// CTL-064 — « Disponibilités vérifiées le {date} avec {interlocuteur} », or the alert « À vérifier avec le promoteur »
// past `catalogue.stockCheckDays`, and the button « Disponibilités vérifiées » with its window (who confirmed — one of
// the promoter's contacts, or a name; optional — and a note that becomes an internal note). On top of the lots of a
// programme, and on a standalone property (`POST /admin/programs/{id}/confirm-stock`, `/admin/properties/{id}/confirm-stock`).
import { useState, type FormEvent } from 'react';
import type { StockCheckView } from '@dp/contracts';
import { Button, Icon, Modal } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { shortDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useShell } from '../shell/ShellContext';
import { SelectInput, TextArea, TextInput, formStyles as f } from '../shell/forms';
import { DialogButtons, FailureBanner, useCall } from '../catalogue/parts';
import s from './lots.module.css';

export interface StockCheckProps {
  scope: { programId: string } | { propertyId: string };
  canWrite: boolean;
  /** The state of the record (`AdminProgramDetail.stock`, `AdminPropertyDetail.stock`). */
  stock?: StockCheckView | null;
  onChanged?: () => void;
}

export function StockCheck({ scope, canWrite, stock, onChanged }: StockCheckProps) {
  const { timeZone } = useShell();
  const [open, setOpen] = useState(false);
  if (!stock) return null;
  const due = stock.state === 'DUE';
  const line = stock.confirmedAt
    ? stock.confirmedBy
      ? t('ui.admin-programs.stock.verified', { date: shortDate(stock.confirmedAt, timeZone), nom: stock.confirmedBy })
      : t('ui.admin-programs.stock.verifiedNoOne', { date: shortDate(stock.confirmedAt, timeZone) })
    : stock.state === 'NOT_CONCERNED'
      ? t('ui.admin-programs.stock.notConcerned')
      : t('ui.admin-programs.stock.never');
  return (
    <div className={s.stockBar} data-due={due ? '1' : undefined}>
      <span className={s.stockIcon} aria-hidden="true">
        <Icon name={due ? 'status-warning' : 'check'} size={20} />
      </span>
      <span className={s.stockText}>
        {due ? <strong>{t('ui.admin-programs.stock.due')}</strong> : null}
        <span>{line}</span>
        {due && stock.dueAt ? <span className={s.stockSub}>{t('ui.admin-programs.stock.dueSince', { date: shortDate(stock.dueAt, timeZone) })}</span> : null}
      </span>
      {canWrite && stock.state !== 'NOT_CONCERNED' ? (
        <Button variant={due ? 'tool' : 'secondary'} size="S" icon="check" onClick={() => setOpen(true)}>
          {t('ui.admin-programs.stock.button')}
        </Button>
      ) : null}
      {open ? <ConfirmStockDialog scope={scope} stock={stock} onClose={() => setOpen(false)} onDone={() => (setOpen(false), onChanged?.())} /> : null}
    </div>
  );
}

function ConfirmStockDialog({ scope, stock, onClose, onDone }: { scope: StockCheckProps['scope']; stock: StockCheckView; onClose: () => void; onDone: () => void }) {
  const [who, setWho] = useState(stock.contacts[0]?.id ?? '');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const { pending, failure, errors, run } = useCall();
  const path = 'programId' in scope ? `/admin/programs/${scope.programId}/confirm-stock` : `/admin/properties/${scope.propertyId}/confirm-stock`;
  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { contactId: who && who !== 'other' ? who : null, name: who === 'other' ? name : null, note: note || null };
    const ok = await run(() => adminCall(path, { body }), t('ui.admin-programs.stock.toast'));
    if (ok !== null) onDone();
  }
  return (
    <Modal open onClose={onClose} title={t('ui.admin-programs.stock.dialog.title')} closeLabel={t('ui.common.close')} width={560}>
      <form className={f.form} onSubmit={submit} noValidate>
        <p>{t('ui.admin-programs.stock.dialog.intro')}</p>
        <FailureBanner failure={failure} />
        <SelectInput label={t('ui.admin-programs.stock.dialog.who')} optional value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">{t('ui.admin-programs.stock.dialog.whoNone')}</option>
          {stock.contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.role ? `${c.name} · ${c.role}` : c.name}
            </option>
          ))}
          <option value="other">{t('ui.admin-programs.stock.dialog.whoOther')}</option>
        </SelectInput>
        {who === 'other' ? <TextInput label={t('ui.admin-programs.stock.dialog.name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} error={errors.name} autoFocus /> : null}
        <TextArea label={t('ui.admin-programs.stock.dialog.note')} optional value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} hint={t('ui.admin-programs.stock.dialog.noteHint')} error={errors.note} />
        <DialogButtons close={onClose} pending={pending} label={t('ui.admin-programs.stock.dialog.submit')} />
      </form>
    </Modal>
  );
}
