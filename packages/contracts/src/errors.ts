// API-020, TRV-110, TRV-064 — error codes shared by the API and the applications.
// The API never sends screen text (API-002): applications translate these codes.

export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_CODE: 'INVALID_CODE',
  GATE_PASSWORD_INVALID: 'GATE_PASSWORD_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  GATE_CLOSED: 'GATE_CLOSED',
  CHALLENGE_REQUIRED: 'CHALLENGE_REQUIRED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT_VERSION: 'CONFLICT_VERSION',
  CONFLICT_STATE: 'CONFLICT_STATE',
  DUPLICATE: 'DUPLICATE',
  REQUEST_IN_PROGRESS: 'REQUEST_IN_PROGRESS',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  GONE: 'GONE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  MAINTENANCE: 'MAINTENANCE',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** HTTP status of each code (TRV-110). */
export const ErrorStatus: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_CODE: 401,
  GATE_PASSWORD_INVALID: 401,
  FORBIDDEN: 403,
  ACCOUNT_SUSPENDED: 403,
  GATE_CLOSED: 403,
  CHALLENGE_REQUIRED: 403,
  NOT_FOUND: 404,
  CONFLICT_VERSION: 409,
  CONFLICT_STATE: 409,
  DUPLICATE: 409,
  REQUEST_IN_PROGRESS: 409,
  IDEMPOTENCY_KEY_REUSED: 422,
  GONE: 410,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  VALIDATION_ERROR: 422,
  ACCOUNT_LOCKED: 423,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  MAINTENANCE: 503,
};

/** Field-level validation codes (TRV-064). */
export const FieldErrorCode = {
  REQUIRED: 'REQUIRED',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PHONE: 'INVALID_PHONE',
  TOO_LONG: 'TOO_LONG',
  TOO_SHORT: 'TOO_SHORT',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  AMOUNT_TOO_HIGH: 'AMOUNT_TOO_HIGH',
  NOT_A_NUMBER: 'NOT_A_NUMBER',
  INVALID_DATE: 'INVALID_DATE',
  DATE_NOT_FUTURE: 'DATE_NOT_FUTURE',
  DATE_IN_FUTURE: 'DATE_IN_FUTURE',
  /** SEC-095 — a birth date that gives less than 18 years. */
  UNDER_AGE: 'UNDER_AGE',
  MUST_ACCEPT: 'MUST_ACCEPT',
  ALREADY_USED: 'ALREADY_USED',
  INVALID_CHOICE: 'INVALID_CHOICE',
  CHECKSUM_MISMATCH: 'CHECKSUM_MISMATCH',
  FILE_UNREADABLE: 'FILE_UNREADABLE',
  FILE_PASSWORD_PROTECTED: 'FILE_PASSWORD_PROTECTED',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  MISSING_CONDITION: 'MISSING_CONDITION',
  /** TRV-042 — a name with characters other than letters, spaces, hyphens, apostrophes, dots (code of 02-site-public/05). */
  INVALID_NAME: 'INVALID_NAME',
} as const;
export type FieldErrorCode = (typeof FieldErrorCode)[keyof typeof FieldErrorCode] | (string & {});

export interface ApiErrorDetail {
  field: string;
  code: FieldErrorCode;
  params?: Record<string, string | number> | null;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    reason: string | null;
    params: Record<string, unknown> | null;
    details: ApiErrorDetail[];
    requestId: string;
  };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: { code?: unknown } }).error?.code === 'string'
  );
}
