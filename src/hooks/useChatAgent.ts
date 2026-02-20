/**
 * Agent lifecycle hook for the chat-first flow
 * Translates AgentEvents into ChatAction dispatches
 */
import type {
  AgentConfig,
  AgentEvent,
  AgentMessage,
  AgentToolCall,
  ExecutorResult,
  ExecutorRunOptions,
} from '../agent/types.js';
import type { ChatAction, PendingPermission } from '../types/chat.js';

import { useCallback, useRef } from 'react';

type RunExecutor = (options: ExecutorRunOptions) => Promise<ExecutorResult>;

interface UseChatAgentOptions {
  runExecutor: RunExecutor;
  buildConfig: () => AgentConfig;
  apiMessages: AgentMessage[];
  dispatch: React.Dispatch<ChatAction>;
}

interface UseChatAgentReturn {
  run: (text: string) => void;
  abort: () => void;
  approvePermission: () => void;
  denyPermission: () => void;
  approveForSession: () => void;
}

export function useChatAgent({
  runExecutor,
  buildConfig,
  apiMessages,
  dispatch,
}: UseChatAgentOptions): UseChatAgentReturn {
  const abortRef = useRef<AbortController | null>(null);
  const permissionResolverRef = useRef<{
    resolve: (action: 'approve' | 'deny' | 'session') => void;
  } | null>(null);
  const isRunningRef = useRef(false);
  const pendingPermissionRef = useRef<PendingPermission | null>(null);

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        case 'text_delta':
          dispatch({ type: 'AGENT_TEXT_DELTA', text: event.text });
          break;
        case 'tool_start':
          dispatch({ type: 'AGENT_TOOL_START', toolCall: event.toolCall });
          break;
        case 'tool_result':
          dispatch({ type: 'AGENT_TOOL_RESULT', toolCallId: event.toolCallId, result: event.result });
          break;
        case 'turn_complete':
          // Token usage tracked at AGENT_DONE
          break;
        case 'error':
          dispatch({ type: 'AGENT_ERROR', error: event.error.message });
          break;
        case 'aborted':
          dispatch({ type: 'AGENT_ABORT' });
          break;
        case 'doom_loop':
          dispatch({ type: 'AGENT_ERROR', error: 'Stopped: repeated identical tool call detected.' });
          break;
      }
    },
    [dispatch],
  );

  const run = useCallback(
    (text: string) => {
      if (isRunningRef.current && abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
        permissionResolverRef.current = null;
        pendingPermissionRef.current = null;
        dispatch({ type: 'SET_PENDING_PERMISSION', permission: null });
      }

      const controller = new AbortController();
      abortRef.current = controller;
      isRunningRef.current = true;
      pendingPermissionRef.current = null;

      const config = buildConfig();

      const requestPermission = (
        toolCall: AgentToolCall,
      ): Promise<'approve' | 'deny' | 'session'> => {
        return new Promise<'approve' | 'deny' | 'session'>((resolve) => {
          permissionResolverRef.current = { resolve };
          const permission: PendingPermission = {
            toolCall: {
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.input,
            },
            messageIndex: -1, // Will be relative to latest assistant message
          };
          pendingPermissionRef.current = permission;
          dispatch({ type: 'SET_PENDING_PERMISSION', permission });
        });
      };

      runExecutor({
        query: text,
        config,
        history: apiMessages.length > 0 ? apiMessages : undefined,
        signal: controller.signal,
        onEvent: handleEvent,
        requestPermission,
      })
        .then((result) => {
          isRunningRef.current = false;
          abortRef.current = null;
          pendingPermissionRef.current = null;
          dispatch({ type: 'AGENT_DONE', text: result.finalResponse });
        })
        .catch((err) => {
          isRunningRef.current = false;
          abortRef.current = null;
          pendingPermissionRef.current = null;
          if (err instanceof Error && err.name === 'AbortError') {
            dispatch({ type: 'AGENT_ABORT' });
          } else {
            dispatch({
              type: 'AGENT_ERROR',
              error: err instanceof Error ? err.message : String(err),
            });
          }
        });
    },
    [runExecutor, buildConfig, apiMessages, handleEvent, dispatch],
  );

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    isRunningRef.current = false;
    pendingPermissionRef.current = null;
    dispatch({ type: 'SET_PENDING_PERMISSION', permission: null });
  }, [dispatch]);

  const resolvePermission = useCallback(
    (action: 'approve' | 'deny' | 'session') => {
      if (permissionResolverRef.current) {
        permissionResolverRef.current.resolve(action);
        permissionResolverRef.current = null;
      }
      pendingPermissionRef.current = null;
      dispatch({ type: 'SET_PENDING_PERMISSION', permission: null });
    },
    [dispatch],
  );

  const approvePermission = useCallback(() => resolvePermission('approve'), [resolvePermission]);
  const denyPermission = useCallback(() => resolvePermission('deny'), [resolvePermission]);
  const approveForSession = useCallback(() => resolvePermission('session'), [resolvePermission]);

  return {
    run,
    abort,
    approvePermission,
    denyPermission,
    approveForSession,
  };
}
