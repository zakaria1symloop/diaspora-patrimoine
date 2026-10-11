// ASS-052 — `AssistantModel` on the Anthropic Messages API (official SDK, tool use, streaming). Nothing but the request
// built by the conversation service is sent: no identifier of the visitor (no IP, no session, no `metadata.user_id`).
import Anthropic from '@anthropic-ai/sdk';
import type { AssistantModel, ModelMessage, ModelStepRequest, ModelStepResult } from './assistant-model.js';

/** The model of ENV-040 `AI_MODEL` when it is empty. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';

function toParams(messages: ModelMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    switch (m.role) {
      case 'user':
        out.push({ role: 'user', content: m.text });
        break;
      case 'assistant':
        if (m.text.trim()) out.push({ role: 'assistant', content: m.text });
        break;
      case 'assistant_step':
        // The step's own content blocks, unchanged (thinking and tool_use blocks included).
        out.push({ role: 'assistant', content: m.raw as Anthropic.ContentBlockParam[] });
        break;
      case 'tool_results':
        // All the results of one step in a single user message.
        out.push({
          role: 'user',
          content: m.results.map((r) => ({ type: 'tool_result' as const, tool_use_id: r.id, content: r.content, ...(r.isError ? { is_error: true } : {}) })),
        });
        break;
    }
  }
  return out;
}

function stopOf(reason: Anthropic.Message['stop_reason']): ModelStepResult['stop'] {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'end';
    case 'tool_use':
      return 'tool_use';
    case 'max_tokens':
      return 'max_tokens';
    case 'refusal':
      return 'refusal';
    default:
      return 'other';
  }
}

export class AnthropicAssistantModel implements AssistantModel {
  readonly provider = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string = DEFAULT_ANTHROPIC_MODEL,
  ) {
    // The key is passed explicitly: no credential is looked up anywhere else. One retry at most (the visitor waits).
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 });
  }

  async step(request: ModelStepRequest, onText: (delta: string) => void, signal: AbortSignal): Promise<ModelStepResult> {
    const stream = this.client.messages.stream(
      {
        model: this.model,
        max_tokens: request.maxOutputTokens,
        system: [
          { type: 'text', text: request.instructions, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: request.context },
        ],
        tools: request.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema as Anthropic.Tool.InputSchema })),
        // Forced tool use is not available on current models; the instructions say when to call a tool.
        tool_choice: { type: 'auto' },
        // A short conversational answer: low effort keeps it fast and cheap.
        output_config: { effort: 'low' },
        messages: toParams(request.messages),
      },
      { signal },
    );
    stream.on('text', (delta) => onText(delta));
    const message = await stream.finalMessage();
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const toolCalls = message.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: b.input }));
    return {
      text,
      toolCalls,
      stop: stopOf(message.stop_reason),
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      },
      raw: message.content,
    };
  }
}
