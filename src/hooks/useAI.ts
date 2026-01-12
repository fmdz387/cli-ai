/**
 * React hook for AI command generation
 */

import { useCallback, useRef, useState } from 'react';

import type { CommandProposal, HistoryEntry, Result, ShellType } from '../types/index.js';
import {
  createSessionContext,
  explainCommand,
  generateAlternatives,
  generateCommand,
} from '../lib/ai-client.js';

interface UseAIState {
  isLoading: boolean;
  error: Error | null;
  lastProposal: CommandProposal | null;
}

interface UseAIActions {
  generate: (query: string) => Promise<Result<CommandProposal>>;
  getAlternatives: (query: string, excludeCommand: string) => Promise<Result<CommandProposal[]>>;
  explain: (command: string) => Promise<Result<string>>;
  clearError: () => void;
}

export type UseAIReturn = UseAIState & UseAIActions;

interface UseAIOptions {
  shell: ShellType;
  history?: HistoryEntry[];
  contextEnabled?: boolean;
}

/**
 * Hook for AI-powered command generation
 */
export function useAI({ shell, history = [], contextEnabled = true }: UseAIOptions): UseAIReturn {
  const [state, setState] = useState<UseAIState>({
    isLoading: false,
    error: null,
    lastProposal: null,
  });

  const historyRef = useRef(history);
  historyRef.current = history;

  const contextEnabledRef = useRef(contextEnabled);
  contextEnabledRef.current = contextEnabled;

  const generate = useCallback(
    async (query: string): Promise<Result<CommandProposal>> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const historyToPass = contextEnabledRef.current ? historyRef.current : [];
        const context = createSessionContext(shell, historyToPass);
        const result = await generateCommand(query, context);

        if (result.success) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            lastProposal: result.data,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: result.error,
          }));
        }

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err,
        }));
        return { success: false, error: err };
      }
    },
    [shell]
  );

  const getAlternatives = useCallback(
    async (query: string, excludeCommand: string): Promise<Result<CommandProposal[]>> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const historyToPass = contextEnabledRef.current ? historyRef.current : [];
        const context = createSessionContext(shell, historyToPass);
        const result = await generateAlternatives(query, context, excludeCommand);

        setState((prev) => ({ ...prev, isLoading: false }));

        if (!result.success) {
          setState((prev) => ({ ...prev, error: result.error }));
        }

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err,
        }));
        return { success: false, error: err };
      }
    },
    [shell]
  );

  const explain = useCallback(async (command: string): Promise<Result<string>> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await explainCommand(command);

      setState((prev) => ({ ...prev, isLoading: false }));

      if (!result.success) {
        setState((prev) => ({ ...prev, error: result.error }));
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err,
      }));
      return { success: false, error: err };
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    generate,
    getAlternatives,
    explain,
    clearError,
  };
}
