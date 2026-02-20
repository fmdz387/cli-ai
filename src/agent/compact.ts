/**
 * LLM-based conversation compaction
 * Summarizes conversation history into a structured summary using the AI provider
 */

import type { AgentMessage } from './types.js';
import type { Provider } from '../lib/providers/types.js';

const COMPACTION_PROMPT = `Write a structured summary of this conversation so a follow-up session can pick up where this one left off.

Use the following sections (omit any that have no content):

**Objective** — The user's end goal in one sentence.
**Constraints** — Preferences, rules, or limits the user set.
**Done** — Steps or changes already completed.
**Current** — Work that was in progress when the conversation ended.
**Files touched** — Paths that were read, created, or edited, with a short note per file.
**Open items** — Tasks or questions that remain.
**Design choices** — Non-obvious decisions and the reasoning behind them.

Output only the summary. Ignore any unanswered questions in the conversation.`;

export interface CompactResult {
  summary: string;
  originalMessageCount: number;
}

/**
 * Compact a conversation by summarizing it via an LLM call.
 * Returns the summary text to be used as the new conversation context.
 */
export async function compactConversation(
  apiMessages: ReadonlyArray<AgentMessage>,
  provider: Provider,
  signal?: AbortSignal,
): Promise<CompactResult> {
  if (apiMessages.length < 3) {
    return {
      summary: '',
      originalMessageCount: apiMessages.length,
    };
  }

  // Build messages for the summarization call:
  // Include the full conversation, then append the compaction prompt
  const summaryMessages: AgentMessage[] = [
    ...apiMessages,
    { role: 'user', content: COMPACTION_PROMPT },
  ];

  const response = await provider.sendWithTools(summaryMessages, [], {
    maxTokens: 4096,
    signal,
  });

  // Extract text from the response - provider returns raw SDK response
  const summary = extractTextFromResponse(response);

  return {
    summary,
    originalMessageCount: apiMessages.length,
  };
}

/**
 * Build the compacted API messages from a summary.
 * Preserves the system message and creates a new context from the summary.
 */
export function buildCompactedMessages(
  originalMessages: ReadonlyArray<AgentMessage>,
  summary: string,
): AgentMessage[] {
  const result: AgentMessage[] = [];

  // Preserve the system message
  const systemMsg = originalMessages.find((m) => m.role === 'system');
  if (systemMsg) {
    result.push(systemMsg);
  }

  // Add the summary as a user message providing context
  result.push({
    role: 'user',
    content: `[Conversation compacted — summary of prior conversation follows]\n\n${summary}`,
  });

  // Add an assistant acknowledgment so the conversation is in a valid state
  result.push({
    role: 'assistant',
    content: 'Understood. I have the context from the previous conversation. How can I help you continue?',
  });

  return result;
}

function extractTextFromResponse(response: unknown): string {
  // Handle Anthropic SDK response shape
  if (response !== null && typeof response === 'object') {
    const resp = response as Record<string, unknown>;

    // Anthropic: response.content[].text
    if (Array.isArray(resp['content'])) {
      const parts = resp['content'] as Array<Record<string, unknown>>;
      const textParts = parts
        .filter((p) => p['type'] === 'text' && typeof p['text'] === 'string')
        .map((p) => p['text'] as string);
      if (textParts.length > 0) return textParts.join('\n');
    }

    // OpenAI: response.choices[0].message.content
    if (Array.isArray(resp['choices'])) {
      const choices = resp['choices'] as Array<Record<string, unknown>>;
      const first = choices[0];
      if (first) {
        const message = first['message'] as Record<string, unknown> | undefined;
        if (message && typeof message['content'] === 'string') {
          return message['content'];
        }
      }
    }
  }

  return String(response);
}
