// ARC-030, TRV-064 — the shared schema validates the request; issues become field codes.
import { FieldErrorCode, type ApiErrorDetail } from '@dp/contracts';
import type { z } from 'zod';
import { AppError } from './errors.js';

const known = new Set<string>(Object.values(FieldErrorCode));

function toCode(issue: z.core.$ZodIssue): ApiErrorDetail['code'] {
  if (known.has(issue.message)) return issue.message;
  switch (issue.code) {
    case 'too_big':
      return issue.origin === 'string' ? FieldErrorCode.TOO_LONG : FieldErrorCode.OUT_OF_RANGE;
    case 'too_small':
      if (issue.origin === 'string') return issue.minimum === 1 ? FieldErrorCode.REQUIRED : FieldErrorCode.TOO_SHORT;
      return FieldErrorCode.OUT_OF_RANGE;
    case 'invalid_format':
      return issue.format === 'email' ? FieldErrorCode.INVALID_EMAIL : FieldErrorCode.INVALID_CHOICE;
    case 'invalid_value':
      return FieldErrorCode.INVALID_CHOICE;
    case 'invalid_type':
      return issue.input === undefined || issue.input === null ? FieldErrorCode.REQUIRED : FieldErrorCode.INVALID_CHOICE;
    default:
      return FieldErrorCode.INVALID_CHOICE;
  }
}

function paramsOf(issue: z.core.$ZodIssue): Record<string, string | number> | null {
  if (issue.code === 'too_big') return { n: Number(issue.maximum), max: Number(issue.maximum) };
  if (issue.code === 'too_small') return { n: Number(issue.minimum), min: Number(issue.minimum) };
  return null;
}

export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const details: ApiErrorDetail[] = result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    code: toCode(issue),
    params: paramsOf(issue),
  }));
  throw AppError.validation(details);
}
