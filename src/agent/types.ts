/**
 * Agent system type definitions for agentic mode
 */

import type { ToolResult } from '../tools/types.js';
import type { AIProvider, SessionContext } from '../types/index.js';

/**
 * Roles for agent conversation messages
 */
export type AgentRole = 'system' | 'user' | 'assistant' | 'tool_result';

/**
 * A single message in the agent conversation
 */
export type AgentMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: AgentToolCall[] }
  | { role: 'tool_result'; toolCallId: string; name: string; result: ToolResult };

/**
 * A tool call requested by the assistant
 */
export interface AgentToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Events emitted during agentic execution
 */
export type AgentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_start'; toolCall: AgentToolCall }
  | { type: 'tool_result'; toolCallId: string; result: ToolResult }
  | { type: 'turn_complete'; usage: TokenUsage }
  | { type: 'error'; error: Error }
  | { type: 'aborted' }
  | { type: 'doom_loop'; repeatedCall: AgentToolCall };

/**
 * Token usage tracking for a single turn
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Cumulative token usage across an agent session
 */
export interface CumulativeUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  turns: number;
}

/**
 * Configuration for an agent session
 */
export interface AgentConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  maxTurns: number;
  maxTokensPerTurn: number;
  context: SessionContext;
}

/**
 * Callback for interactive permission prompts
 * Returns the user's decision when a tool requires approval
 */
export type RequestPermission = (
  toolCall: AgentToolCall,
) => Promise<'approve' | 'deny' | 'session'>;

/**
 * Options for the agent executor run method
 */
export interface ExecutorRunOptions {
  query: string;
  config: AgentConfig;
  signal: AbortSignal;
  onEvent: (event: AgentEvent) => void;
  requestPermission?: RequestPermission;
  /** Conversation history for multi-turn chat. When provided, replaces initial message building. */
  history?: AgentMessage[];
}

/**
 * Result of an agent executor run
 */
export interface ExecutorResult {
  finalResponse: string;
  usage: CumulativeUsage;
}

/**
 * Raw response from a provider's sendWithTools call
 */
export interface ProviderToolResponse {
  content: string;
  toolCalls: AgentToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
  usage: TokenUsage;
}

/**
 * Options for the provider's sendWithTools method
 */
export interface SendWithToolsOptions {
  messages: AgentMessage[];
  tools: ProviderToolSchema[];
  maxTokens: number;
}

/**
 * Provider-agnostic tool schema for registration
 */
export interface ProviderToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
