/**
 * OpenAI-specific tool call adapter
 * Translates between agent-level types and OpenAI API format
 */

import type OpenAI from 'openai';

import type { AgentToolCall, TokenUsage } from '../types.js';
import type { ToolCallAdapter } from './types.js';

type OpenAITool = OpenAI.Chat.Completions.ChatCompletionTool;
type OpenAICompletion = OpenAI.Chat.Completions.ChatCompletion;
type ToolInput = { name: string; description: string; inputSchema: Record<string, unknown> };
type ToolResultInput = { toolCallId: string; content: string };

export class OpenAIToolAdapter implements ToolCallAdapter {
  formatTools(tools: ReadonlyArray<ToolInput>): OpenAITool[] {
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
    const completion = response as OpenAICompletion;
    const toolCalls = completion.choices[0]?.message?.tool_calls;
    if (!toolCalls) return [];
    return toolCalls
      .filter((tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & { type: 'function' } =>
        tc.type === 'function')
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

  formatToolResults(results: ReadonlyArray<ToolResultInput>): OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] {
    return results.map((r) => ({
      role: 'tool' as const,
      tool_call_id: r.toolCallId,
      content: r.content,
    }));
  }

  isToolCallResponse(response: unknown): boolean {
    const completion = response as OpenAICompletion;
    return completion.choices[0]?.finish_reason === 'tool_calls';
  }

  extractTextContent(response: unknown): string {
    const completion = response as OpenAICompletion;
    return completion.choices[0]?.message?.content ?? '';
  }

  extractTokenUsage(response: unknown): TokenUsage {
    const completion = response as OpenAICompletion;
    return {
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  }
}
