/**
 * Anthropic-specific tool call adapter
 * Translates between agent-level types and Anthropic API format
 */

import type Anthropic from '@anthropic-ai/sdk';

import type { AgentToolCall, TokenUsage } from '../types.js';
import type { ToolCallAdapter } from './types.js';

type AnthropicTool = Anthropic.Messages.Tool;
type AnthropicMessage = Anthropic.Messages.Message;
type ToolInput = { name: string; description: string; inputSchema: Record<string, unknown> };
type ToolResultInput = { toolCallId: string; content: string };

export class AnthropicToolAdapter implements ToolCallAdapter {
  formatTools(tools: ReadonlyArray<ToolInput>): AnthropicTool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        ...tool.inputSchema,
      },
    }));
  }

  parseToolCalls(response: unknown): AgentToolCall[] {
    const msg = response as AnthropicMessage;
    return msg.content
      .filter((block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use')
      .map((block) => ({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      }));
  }

  formatToolResults(results: ReadonlyArray<ToolResultInput>): Anthropic.Messages.ToolResultBlockParam[] {
    return results.map((r) => ({
      type: 'tool_result' as const,
      tool_use_id: r.toolCallId,
      content: r.content,
    }));
  }

  isToolCallResponse(response: unknown): boolean {
    const msg = response as AnthropicMessage;
    return msg.stop_reason === 'tool_use';
  }

  extractTextContent(response: unknown): string {
    const msg = response as AnthropicMessage;
    return msg.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }

  extractTokenUsage(response: unknown): TokenUsage {
    const msg = response as AnthropicMessage;
    return {
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
    };
  }
}
