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

function createInitialStore(): ChatStore {
  return {
    messages: [],
    apiMessages: [],
    isAgentRunning: false,
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
      return {
        ...state,
        messages: [...state.messages, userMsg, assistantMsg],
        isAgentRunning: true,
        pendingPermission: null,
      };
    }

    case 'AGENT_TEXT_DELTA': {
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          text: msg.text + action.text,
        })),
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
                  result: toolResultToString(action.result),
                }
              : tc,
          ),
        })),
      };
    }

    case 'AGENT_DONE': {
      // Build the assistant API message from the completed turn
      const lastAssistant = getLastAssistant(state.messages);
      const finalText = lastAssistant?.text ?? action.text;

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
        apiMessages: newApiMessages,
        isAgentRunning: false,
        pendingPermission: null,
      };
    }

    case 'AGENT_ERROR': {
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          isStreaming: false,
          text: msg.text || `Error: ${action.error}`,
        })),
        isAgentRunning: false,
        pendingPermission: null,
      };
    }

    case 'AGENT_ABORT': {
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          isStreaming: false,
          text: msg.text || '(aborted)',
        })),
        isAgentRunning: false,
        pendingPermission: null,
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
