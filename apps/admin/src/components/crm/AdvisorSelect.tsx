'use client';
// CRM-011, CRM-021 — the choice of an adviser, the same in every « Affecter à… » window (requests, clients, later
// dossiers): the active OWNER, ADMIN and AGENT accounts (`GET /admin/advisors`), the reader marked « (moi) », an absent
// colleague named with the last day of his absence and — where the rule says « non absent » — not selectable.
import { useEffect, useState } from 'react';
import type { AdvisorOption } from '@dp/contracts';
import { adminCall } from '@/lib/admin-client';
import { shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { SelectInput } from '../shell/forms';
import { useShell } from '../shell/ShellContext';

let cached: { at: number; data: AdvisorOption[] } | null = null;
let loading: Promise<AdvisorOption[] | null> | null = null;

/** The advisers, read once and kept a minute (several windows of a screen share the answer). */
export function loadAdvisors(force = false): Promise<AdvisorOption[] | null> {
  if (!force && cached && Date.now() - cached.at < 60_000) return Promise.resolve(cached.data);
  loading ??= adminCall<{ data: AdvisorOption[] }>('/admin/advisors')
    .then((r) => {
      if (!r.ok) return null;
      cached = { at: Date.now(), data: r.data.data };
      return cached.data;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

export function useAdvisors(): { advisors: AdvisorOption[] | null; failed: boolean } {
  const [advisors, setAdvisors] = useState<AdvisorOption[] | null>(cached?.data ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadAdvisors().then((list) => {
      if (!alive) return;
      if (list) setAdvisors(list);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { advisors, failed };
}

export interface AdvisorSelectProps {
  value: string;
  onChange: (userId: string) => void;
  label?: string;
  id?: string;
  error?: string | null;
  hint?: string;
  /** Offers « Personne pour l'instant » (an empty value). */
  allowNone?: boolean;
  noneLabel?: string;
  /** CRM-011 — « un conseiller actif, non absent »: an absent colleague is shown, not selectable. */
  disableAbsent?: boolean;
  /** Accounts left out (the current adviser of the object, when reassigning). */
  exclude?: string[];
  autoFocus?: boolean;
}

export function AdvisorSelect({ value, onChange, label, id, error, hint, allowNone, noneLabel, disableAbsent, exclude, autoFocus }: AdvisorSelectProps) {
  const { shell } = useShell();
  const { advisors, failed } = useAdvisors();
  const options = (advisors ?? []).filter((a) => !exclude?.includes(a.id));
  return (
    <SelectInput
      id={id}
      label={label ?? t('ui.admin-crm.advisor.label')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error ?? (failed ? t('ui.admin-crm.advisor.loadFailed') : null)}
      hint={hint}
      autoFocus={autoFocus}
      disabled={advisors === null && !failed}
    >
      {allowNone ? (
        <option value="">{noneLabel ?? t('ui.admin-crm.advisor.none')}</option>
      ) : (
        <option value="" disabled>
          {t('ui.admin-crm.advisor.placeholder')}
        </option>
      )}
      {options.map((a) => {
        const name = a.id === shell.user.id ? t('ui.admin-crm.advisor.me', { nom: a.name }) : a.name;
        return (
          <option key={a.id} value={a.id} disabled={disableAbsent && a.absentUntil !== null}>
            {a.absentUntil ? t('ui.admin-crm.advisor.absentUntil', { nom: name, date: shortDay(a.absentUntil) }) : name}
          </option>
        );
      })}
    </SelectInput>
  );
}
