// IA-005, `ai.assistant.monthlyBudget` — cost of the model calls, in millionths of euro. The providers price in US
// dollars per million tokens; the amount is counted one dollar for one euro, which overstates the cost (the cap is
// reached a little early, never late). An unknown model is counted at the highest known price, for the same reason.
import type { ModelUsage } from './assistant-model.js';

interface Price {
  /** Dollars per million input tokens. */
  input: number;
  /** Dollars per million output tokens. */
  output: number;
}

/** Anthropic list prices (first-party API), input / output per million tokens. Cache write 1.25×, cache read 0.1× input. */
const PRICES: Record<string, Price> = {
  'claude-fable-5-1': { input: 10, output: 50 },
  'claude-fable-5': { input: 10, output: 50 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};
const HIGHEST: Price = { input: 10, output: 50 };

export function priceOf(model: string): Price {
  return PRICES[model] ?? HIGHEST;
}

/** Cost of one step, in millionths of euro (rounded up). */
export function costMicros(model: string, usage: ModelUsage): number {
  const p = priceOf(model);
  // tokens × $/1M tokens = millionths of a dollar
  const micros = usage.inputTokens * p.input + usage.cacheWriteTokens * p.input * 1.25 + usage.cacheReadTokens * p.input * 0.1 + usage.outputTokens * p.output;
  return Math.ceil(micros);
}

/** Euros of the setting → millionths of euro. */
export function budgetMicros(euros: number): number {
  return Math.round(euros * 1_000_000);
}
