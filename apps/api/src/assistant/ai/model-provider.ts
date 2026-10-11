// ASS-052, ENV-040 — the model of the conversational assistant from the environment: `AI_PROVIDER`, `AI_API_KEY`,
// `AI_MODEL`. The provider must be named explicitly; without it (or without a key) there is no model and the assistant
// stays guided. With `anthropic`, the key may also be `ANTHROPIC_API_KEY`.
import type { Env } from '../../config/env.js';
import { AnthropicAssistantModel, DEFAULT_ANTHROPIC_MODEL } from './anthropic-model.js';
import type { AssistantModel } from './assistant-model.js';

export function assistantModelFromEnv(env: Pick<Env, 'AI_PROVIDER' | 'AI_API_KEY' | 'ANTHROPIC_API_KEY' | 'AI_MODEL'>): AssistantModel | null {
  if (env.AI_PROVIDER === 'anthropic') {
    const key = env.AI_API_KEY ?? env.ANTHROPIC_API_KEY;
    if (!key) return null;
    return new AnthropicAssistantModel(key, env.AI_MODEL ?? DEFAULT_ANTHROPIC_MODEL);
  }
  return null;
}
