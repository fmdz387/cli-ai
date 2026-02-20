/**
 * OpenRouter-specific tool call adapter
 * Delegates to OpenAI adapter since OpenRouter uses OpenAI-compatible format
 */

import type { AgentToolCall, TokenUsage } from '../types.js';
import { OpenAIToolAdapter } from './openai-adapter.js';
import type { ToolCallAdapter } from './types.js';

type ToolInput = { name: string; description: string; inputSchema: Record<string, unknown> };
type ToolResultInput = { toolCallId: string; content: string };

const openaiAdapter = new OpenAIToolAdapter();

export class OpenRouterToolAdapter implements ToolCallAdapter {
  formatTools(tools: ReadonlyArray<ToolInput>): unknown {
    return openaiAdapter.formatTools(tools);
  }

  parseToolCalls(response: unknown): AgentToolCall[] {
    return openaiAdapter.parseToolCalls(response);
  }

  formatToolResults(results: ReadonlyArray<ToolResultInput>): unknown {
    return openaiAdapter.formatToolResults(results);
  }

  isToolCallResponse(response: unknown): boolean {
    return openaiAdapter.isToolCallResponse(response);
  }

  extractTextContent(response: unknown): string {
    return openaiAdapter.extractTextContent(response);
  }

  extractTokenUsage(response: unknown): TokenUsage {
    return openaiAdapter.extractTokenUsage(response);
  }
}
