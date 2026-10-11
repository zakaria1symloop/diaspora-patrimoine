// TRV-110, TRV-113, TRV-117, 07-design/03 § 4 — the sentence of an error answer: the API sends a stable code (and
// sometimes a reason), the screen translates it; a technical message is never shown. A reason that has its own
// sentence (`ui.admin-shell.reason.*`, then `ui.error.reason.*`) replaces the message of the code.
import type { ApiErrorBody, ApiErrorDetail } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { t } from './i18n';

type ApiError = ApiErrorBody['error'];

export interface Failure {
  status: number;
  error?: ApiError | null;
  code?: string | null;
  reason?: string | null;
  requestId?: string | null;
  offline?: boolean;
}

export function errorText(failure: Failure): string {
  if (failure.offline || failure.status === 0) return t('ui.common.offline');
  const code = failure.error?.code ?? failure.code ?? null;
  const reason = failure.error?.reason ?? failure.reason ?? null;
  const requestId = failure.error?.requestId ?? failure.requestId ?? '—';
  const p = (failure.error?.params ?? {}) as Record<string, string | number>;
  if (reason) {
    for (const ns of ['ui.admin-shell.reason', 'ui.auth.reason', 'ui.error.reason']) {
      const key = `${ns}.${reason}`;
      if (hasMessage(key)) return t(key as MessageKey, p);
    }
  }
  switch (code) {
    case 'ACCOUNT_LOCKED':
      return t('ui.error.ACCOUNT_LOCKED', { n: p.minutes ?? p.n ?? 15 });
    case 'ACCOUNT_SUSPENDED':
      return t('ui.admin-shell.door.suspended');
    case 'INVALID_CODE':
      return typeof p.remaining === 'number' ? t('ui.auth.twoFactor.invalid', { n: p.remaining }) : t('ui.auth.twoFactor.wrong');
    case 'UNAUTHENTICATED':
      return t('ui.auth.common.sessionExpired');
    case 'RATE_LIMITED':
      return t('ui.error.RATE_LIMITED');
    case 'VALIDATION_ERROR':
      return t('ui.admin-shell.error.validation');
    case 'INTERNAL_ERROR':
    case null:
      return t('ui.error.INTERNAL_ERROR', { identifiant: requestId });
    default: {
      const key = `ui.error.${code}`;
      return hasMessage(key) ? t(key as MessageKey, { ...p, n: p.n ?? '', identifiant: requestId }) : t('ui.error.INTERNAL_ERROR', { identifiant: requestId });
    }
  }
}

/** TRV-117 — an unexpected error (5xx, or an answer the screen does not know) shows its « Détails ». */
export function isUnexpected(failure: Failure): boolean {
  return failure.status >= 500 || (!failure.offline && failure.status !== 0 && !failure.error && !failure.code);
}

/** TRV-064 — the message of one field code. */
export function fieldMessage(detail: Pick<ApiErrorDetail, 'code' | 'params'>): string {
  const p = (detail.params ?? {}) as Record<string, string | number>;
  if (detail.code === 'WEAK_PASSWORD') return p.reason === 'PERSONAL' ? t('ui.auth.password.personal') : t('ui.auth.password.common');
  if (detail.code === 'TOO_SHORT' && p.n) return t('ui.auth.password.tooShort', { n: p.n });
  if (detail.code === 'ALREADY_USED') return t('ui.admin-shell.error.alreadyUsed');
  const key = `ui.validation.${detail.code}`;
  return hasMessage(key) ? t(key as MessageKey, p) : t('ui.validation.INVALID_CHOICE');
}

/** Field errors of a 422, keyed by field path. */
export function fieldErrors(error: ApiError | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (error?.code !== 'VALIDATION_ERROR') return out;
  for (const d of error.details) if (!out[d.field]) out[d.field] = fieldMessage(d);
  return out;
}

/** ARC-030 — the shared schema checks in the browser before sending: same codes, same messages. */
export function checkSchema<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string; code: string; maximum?: unknown }[] } } }, value: unknown): { ok: true; data: T } | { ok: false; errors: Record<string, string> } {
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const field = issue.path.map(String).join('.');
    if (errors[field]) continue;
    const known = hasMessage(`ui.validation.${issue.message}`);
    const code = known ? issue.message : issue.code === 'too_big' ? 'TOO_LONG' : issue.code === 'invalid_value' || issue.code === 'invalid_format' ? 'INVALID_CHOICE' : 'REQUIRED';
    errors[field] = fieldMessage({ code, params: issue.code === 'too_big' ? { n: Number(issue.maximum) } : null });
  }
  return { ok: false, errors };
}
