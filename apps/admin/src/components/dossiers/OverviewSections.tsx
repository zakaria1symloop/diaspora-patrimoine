'use client';
// PIP-025 — two sections of the overview edited in place (BO-046: « Modifier » → « Enregistrer » · « Annuler », the
// version read is sent back, a conflict says so): the plan of financing (MOD-313: one price of the project; the
// amounts follow `client.sensitive.read`) and « Prochaine étape affichée au client » (ECL-021).
import { useState, type FormEvent } from 'react';
import type { DossierDetail } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Button, Icon } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Facts, Surface } from '../shell/Page';
import { SelectInput, TextArea, TextInput, formStyles as f, useUnsavedGuard } from '../shell/forms';
import { useAction } from './dialogs';
import { allowed, amount, enumLabel, whyNot } from './parts';
import s from './dossiers.module.css';

const reserved = () => <span className={s.muted}>{t('ui.admin-dossiers.reserved')}</span>;

export function PlanSection({ d, done }: { d: DossierDetail; done: (next: DossierDetail) => void }) {
  const p = d.financing;
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState({ purchasePrice: '', downPayment: '', downPaymentCurrency: '', loanAmountRequested: '', durationMonths: '', financingType: '' });
  const { pending, errors, run, banner } = useAction<DossierDetail>((next) => (setEditing(false), done(next)), t('ui.common.saved'));
  const dirty = editing && JSON.stringify(v) !== JSON.stringify(start());
  useUnsavedGuard(dirty);
  const canEdit = allowed(d.can.update);

  function start() {
    return {
      purchasePrice: p.purchasePrice?.amount.replace(/\.00$/, '') ?? '',
      downPayment: p.downPayment?.amount.replace(/\.00$/, '') ?? '',
      downPaymentCurrency: p.downPayment?.currency ?? p.purchasePrice?.currency ?? '',
      loanAmountRequested: p.loanAmount?.amount.replace(/\.00$/, '') ?? '',
      durationMonths: p.durationMonths ? String(p.durationMonths) : '',
      financingType: p.type && p.type !== 'CASH' ? p.type : '',
    };
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { version: d.version };
    const n = (x: string) => (x.trim() === '' ? null : x.trim().replace(/\s/g, ''));
    if (d.property) body.purchasePrice = n(v.purchasePrice);
    if (p.sensitive) {
      body.downPayment = n(v.downPayment);
      body.downPaymentCurrency = n(v.downPayment) ? v.downPaymentCurrency || null : null;
      if (p.requested) body.loanAmountRequested = n(v.loanAmountRequested);
    }
    if (p.requested) {
      body.durationMonths = v.durationMonths ? Number(v.durationMonths) : null;
      body.financingType = v.financingType || null;
    }
    void run(() => adminCall<DossierDetail>(`/admin/dossiers/${d.id}`, { method: 'PATCH', body }));
  }

  // MOD-313 — the gap with the public price is shown.
  const publicGap = p.purchasePrice && p.publicPrice && p.purchasePrice.currency === p.publicPrice.currency && p.purchasePrice.amount !== p.publicPrice.amount ? Number(p.purchasePrice.amount) - Number(p.publicPrice.amount) : null;
  return (
    <Surface
      title={t('ui.admin-dossiers.plan.title')}
      actions={
        canEdit && !editing ? (
          <Button variant="secondary" size="S" onClick={() => (setV(start()), setEditing(true))}>
            <Icon name="edit" size={16} />
            {t('ui.common.edit')}
          </Button>
        ) : !canEdit && d.can.update !== false ? (
          <span className={s.sub}>{whyNot(d.can.update)}</span>
        ) : undefined
      }
    >
      {editing ? (
        <form className={f.form} onSubmit={submit} noValidate>
          {banner}
          {d.property ? (
            <TextInput label={t('ui.admin-dossiers.plan.price', { devise: p.purchasePrice?.currency ?? p.publicPrice?.currency ?? '' })} inputMode="decimal" value={v.purchasePrice} onChange={(e) => setV({ ...v, purchasePrice: e.target.value })} error={errors.purchasePrice} hint={p.publicPrice ? t('ui.admin-dossiers.plan.publicPrice', { prix: money(p.publicPrice.amount, p.publicPrice.currency) }) : undefined} />
          ) : (
            <p className={s.sub}>{t('ui.admin-dossiers.plan.retainFirst')}</p>
          )}
          {p.sensitive ? (
            <div className={f.row}>
              <TextInput label={t('ui.admin-dossiers.plan.downPayment')} inputMode="decimal" value={v.downPayment} onChange={(e) => setV({ ...v, downPayment: e.target.value })} error={errors.downPayment} />
              <TextInput label={t('ui.admin-dossiers.field.currency')} value={v.downPaymentCurrency} maxLength={3} onChange={(e) => setV({ ...v, downPaymentCurrency: e.target.value.toUpperCase() })} error={errors.downPaymentCurrency} />
            </div>
          ) : null}
          {p.requested ? (
            <>
              {p.sensitive ? <TextInput label={t('ui.admin-dossiers.plan.loan')} inputMode="decimal" value={v.loanAmountRequested} onChange={(e) => setV({ ...v, loanAmountRequested: e.target.value })} error={errors.loanAmountRequested} /> : null}
              <div className={f.row}>
                <TextInput label={t('ui.admin-dossiers.plan.duration')} inputMode="numeric" value={v.durationMonths} onChange={(e) => setV({ ...v, durationMonths: e.target.value.replace(/\D/g, '') })} error={errors.durationMonths} hint={t('ui.admin-dossiers.plan.durationHint')} />
                <SelectInput label={t('ui.admin-dossiers.plan.type')} value={v.financingType} onChange={(e) => setV({ ...v, financingType: e.target.value })}>
                  <option value="">{t('ui.admin-dossiers.field.choose')}</option>
                  {(['CONVENTIONAL', 'ISLAMIC', 'NO_PREFERENCE'] as const).map((x) => (
                    <option key={x} value={x}>
                      {enumLabel('FinancingPreference', x)}
                    </option>
                  ))}
                </SelectInput>
              </div>
            </>
          ) : null}
          <div className={`${f.actions} ${f.actionsEnd}`}>
            <Button variant="secondary" size="M" onClick={() => setEditing(false)}>
              {t('ui.common.cancel')}
            </Button>
            <Button type="submit" variant="tool" size="M" pending={pending}>
              {t('ui.common.save')}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <Facts
            items={[
              { label: t('ui.admin-dossiers.plan.mode'), value: p.requested ? t('ui.admin-dossiers.plan.with') : t('ui.admin-dossiers.plan.without') },
              ...(p.requested ? [{ label: t('ui.admin-dossiers.plan.type'), value: enumLabel('FinancingPreference', p.type) }] : []),
              {
                label: t('ui.admin-dossiers.plan.priceLabel'),
                value: d.property ? (
                  p.purchasePrice ? (
                    <span>
                      {amount(p.purchasePrice)}
                      {publicGap !== null ? <span className={s.sub}> {t('ui.admin-dossiers.plan.gapPublic', { ecart: money(Math.abs(publicGap), p.purchasePrice.currency), sens: publicGap < 0 ? '−' : '+' })}</span> : null}
                    </span>
                  ) : null
                ) : (
                  <span className={s.muted}>{t('ui.admin-dossiers.plan.retainFirst')}</span>
                ),
              },
              { label: t('ui.admin-dossiers.plan.downPayment'), value: p.sensitive ? amount(p.downPayment) : reserved() },
              ...(p.requested ? [{ label: t('ui.admin-dossiers.plan.loan'), value: p.sensitive ? amount(p.loanAmount) : reserved() }, { label: t('ui.admin-dossiers.plan.duration'), value: p.durationMonths ? t('ui.admin-dossiers.plan.months', { n: p.durationMonths }) : null }] : []),
            ]}
          />
          {p.gap ? (
            <p className={s.warnLine}>
              <Icon name="status-warning" size={16} />
              {t('ui.admin-dossiers.plan.gap', { montant: money(Math.abs(Number(p.gap.amount)), p.gap.currency) })}
            </p>
          ) : null}
        </>
      )}
    </Surface>
  );
}

