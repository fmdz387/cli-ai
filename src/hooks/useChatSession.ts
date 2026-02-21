/**
 * Chat session state management hook
 * Manages chat messages, API message history, agent state, and overlay panels.
 * Uses parts-based architecture for interleaved text/tool rendering.
 */
import type { AgentMessage } from '../agent/types.js';
import type { SlashCommand } from '../commands/types.js';
import type {
  AssistantMessage,
  ChatAction,
  ChatMessage,
  ChatStore,
  ContentPart,
} from '../types/chat.js';
import type { ConfigSection } from '../commands/types.js';

import { useCallback, useReducer } from 'react';
import { MAX_API_MESSAGES, MAX_UI_MESSAGES } from '../constants.js';

function createInitialStore(): ChatStore {
  return {
    messages: [],
    apiMessages: [],
    isAgentRunning: false,
    isCompacting: false,
    pendingPermission: null,
    cumulativeUsage: { totalInputTokens: 0, totalOutputTokens: 0, turns: 0 },
    overlay: { type: 'none' },
    isSetup: false,
  };
}

function getLastAssistant(messages: ChatMessage[]): AssistantMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'assistant') return messages[i] as AssistantMessage;
  }
  return null;
}

function updateLastAssistant(
  messages: ChatMessage[],
  updater: (msg: AssistantMessage) => AssistantMessage,
): ChatMessage[] {
  const result = [...messages];
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i]!.role === 'assistant') {
      result[i] = updater(result[i] as AssistantMessage);
      break;
    }
  }
  return result;
}

