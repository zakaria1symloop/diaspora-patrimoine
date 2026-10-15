'use client';
// TRV-094, API-050 — « Cette fiche a été modifiée par {prénom} à {heure}. Rechargez-la pour voir la dernière version ;
// vos changements ne sont pas enregistrés. » with « Recharger » and « Copier mes changements ». The name and the time
// come from the `params` of `409 CONFLICT_VERSION` (`updatedByFirstName`, `updatedAt`, API-020). « Copier » puts the
// text of what the person typed in the clipboard (`copyText`: works on the network address too), so nothing is lost.
import { useState } from 'react';
import type { ApiErrorBody } from '@dp/contracts';
import { Banner, Button, copyText } from '@dp/ui';
import { t } from '@/lib/i18n';
import { useShell } from './ShellContext';

/** True when a failed call is a version conflict (TRV-094). */
export function isConflict(error: ApiErrorBody['error'] | null | undefined): boolean {
  return error?.code === 'CONFLICT_VERSION';
}

export function ConflictNotice({ error, onReload, changes }: { error: ApiErrorBody['error'] | null | undefined; onReload: () => void; changes?: () => string }) {
  const { timeZone } = useShell();
  const [copied, setCopied] = useState(false);
  const params = (error?.params ?? {}) as { updatedByFirstName?: string | null; updatedAt?: string | null };
  const time = params.updatedAt ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(params.updatedAt)) : '—';
  const name = params.updatedByFirstName || t('ui.common.conflict.someone');
  return (
    <Banner tone="warning">
      <p>{t('ui.common.conflict.text', { prenom: name, heure: time.replace(':', ' h ') })}</p>
      <p>
        <Button variant="secondary" size="S" type="button" onClick={onReload}>
          {t('ui.common.conflict.reload')}
        </Button>{' '}
        {changes ? (
          <Button variant="tertiary" size="S" type="button" icon={copied ? 'check' : undefined} onClick={() => void copyText(changes()).then(setCopied)}>
            {copied ? t('ui.common.conflict.copied') : t('ui.common.conflict.copy')}
          </Button>
        ) : null}
      </p>
    </Banner>
  );
}

/** « Copier mes changements » — the values typed, one per line (« champ : valeur »), empty ones left out. */
export function changesText(values: Record<string, unknown>): string {
  return Object.entries(values)
    .filter(([, x]) => x !== '' && x !== null && x !== undefined && !(Array.isArray(x) && !x.length))
    .map(([k, x]) => `${k} : ${Array.isArray(x) ? x.join(', ') : typeof x === 'object' ? JSON.stringify(x) : String(x)}`)
    .join('\n');
}
