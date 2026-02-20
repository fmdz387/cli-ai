/**
 * Chat message types for the conversational UI
 */
import type { AgentMessage, AgentToolCall, CumulativeUsage } from '../agent/types.js';
import type { ToolCallStatusType } from '../components/Agent/ToolCallStatus.js';
import type { ToolResult } from '../tools/types.js';
import type { AgentToolCallInfo } from './index.js';
import type { ConfigSection, SlashCommand } from '../commands/types.js';

/**
 * A tool call entry displayed inline in an assistant message
 */
export interface ToolCallEntry {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: ToolCallStatusType;
  result?: string;
}

/**
 * User message in the chat
 */
export interface UserMessage {
  role: 'user';
  text: string;
  timestamp: number;
}

/**
 * Assistant message in the chat (may be streaming)
 */
export interface AssistantMessage {
  role: 'assistant';
  text: string;
  toolCalls: ToolCallEntry[];
  isStreaming: boolean;
  timestamp: number;
}

/**
 * System message (e.g., errors, status)
 */
export interface SystemMessage {
  role: 'system';
  text: string;
  timestamp: number;
}

/**
 * Union of all chat message types
 */
export type ChatMessage = UserMessage | AssistantMessage | SystemMessage;

/**
 * Pending permission state for tool calls
 */
export interface PendingPermission {
  toolCall: AgentToolCallInfo;
  messageIndex: number;
}

/**
 * Overlay panel state (only one can be open at a time)
 */
export type OverlayState =
  | { type: 'none' }
  | { type: 'palette'; query: string; filteredCommands: SlashCommand[] }
  | { type: 'config'; section: ConfigSection }
  | { type: 'help' };

/**
 * Chat store state
 */
export interface ChatStore {
  messages: ChatMessage[];
  apiMessages: AgentMessage[];
  streamingText: string;
  isAgentRunning: boolean;
  isCompacting: boolean;
  pendingPermission: PendingPermission | null;
  cumulativeUsage: CumulativeUsage;
  overlay: OverlayState;
  isSetup: boolean;
}

/**
 * Chat reducer actions
 */
export type ChatAction =
  | { type: 'USER_MESSAGE'; text: string }
  | { type: 'AGENT_TEXT_DELTA'; text: string }
  | { type: 'AGENT_TOOL_START'; toolCall: AgentToolCall }
  | { type: 'AGENT_TOOL_RESULT'; toolCallId: string; result: ToolResult }
  | { type: 'AGENT_DONE'; text: string; toolCalls?: AgentToolCall[] }
  | { type: 'AGENT_ERROR'; error: string }
  | { type: 'AGENT_ABORT' }
  | { type: 'FLUSH_STREAMING' }
  | { type: 'SET_PENDING_PERMISSION'; permission: PendingPermission | null }
  | { type: 'CLEAR_CONVERSATION' }
  | { type: 'COMPACT_START' }
  | { type: 'COMPACT_DONE'; summary: string; compactedApiMessages: AgentMessage[] }
  | { type: 'COMPACT_ERROR'; error: string }
  | { type: 'SETUP_COMPLETE' }
  | { type: 'OPEN_PALETTE' }
  | { type: 'UPDATE_PALETTE'; query: string; filteredCommands: SlashCommand[] }
  | { type: 'CLOSE_PALETTE' }
  | { type: 'OPEN_CONFIG' }
  | { type: 'UPDATE_CONFIG_SECTION'; section: ConfigSection }
  | { type: 'CLOSE_CONFIG' }
  | { type: 'OPEN_HELP' }
  | { type: 'CLOSE_HELP' };