/** Extract all text from parts, joined together */
function getTextFromParts(parts: ContentPart[]): string {
  return parts
    .filter((p): p is ContentPart & { type: 'text' } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

/** Extract tool parts from parts array */
function getToolPartsFromParts(parts: ContentPart[]): Array<ContentPart & { type: 'tool' }> {
  return parts.filter((p): p is ContentPart & { type: 'tool' } => p.type === 'tool');
}

function toolResultToString(result: { kind: string; output?: string; error?: string; reason?: string }): string {
  if (result.kind === 'success') return result.output ?? '';
  if (result.kind === 'error') return result.error ?? 'Error';
  if (result.kind === 'denied') return result.reason ?? 'Denied';
  return '';
}

/**
 * Trim API messages to keep last maxCount entries.
 * Preserves the system message at index 0 if present.
 * Trims at a clean exchange boundary (start of a user message).
 */
function trimApiMessages(messages: AgentMessage[], maxCount: number): AgentMessage[] {
  if (messages.length <= maxCount) return messages;

  const hasSystem = messages.length > 0 && messages[0]!.role === 'system';
  const systemMsg = hasSystem ? messages[0]! : null;
  const rest = hasSystem ? messages.slice(1) : messages;

  const budget = systemMsg ? maxCount - 1 : maxCount;
  let startIndex = rest.length - budget;

  // Walk forward to find the start of a user message (clean exchange boundary)
  while (startIndex < rest.length && rest[startIndex]!.role !== 'user') {
    startIndex++;
  }

  const trimmed = rest.slice(startIndex);
  return systemMsg ? [systemMsg, ...trimmed] : trimmed;
}

/**
 * Append text to the last text part, or add a new text part.
 * This enables interleaving: text before tools stays as a separate part,
 * and new text after tools creates a new text part.
 */
function appendTextToParts(parts: ContentPart[], text: string): ContentPart[] {
  const lastPart = parts[parts.length - 1];
  if (lastPart && lastPart.type === 'text') {
    const updated = [...parts];
    updated[updated.length - 1] = { ...lastPart, text: lastPart.text + text };
    return updated;
  }
  return [...parts, { type: 'text' as const, text }];
}

function chatReducer(state: ChatStore, action: ChatAction): ChatStore {
  switch (action.type) {
    case 'USER_MESSAGE': {
      const userMsg: ChatMessage = {
        role: 'user',
        text: action.text,
        timestamp: Date.now(),
      };
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        parts: [],
        isStreaming: true,
        timestamp: Date.now(),
      };
      const allMessages = [...state.messages, userMsg, assistantMsg];
      const trimmedMessages = allMessages.length > MAX_UI_MESSAGES
        ? allMessages.slice(-MAX_UI_MESSAGES)
        : allMessages;
      return {
        ...state,
        messages: trimmedMessages,
        isAgentRunning: true,
        pendingPermission: null,
      };
    }

    case 'AGENT_TEXT_DELTA': {
      // Append text to the current text part, or start a new one.
      // If the last part is a tool part, a new text part is created,
      // naturally interleaving text between tool executions.
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          parts: appendTextToParts(msg.parts, action.text),
        })),
      };
    }

    case 'AGENT_TOOL_START': {
      // Add a tool part. If text was emitted before this tool call,
      // it's already in a text part, preserving the interleaved order.
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          parts: [
            ...msg.parts,
            {
              type: 'tool' as const,
              id: action.toolCall.id,
              name: action.toolCall.name,
              input: action.toolCall.input,
              status: 'running' as const,
            },
          ],
        })),
      };
    }

    case 'AGENT_TOOL_RESULT': {
      const fullResult = toolResultToString(action.result);
      const truncatedResult = fullResult.length > 200
        ? fullResult.slice(0, 200) + '...'
        : fullResult;
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          parts: msg.parts.map((part) =>
            part.type === 'tool' && part.id === action.toolCallId
              ? {
                  ...part,
                  status: action.result.kind === 'success'
                    ? 'success' as const
                    : action.result.kind === 'denied'
                      ? 'denied' as const
                      : 'error' as const,
                  result: truncatedResult,
                }
              : part,
          ),
        })),
      };
    }

    case 'AGENT_DONE': {
      const lastAssistant = getLastAssistant(state.messages);
      const partsText = lastAssistant ? getTextFromParts(lastAssistant.parts) : '';
      const finalText = partsText || action.text;

      const newApiMessages: AgentMessage[] = [...state.apiMessages];

      // Add the user message that started this turn
      const lastUserMsg = [...state.messages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        newApiMessages.push({ role: 'user', content: lastUserMsg.text });
      }

      // Add assistant response
      if (finalText || (action.toolCalls && action.toolCalls.length > 0)) {
        newApiMessages.push({
          role: 'assistant',
          content: finalText,
          toolCalls: action.toolCalls,
        });
      }

      // Add tool results from the completed message parts
      if (lastAssistant) {
        const toolParts = getToolPartsFromParts(lastAssistant.parts);
        for (const tp of toolParts) {
          const kind = tp.status === 'success' ? 'success' : tp.status === 'denied' ? 'denied' : 'error';
          const resultObj = kind === 'success'
            ? { kind: 'success' as const, output: tp.result ?? '' }
            : kind === 'denied'
              ? { kind: 'denied' as const, reason: tp.result ?? 'Denied' }
              : { kind: 'error' as const, error: tp.result ?? 'Error' };
          newApiMessages.push({
            role: 'tool_result',
            toolCallId: tp.id,
            name: tp.name,
            result: resultObj,
          });
        }
      }

      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => {
          // If parts have no text but action.text exists, add a final text part
          const hasText = msg.parts.some((p) => p.type === 'text' && p.text);
          const parts = !hasText && action.text
            ? appendTextToParts(msg.parts, action.text)
            : msg.parts;
          return { ...msg, isStreaming: false, parts };
        }),
        apiMessages: trimApiMessages(newApiMessages, MAX_API_MESSAGES),
        isAgentRunning: false,
        pendingPermission: null,
      };
    }

    case 'AGENT_ERROR': {
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => {
          const hasText = msg.parts.some((p) => p.type === 'text' && p.text);
          const parts = hasText
            ? msg.parts
            : appendTextToParts(msg.parts, `Error: ${action.error}`);
          return { ...msg, isStreaming: false, parts };
        }),
        isAgentRunning: false,
        pendingPermission: null,
      };
    }

    case 'AGENT_ABORT': {
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => {
          const hasText = msg.parts.some((p) => p.type === 'text' && p.text);
          const parts = hasText
            ? msg.parts
            : appendTextToParts(msg.parts, '(aborted)');
          return { ...msg, isStreaming: false, parts };
        }),
        isAgentRunning: false,
        pendingPermission: null,
      };
    }

    case 'FLUSH_STREAMING': {
      // No-op: text is now stored directly in parts, no buffer to flush
      return state;
    }

    case 'SET_PENDING_PERMISSION': {
      return {
        ...state,
        pendingPermission: action.permission,
      };
    }

    case 'CLEAR_CONVERSATION': {
      return {
        ...state,
        messages: [],
        apiMessages: [],
        cumulativeUsage: { totalInputTokens: 0, totalOutputTokens: 0, turns: 0 },
      };
    }

    case 'COMPACT_START': {
      const compactingMsg: ChatMessage = {
        role: 'system',
        text: 'Compacting conversation...',
        timestamp: Date.now(),
      };
      return {
        ...state,
        isCompacting: true,
        messages: [...state.messages, compactingMsg],
      };
    }

    case 'COMPACT_DONE': {
      // Replace display messages with a single system summary message
      const summaryMsg: ChatMessage = {
        role: 'system',
        text: `[Conversation compacted]\n\n${action.summary}`,
        timestamp: Date.now(),
      };
      return {
        ...state,
        isCompacting: false,
        messages: [summaryMsg],
        apiMessages: action.compactedApiMessages,
      };
    }

    case 'COMPACT_ERROR': {
      // Remove the "Compacting..." message and show error
      const errorMsg: ChatMessage = {
        role: 'system',
        text: `Compaction failed: ${action.error}`,
        timestamp: Date.now(),
      };
      // Remove the "Compacting conversation..." system message if it's the last one
      const cleaned = state.messages.filter(
        (m) => !(m.role === 'system' && m.text === 'Compacting conversation...'),
      );
      return {
        ...state,
        isCompacting: false,
        messages: [...cleaned, errorMsg],
      };
    }

    case 'SETUP_COMPLETE': {
      return { ...state, isSetup: true };
    }

    // Overlay actions
    case 'OPEN_PALETTE': {
      return {
        ...state,
        overlay: { type: 'palette', query: '', filteredCommands: [] },
      };
    }

    case 'UPDATE_PALETTE': {
      return {
        ...state,
        overlay: { type: 'palette', query: action.query, filteredCommands: action.filteredCommands },
      };
    }

    case 'CLOSE_PALETTE': {
      return { ...state, overlay: { type: 'none' } };
    }

    case 'OPEN_CONFIG': {
      return { ...state, overlay: { type: 'config', section: 'provider' } };
    }

    case 'UPDATE_CONFIG_SECTION': {
      if (state.overlay.type !== 'config') return state;
      return { ...state, overlay: { type: 'config', section: action.section } };
    }

    case 'CLOSE_CONFIG': {
      return { ...state, overlay: { type: 'none' } };
    }

    case 'OPEN_HELP': {
      return { ...state, overlay: { type: 'help' } };
    }

    case 'CLOSE_HELP': {
      return { ...state, overlay: { type: 'none' } };
    }

    default:
      return state;
  }
}

