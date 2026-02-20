/**
 * Chat session state management hook
 * Manages chat messages, API message history, agent state, and overlay panels
 */
import type { AgentMessage } from '../agent/types.js';
import type { SlashCommand } from '../commands/types.js';
import type {
  AssistantMessage,
  ChatAction,
  ChatMessage,
  ChatStore,
  PendingPermission,
} from '../types/chat.js';
import type { ConfigSection } from '../commands/types.js';

import { useCallback, useReducer } from 'react';
import { MAX_API_MESSAGES, MAX_UI_MESSAGES } from '../constants.js';

function createInitialStore(): ChatStore {
  return {
    messages: [],
    apiMessages: [],
    streamingText: '',
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
        text: '',
        toolCalls: [],
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
      return {
        ...state,
        streamingText: state.streamingText + action.text,
      };
    }

    case 'AGENT_TOOL_START': {
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          toolCalls: [
            ...msg.toolCalls,
            {
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
          toolCalls: msg.toolCalls.map((tc) =>
            tc.id === action.toolCallId
              ? {
                  ...tc,
                  status: action.result.kind === 'success'
                    ? 'success' as const
                    : action.result.kind === 'denied'
                      ? 'denied' as const
                      : 'error' as const,
                  result: truncatedResult,
                }
              : tc,
          ),
        })),
      };
    }

    case 'AGENT_DONE': {
      // Build the assistant API message from the completed turn
      const lastAssistant = getLastAssistant(state.messages);
      const mergedText = (lastAssistant?.text ?? '') + state.streamingText;
      const finalText = mergedText || action.text;

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

      // Add tool results from the completed message
      if (lastAssistant && lastAssistant.toolCalls.length > 0) {
        for (const tc of lastAssistant.toolCalls) {
          const kind = tc.status === 'success' ? 'success' : tc.status === 'denied' ? 'denied' : 'error';
          const resultObj = kind === 'success'
            ? { kind: 'success' as const, output: tc.result ?? '' }
            : kind === 'denied'
              ? { kind: 'denied' as const, reason: tc.result ?? 'Denied' }
              : { kind: 'error' as const, error: tc.result ?? 'Error' };
          newApiMessages.push({
            role: 'tool_result',
            toolCallId: tc.id,
            name: tc.name,
            result: resultObj,
          });
        }
      }

      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          isStreaming: false,
          text: finalText,
        })),
        apiMessages: trimApiMessages(newApiMessages, MAX_API_MESSAGES),
        streamingText: '',
        isAgentRunning: false,
        pendingPermission: null,
      };
    }

    case 'AGENT_ERROR': {
      const errorText = (getLastAssistant(state.messages)?.text ?? '') + state.streamingText;
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          isStreaming: false,
          text: errorText || `Error: ${action.error}`,
        })),
        streamingText: '',
        isAgentRunning: false,
        pendingPermission: null,
      };
    }

    case 'AGENT_ABORT': {
      const abortText = (getLastAssistant(state.messages)?.text ?? '') + state.streamingText;
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          isStreaming: false,
          text: abortText || '(aborted)',
        })),
        streamingText: '',
        isAgentRunning: false,
        pendingPermission: null,
      };
    }

    case 'FLUSH_STREAMING': {
      if (!state.streamingText) return state;
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          text: msg.text + state.streamingText,
        })),
        streamingText: '',
      };
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
