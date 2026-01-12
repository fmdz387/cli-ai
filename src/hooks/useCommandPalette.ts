/**
 * Hook for managing command palette state
 */
import { commandRegistry } from '../commands/index.js';
import type { CommandContext, CommandResult, SlashCommand } from '../commands/types.js';
import type { AppConfig } from '../types/index.js';

import { useCallback, useMemo, useState } from 'react';

export interface UseCommandPaletteOptions {
  sessionStatus: string;
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  onOpenConfig: () => void;
  onOpenHelp: () => void;
  onClearHistory: () => void;
  onExit: () => void;
}

export interface UseCommandPaletteReturn {
  /** Current filter query (text after /) */
  query: string;
  /** Set filter query */
  setQuery: (query: string) => void;
  /** Filtered commands matching query */
  filteredCommands: SlashCommand[];
  /** Currently focused command index */
  focusedIndex: number;
  /** Move focus up */
  focusUp: () => void;
  /** Move focus down */
  focusDown: () => void;
  /** Execute currently focused command */
  executeSelected: () => CommandResult | null;
  /** Execute specific command by name */
  executeCommand: (nameOrAlias: string) => CommandResult | null;
  /** Reset palette state */
  reset: () => void;
}

/**
 * Hook for managing command palette filtering and execution
 */
export function useCommandPalette({
  sessionStatus,
  config,
  updateConfig,
  onOpenConfig,
  onOpenHelp,
  onClearHistory,
  onExit,
}: UseCommandPaletteOptions): UseCommandPaletteReturn {
  const [query, setQueryState] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Filter commands based on query and availability
  const filteredCommands = useMemo(() => {
    const filtered = commandRegistry.filter(query);
    return filtered.filter((cmd) => !cmd.isAvailable || cmd.isAvailable(sessionStatus));
  }, [query, sessionStatus]);

  // Reset focus when query changes
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
    setFocusedIndex(0);
  }, []);

  const focusUp = useCallback(() => {
    setFocusedIndex((prev) => {
      if (filteredCommands.length === 0) return 0;
      return (prev - 1 + filteredCommands.length) % filteredCommands.length;
    });
  }, [filteredCommands.length]);

  const focusDown = useCallback(() => {
    setFocusedIndex((prev) => {
      if (filteredCommands.length === 0) return 0;
      return (prev + 1) % filteredCommands.length;
    });
  }, [filteredCommands.length]);

  // Create command context
  const createContext = useCallback((): CommandContext => {
    return {
      sessionStatus,
      config,
      updateConfig,
      exit: onExit,
    };
  }, [sessionStatus, config, updateConfig, onExit]);

  // Handle command result
  const handleResult = useCallback(
    (result: CommandResult): CommandResult => {
      switch (result.type) {
        case 'panel':
          if (result.panel === 'config') {
            onOpenConfig();
          } else if (result.panel === 'help') {
            onOpenHelp();
          }
          break;
        case 'navigate':
          if (result.to === 'clear') {
            onClearHistory();
          }
          break;
        case 'exit':
          onExit();
          break;
      }
      return result;
    },
    [onOpenConfig, onOpenHelp, onClearHistory, onExit],
  );

  const executeSelected = useCallback((): CommandResult | null => {
    if (filteredCommands.length === 0) return null;
    const command = filteredCommands[focusedIndex];
    if (!command) return null;

    const context = createContext();
    const result = command.execute(context);

    // Handle both sync and async results
    if (result instanceof Promise) {
      result.then(handleResult);
      return null;
    }

    return handleResult(result);
  }, [filteredCommands, focusedIndex, createContext, handleResult]);

  const executeCommand = useCallback(
    (nameOrAlias: string): CommandResult | null => {
      const command = commandRegistry.get(nameOrAlias);
      if (!command) return null;

      // Check availability
      if (command.isAvailable && !command.isAvailable(sessionStatus)) {
        return null;
      }

      const context = createContext();
      const result = command.execute(context);

      if (result instanceof Promise) {
        result.then(handleResult);
        return null;
      }

      return handleResult(result);
    },
    [sessionStatus, createContext, handleResult],
  );

  const reset = useCallback(() => {
    setQueryState('');
    setFocusedIndex(0);
  }, []);

  return {
    query,
    setQuery,
    filteredCommands,
    focusedIndex,
    focusUp,
    focusDown,
    executeSelected,
    executeCommand,
    reset,
  };
}