/** ECL-021 — the sentence the client reads under « Prochaine étape »: the default one of the stage, or the adviser's own. */
export function NextStepSection({ d, done }: { d: DossierDetail; done: (next: DossierDetail) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const { pending, errors, run, banner } = useAction<DossierDetail>((next) => (setEditing(false), done(next)), t('ui.common.saved'));
  useUnsavedGuard(editing && text !== (d.clientNextStep.custom ?? ''));
  const key = `ui.client.nextStep.${d.clientNextStep.defaultCode}`;
  const params: Record<string, string | number> = { conseiller: t('ui.client.nextStep.advisorFallback') };
  for (const [k, v] of Object.entries(d.clientNextStep.defaultParams)) if (v !== null) params[k] = v;
  const fallback = hasMessage(key) ? safe(() => t(key as MessageKey, params)) : null;
  const save = (value: string | null) => void run(() => adminCall<DossierDetail>(`/admin/dossiers/${d.id}`, { method: 'PATCH', body: { version: d.version, clientNextStep: value } }));
  const canEdit = allowed(d.can.update);
  return (
    <Surface
      title={t('ui.admin-dossiers.nextStep.title')}
      actions={
        canEdit && !editing ? (
          <Button variant="secondary" size="S" onClick={() => (setText(d.clientNextStep.custom ?? fallback ?? ''), setEditing(true))}>
            <Icon name="edit" size={16} />
            {t('ui.admin-dossiers.nextStep.write')}
          </Button>
        ) : undefined
      }
    >
      {editing ? (
        <form
          className={f.form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save(text.trim() || null);
          }}
        >
          {banner}
          <TextArea label={t('ui.admin-dossiers.nextStep.label')} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={3} error={errors.clientNextStep} hint={t('ui.admin-dossiers.nextStep.hint')} autoFocus />
          <div className={`${f.actions} ${f.actionsEnd}`}>
            <Button variant="secondary" size="M" onClick={() => setEditing(false)}>
              {t('ui.common.cancel')}
            </Button>
            <Button type="submit" variant="tool" size="M" pending={pending}>
              {t('ui.common.save')}
            </Button>
          </div>
        </form>
      ) : (
        <div className={s.clientSees}>
          <span className={s.clientSeesLabel}>
            <Icon name="eye" size={16} />
            {d.clientNextStep.custom ? t('ui.admin-dossiers.nextStep.custom') : t('ui.admin-dossiers.nextStep.automatic')}
          </span>
          <blockquote className={s.quote}>{d.clientNextStep.custom ?? fallback ?? t('ui.admin-dossiers.nextStep.none')}</blockquote>
          {d.clientNextStep.custom && canEdit ? (
            <Button variant="secondary" size="S" pending={pending} onClick={() => save(null)}>
              {t('ui.admin-dossiers.nextStep.restore')}
            </Button>
          ) : null}
        </div>
      )}
    </Surface>
  );
}

function safe(fn: () => string): string | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
