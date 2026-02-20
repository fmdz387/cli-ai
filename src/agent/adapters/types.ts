/**
 * Provider-agnostic adapter interface for tool calling
 */

import type { AgentToolCall, TokenUsage } from '../types.js';

/**
 * Adapter that translates between agent-level tool types
 * and provider-specific API formats
 */
export interface ToolCallAdapter {
  formatTools(tools: ReadonlyArray<{ name: string; description: string; inputSchema: Record<string, unknown> }>,): unknown;
  parseToolCalls(response: unknown): AgentToolCall[];
  formatToolResults(
    results: ReadonlyArray<{ toolCallId: string; content: string }>,
  ): unknown;
  isToolCallResponse(response: unknown): boolean;
  extractTextContent(response: unknown): string;
  extractTokenUsage(response: unknown): TokenUsage;
}
