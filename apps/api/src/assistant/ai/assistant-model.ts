// ASS-052 — the language model behind the conversational assistant, as an interface: the conversation service owns the
// loop (tools run on our side, their input validated by zod), the provider only writes one step at a time. Changing
// provider is another implementation of this interface (D-055 principle, like `MailProvider`).

/** A tool the model may call: name, description, JSON Schema of its input (generated from the zod schema). */
export interface ModelTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ModelToolCall {
  id: string;
  name: string;
  /** Untrusted: validated by the caller before anything runs. */
  input: unknown;
}

export interface ModelToolResult {
  id: string;
  /** JSON text given back to the model. */
  content: string;
  isError?: boolean;
}

/**
 * The conversation as the model sees it. Earlier turns are plain texts (no tool call, no provider block): only the
 * current turn replays the provider's own content (`assistant_step`), unchanged, so the history the provider checks is
 * append-only within a turn.
 */
export type ModelMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'assistant_step'; raw: unknown }
  | { role: 'tool_results'; results: ModelToolResult[] };

export interface ModelStepRequest {
  /** Rules: identical from one request to the next (cacheable). */
  instructions: string;
  /** Catalogue vocabulary and the current criteria: changes with the catalogue and the conversation. */
  context: string;
  messages: ModelMessage[];
  tools: ModelTool[];
  maxOutputTokens: number;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export interface ModelStepResult {
  /** The text written in this step (already passed to `onText` piece by piece). */
  text: string;
  toolCalls: ModelToolCall[];
  /** `refusal`: the provider declined; `max_tokens`: cut; `other`: anything unexpected. */
  stop: 'end' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';
  usage: ModelUsage;
  /** The provider's own content of this step, replayed as `assistant_step` in the same turn. */
  raw: unknown;
}

export interface AssistantModel {
  readonly provider: string;
  readonly model: string;
  /** One model step, streamed: `onText` receives the answer as it is written. Rejects on any provider failure. */
  step(request: ModelStepRequest, onText: (delta: string) => void, signal: AbortSignal): Promise<ModelStepResult>;
}

/** Injection token: `null` when no provider is configured (ENV-040 empty → guided mode). */
export const ASSISTANT_MODEL = Symbol('ASSISTANT_MODEL');
