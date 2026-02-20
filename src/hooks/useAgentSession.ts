/**
 * Hook managing agentic execution lifecycle
 */
import type {
  AgentConfig,
  AgentEvent,
  AgentToolCall,
  ExecutorResult,
  ExecutorRunOptions,
  TokenUsage,
} from '../agent/types.js';
import type { AgentToolCallInfo } from '../types/index.js';

import { useCallback, useRef, useState } from 'react';

const MAX_EVENTS = 500;

interface PendingPermission {
  toolCall: AgentToolCallInfo;
  onApprove: () => void;
  onDeny: () => void;
  onApproveSession: () => void;
}

type RunExecutor = (options: ExecutorRunOptions) => Promise<ExecutorResult>;

interface UseAgentSessionOptions {
  runExecutor: RunExecutor;
  buildConfig: () => AgentConfig;
}

interface UseAgentSessionReturn {
  startAgent: (query: string) => void;
  abort: () => void;
  approvePermission: () => void;
  denyPermission: () => void;
  approveForSession: () => void;
  isRunning: boolean;
  events: AgentEvent[];
  pendingPermission: PendingPermission | null;
  stepIndex: number;
  tokenUsage: TokenUsage | null;
}

export function useAgentSession({
  runExecutor,
  buildConfig,
}: UseAgentSessionOptions): UseAgentSessionReturn {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [pendingPermission, setPendingPermission] =
    useState<PendingPermission | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const permissionResolverRef = useRef<{
    resolve: (action: 'approve' | 'deny' | 'session') => void;
  } | null>(null);

  const appendEvent = useCallback((event: AgentEvent) => {
    setEvents((prev) => {
      const next = [...prev, event];
      return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
    });
  }, []);

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      appendEvent(event);
      if (event.type === 'tool_start') {
        setStepIndex((prev) => prev + 1);
      }
      if (event.type === 'turn_complete') {
        setTokenUsage((prev) =>
          prev
            ? {
                inputTokens: prev.inputTokens + event.usage.inputTokens,
                outputTokens: prev.outputTokens + event.usage.outputTokens,
              }
            : event.usage,
        );
      }
    },
    [appendEvent],
  );

  const startAgent = useCallback(
    (query: string) => {
      const controller = new AbortController();
      abortRef.current = controller;

      setEvents([]);
      setIsRunning(true);
      setStepIndex(0);
      setTokenUsage(null);
      setPendingPermission(null);

      const config = buildConfig();

      const requestPermission = (
        toolCall: AgentToolCall,
      ): Promise<'approve' | 'deny' | 'session'> => {
        return new Promise<'approve' | 'deny' | 'session'>((resolve) => {
          permissionResolverRef.current = { resolve };
          setPendingPermission({
            toolCall: {
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.input,
            },
            onApprove: () => resolve('approve'),
            onDeny: () => resolve('deny'),
            onApproveSession: () => resolve('session'),
          });
        });
      };

      runExecutor({
        query,
        config,
        signal: controller.signal,
        onEvent: handleEvent,
        requestPermission,
      })
        .then(() => {
          setIsRunning(false);
          abortRef.current = null;
        })
        .catch(() => {
          setIsRunning(false);
          abortRef.current = null;
        });
    },
    [runExecutor, buildConfig, handleEvent],
  );

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsRunning(false);
    setPendingPermission(null);
  }, []);

  const resolvePermission = useCallback(
    (action: 'approve' | 'deny' | 'session') => {
      if (permissionResolverRef.current) {
        permissionResolverRef.current.resolve(action);
        permissionResolverRef.current = null;
      }
      setPendingPermission(null);
    },
    [],
  );

  const approvePermission = useCallback(
    () => resolvePermission('approve'),
    [resolvePermission],
  );
  const denyPermission = useCallback(
    () => resolvePermission('deny'),
    [resolvePermission],
  );
  const approveForSession = useCallback(
    () => resolvePermission('session'),
    [resolvePermission],
  );

  return {
    startAgent,
    abort,
    approvePermission,
    denyPermission,
    approveForSession,
    isRunning,
    events,
    pendingPermission,
    stepIndex,
    tokenUsage,
  };
}