export interface UseChatSessionReturn {
  store: ChatStore;
  dispatch: React.Dispatch<ChatAction>;
  // Convenience methods
  sendMessage: (text: string) => void;
  clearConversation: () => void;
  startCompact: () => void;
  completeSetup: () => void;
  openPalette: () => void;
  updatePalette: (query: string, filteredCommands: SlashCommand[]) => void;
  closePalette: () => void;
  openConfig: () => void;
  updateConfigSection: (section: ConfigSection) => void;
  closeConfig: () => void;
  openHelp: () => void;
  closeHelp: () => void;
}

export function useChatSession(): UseChatSessionReturn {
  const [store, dispatch] = useReducer(chatReducer, undefined, createInitialStore);

  const sendMessage = useCallback((text: string) => {
    dispatch({ type: 'USER_MESSAGE', text });
  }, []);

  const clearConversation = useCallback(() => {
    dispatch({ type: 'CLEAR_CONVERSATION' });
  }, []);

  const startCompact = useCallback(() => {
    dispatch({ type: 'COMPACT_START' });
  }, []);

  const completeSetup = useCallback(() => {
    dispatch({ type: 'SETUP_COMPLETE' });
  }, []);

  const openPalette = useCallback(() => {
    dispatch({ type: 'OPEN_PALETTE' });
  }, []);

  const updatePalette = useCallback((query: string, filteredCommands: SlashCommand[]) => {
    dispatch({ type: 'UPDATE_PALETTE', query, filteredCommands });
  }, []);

  const closePalette = useCallback(() => {
    dispatch({ type: 'CLOSE_PALETTE' });
  }, []);

  const openConfig = useCallback(() => {
    dispatch({ type: 'OPEN_CONFIG' });
  }, []);

  const updateConfigSection = useCallback((section: ConfigSection) => {
    dispatch({ type: 'UPDATE_CONFIG_SECTION', section });
  }, []);

  const closeConfig = useCallback(() => {
    dispatch({ type: 'CLOSE_CONFIG' });
  }, []);

  const openHelp = useCallback(() => {
    dispatch({ type: 'OPEN_HELP' });
  }, []);

  const closeHelp = useCallback(() => {
    dispatch({ type: 'CLOSE_HELP' });
  }, []);

  return {
    store,
    dispatch,
    sendMessage,
    clearConversation,
    startCompact,
    completeSetup,
    openPalette,
    updatePalette,
    closePalette,
    openConfig,
    updateConfigSection,
    closeConfig,
    openHelp,
    closeHelp,
  };
}
