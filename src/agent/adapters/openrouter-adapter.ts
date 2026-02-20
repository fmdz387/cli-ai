/**
 * OpenRouter-specific tool call adapter
 * Handles the camelCase response format from the @openrouter/sdk
 */

import type { AgentToolCall, TokenUsage } from '../types.js';
import type { ToolCallAdapter } from './types.js';

type ToolInput = { name: string; description: string; inputSchema: Record<string, unknown> };
type ToolResultInput = { toolCallId: string; content: string };

/** OpenRouter SDK response shape (camelCase) */
interface ORCompletion {
  choices: Array<{
    finishReason: string;
    finish_reason?: string;
    message: {
      content?: string | null;
      toolCalls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
  }>;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export class OpenRouterToolAdapter implements ToolCallAdapter {
  formatTools(tools: ReadonlyArray<ToolInput>): unknown {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  parseToolCalls(response: unknown): AgentToolCall[] {
    const r = response as ORCompletion;
    const msg = r.choices[0]?.message;
    const calls = msg?.toolCalls ?? msg?.tool_calls;
    if (!calls) return [];
    return calls
      .filter((tc) => tc.type === 'function')
      .map((tc) => {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          // Malformed JSON from model; fall back to empty input
        }
        return { id: tc.id, name: tc.function.name, input };
      });
  }

  formatToolResults(results: ReadonlyArray<ToolResultInput>): unknown {
    return results.map((r) => ({
      role: 'tool' as const,
      tool_call_id: r.toolCallId,
      content: r.content,
    }));
  }

  isToolCallResponse(response: unknown): boolean {
    const r = response as ORCompletion;
    const reason = r.choices[0]?.finishReason ?? r.choices[0]?.finish_reason;
    return reason === 'tool_calls';
  }

  extractTextContent(response: unknown): string {
    const r = response as ORCompletion;
    return r.choices[0]?.message?.content ?? '';
  }

  extractTokenUsage(response: unknown): TokenUsage {
    const r = response as ORCompletion;
    const u = r.usage;
    return {
      inputTokens: u?.promptTokens ?? u?.prompt_tokens ?? 0,
      outputTokens: u?.completionTokens ?? u?.completion_tokens ?? 0,
    };
  }
}
