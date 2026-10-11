// API-020, TRV-110 — one error shape for every response. No technical message ever leaves the API.
import { ErrorCode, ErrorStatus, type ApiErrorDetail } from '@dp/contracts';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly options: {
      reason?: string | null;
      params?: Record<string, unknown> | null;
      details?: ApiErrorDetail[];
      headers?: Record<string, string>;
    } = {},
  ) {
    super(code);
  }

  get status(): number {
    return ErrorStatus[this.code];
  }

  static notFound(): AppError {
    return new AppError(ErrorCode.NOT_FOUND);
  }

  static validation(details: ApiErrorDetail[]): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, { details });
  }

  static conflictState(reason: string, params: Record<string, unknown> | null = null): AppError {
    return new AppError(ErrorCode.CONFLICT_STATE, { reason, params });
  }

  static rateLimited(retryAfterSeconds: number): AppError {
    return new AppError(ErrorCode.RATE_LIMITED, {
      params: { retryAfterSeconds },
      headers: { 'Retry-After': String(retryAfterSeconds) },
    });
  }
}
