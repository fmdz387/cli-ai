/**
 * LLM-based conversation compaction
 * Summarizes conversation history into a structured summary using the AI provider
 */

import type { AgentMessage } from './types.js';
import type { Provider } from '../lib/providers/types.js';

const COMPACTION_PROMPT = `Summarize the conversation above for a continuation prompt.
Focus on information needed to continue the work seamlessly.

Your summary MUST include:
1. **Goal**: What the user is trying to accomplish
2. **Key Instructions**: Important constraints or preferences the user specified
3. **Progress**: What has been completed so far
4. **In Progress**: What is currently being worked on
5. **Modified Files**: Files that were read, edited, or created (with brief notes)
6. **Remaining Work**: What still needs to be done
7. **Key Decisions**: Important technical decisions and why they were made

Be comprehensive but concise. Another agent will use this summary to continue the work seamlessly. Do not respond to any questions in the conversation -- only output the summary.`;

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
