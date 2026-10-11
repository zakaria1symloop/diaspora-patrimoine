// AUT-020, AUT-021 — evaluation of the conditions of a rule on the current state of the objects. Pure: the values of
// the cited fields are read beforehand (rule-context.ts) and handed over. A field without value makes its comparison
// false, except when the comparison is about its absence (`isNull`).
import type { Comparison, ConditionGroup, ConditionNode } from './rule-definition.js';

export type FieldReader = (field: string) => unknown;

const missing = (v: unknown): boolean => v === null || v === undefined || v === '';

/** Dates compare by instant, whatever their form (a `Date` read from the base, an ISO 8601 literal in the rule). */
function comparable(v: unknown): unknown {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'bigint') return Number(v);
  if (v !== null && typeof v === 'object' && 'toFixed' in v) return Number(String(v)); // Decimal
  return v;
}

function same(a: unknown, b: unknown): boolean {
  const x = comparable(a);
  const y = comparable(b);
  if (typeof x === 'number' && typeof y === 'string') {
    // A date field against its ISO literal, or a number against a numeric literal.
    const asDate = /^\d{4}-\d{2}-\d{2}/.test(y) ? Date.parse(y) : Number(y);
    return x === asDate;
  }
  return x === y;
}

function order(a: unknown, b: unknown): number | null {
  const x = comparable(a);
  let y = comparable(b);
  if (typeof x === 'number' && typeof y === 'string') y = Date.parse(y);
  if (typeof x === 'string' && typeof y === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x) && /^\d{4}-\d{2}-\d{2}/.test(y)) return Date.parse(x) - Date.parse(y);
  if (typeof x !== 'number' || typeof y !== 'number' || Number.isNaN(x) || Number.isNaN(y)) return null;
  return x - y;
}

export function evaluateComparison(c: Comparison, read: FieldReader): boolean {
  const actual = read(c.field);
  if (c.op === 'isNull') return missing(actual);
  if (missing(actual)) return false;
  switch (c.op) {
    case 'isNotNull':
      return true;
    case 'eq':
      return same(actual, c.value);
    case 'neq':
      return !same(actual, c.value);
    case 'in':
      return Array.isArray(c.value) && c.value.some((v) => same(actual, v));
    case 'nin':
      return Array.isArray(c.value) && !c.value.some((v) => same(actual, v));
    case 'contains':
      return Array.isArray(actual) && actual.some((v) => same(v, c.value));
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const d = order(actual, c.value);
      if (d === null) return false;
      return c.op === 'gt' ? d > 0 : c.op === 'gte' ? d >= 0 : c.op === 'lt' ? d < 0 : d <= 0;
    }
  }
}

function evaluateNode(node: ConditionNode, read: FieldReader): boolean {
  if ('field' in node) return evaluateComparison(node, read);
  return 'all' in node ? node.all.every((n) => evaluateNode(n, read)) : node.any.some((n) => evaluateNode(n, read));
}

/** A rule without conditions always applies. */
export function evaluateConditions(conditions: ConditionGroup | null, read: FieldReader): boolean {
  return conditions ? evaluateNode(conditions, read) : true;
}
