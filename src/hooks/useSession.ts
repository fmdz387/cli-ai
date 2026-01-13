/**
 * Session state machine hook
 */
import type { ConfigSection, SlashCommand } from '../commands/types.js';
import { DEFAULT_CONFIG } from '../constants.js';
import type {
  CommandProposal,
  ExecutionResult,
  HistoryEntry,
  SessionAction,
  SessionState,
} from '../types/index.js';

import { useCallback, useReducer } from 'react';

interface SessionStore {
  state: SessionState;
  history: HistoryEntry[];
  currentQuery: string;
  editingCommand: string | null;
  outputExpanded: boolean;
  error: string | null;
}

const initialStore: SessionStore = {
  state: { status: 'setup' },
  history: [],
  currentQuery: '',
  editingCommand: null,
  outputExpanded: false,
  error: null,
};

function sessionReducer(store: SessionStore, action: SessionAction): SessionStore {
  switch (action.type) {
    case 'SETUP_COMPLETE':
      return {
        ...store,
        state: { status: 'input' },
        error: null,
      };

    case 'SUBMIT':
      return {
        ...store,
        state: { status: 'loading', query: action.query },
        currentQuery: action.query,
        editingCommand: null,
        error: null,
      };

    case 'AI_RESPONSE':
      return {
        ...store,
        state: { status: 'proposal', proposal: action.proposal },
        error: null,
      };

    case 'AI_ALTERNATIVES':
      return {
        ...store,
        state: {
          status: 'alternatives',
          proposals: action.proposals,
          originalQuery: store.currentQuery,
        },
        error: null,
      };

    case 'AI_ERROR':
      return {
        ...store,
        state: { status: 'input' },
        error: action.error.message,
      };

    case 'EXECUTE': {
      const currentState = store.state;
      if (currentState.status !== 'proposal') {
        return store;
      }
      return {
        ...store,
        state: { status: 'executing', command: currentState.proposal.command },
        error: null,
      };
    }

    case 'EXECUTE_EDITED': {
      return {
        ...store,
        state: { status: 'executing', command: action.command },
        editingCommand: null,
        error: null,
      };
    }

    case 'EXEC_DONE': {
      const newHistory = [
        ...store.history,
        {
          query: store.currentQuery,
          command: action.result.command,
          output: action.result.stdout || action.result.stderr,
          exitCode: action.result.exitCode,
        },
      ].slice(-DEFAULT_CONFIG.maxHistoryEntries);

      return {
        ...store,
        state: { status: 'input' },
        history: newHistory,
        outputExpanded: false,
        error: null,
      };
    }

    case 'COPY':
      return {
        ...store,
        state: { status: 'input' },
        error: null,
      };

    case 'EDIT': {
      return {
        ...store,
        state: { status: 'input' },
        editingCommand: action.command,
        error: null,
      };
    }

    case 'CANCEL':
      return {
        ...store,
        state: { status: 'input' },
        editingCommand: null,
        error: null,
      };

    case 'TOGGLE_OUTPUT': {
      if (store.history.length === 0) return store;

      return {
        ...store,
        outputExpanded: !store.outputExpanded,
      };
    }

    case 'OPEN_PALETTE':
      return {
        ...store,
        state: { status: 'palette', query: '', filteredCommands: [] },
        error: null,
      };

    case 'UPDATE_PALETTE':
      return {
        ...store,
        state: {
          status: 'palette',
          query: action.query,
          filteredCommands: action.filteredCommands,
        },
      };

    case 'CLOSE_PALETTE':
      return {
        ...store,
        state: { status: 'input' },
        error: null,
      };

    case 'OPEN_CONFIG':
      return {
        ...store,
        state: { status: 'config', section: 'provider' },
        error: null,
      };

    case 'UPDATE_CONFIG_SECTION':
      return {
        ...store,
        state: { status: 'config', section: action.section },
      };

    case 'CLOSE_CONFIG':
      return {
        ...store,
        state: { status: 'input' },
        error: null,
      };

    case 'OPEN_HELP':
      return {
        ...store,
        state: { status: 'help' },
        error: null,
      };

    case 'CLOSE_HELP':
      return {
        ...store,
        state: { status: 'input' },
        error: null,
      };

    case 'CLEAR_HISTORY':
      return {
        ...store,
        state: { status: 'input' },
        history: [],
        outputExpanded: false,
        error: null,
      };

    default:
      return store;
  }
}

export interface UseSessionReturn {
  store: SessionStore;
  dispatch: React.Dispatch<SessionAction>;
  // Convenience methods
  submitQuery: (query: string) => void;
  handleAIResponse: (proposal: CommandProposal) => void;
  handleAIAlternatives: (proposals: CommandProposal[]) => void;
  handleAIError: (error: Error) => void;
  execute: () => void;
  executeEdited: (command: string) => void;
  markExecutionDone: (result: ExecutionResult) => void;
  copy: () => void;
  edit: (command: string) => void;
  cancel: () => void;
  toggleOutput: () => void;
  completeSetup: () => void;
  clearEditingCommand: () => void;
  // Palette methods
  openPalette: () => void;
  updatePalette: (query: string, filteredCommands: SlashCommand[]) => void;
  closePalette: () => void;
  // Config methods
  openConfig: () => void;
  updateConfigSection: (section: ConfigSection) => void;
  closeConfig: () => void;
  // Help methods
  openHelp: () => void;
  closeHelp: () => void;
  // History methods
  clearHistory: () => void;
}

/**
 * Hook for managing session state
 */
export function useSession(): UseSessionReturn {
  const [store, dispatch] = useReducer(sessionReducer, initialStore);

  const submitQuery = useCallback((query: string) => {
    dispatch({ type: 'SUBMIT', query });
  }, []);

  const handleAIResponse = useCallback((proposal: CommandProposal) => {
    dispatch({ type: 'AI_RESPONSE', proposal });
  }, []);

  const handleAIAlternatives = useCallback((proposals: CommandProposal[]) => {
    dispatch({ type: 'AI_ALTERNATIVES', proposals });
  }, []);

  const handleAIError = useCallback((error: Error) => {
    dispatch({ type: 'AI_ERROR', error });
  }, []);

  const execute = useCallback(() => {
    dispatch({ type: 'EXECUTE' });
  }, []);

  const executeEdited = useCallback((command: string) => {
    dispatch({ type: 'EXECUTE_EDITED', command });
  }, []);

  const markExecutionDone = useCallback((result: ExecutionResult) => {
    dispatch({ type: 'EXEC_DONE', result });
  }, []);

  const copy = useCallback(() => {
    dispatch({ type: 'COPY' });
  }, []);

  const edit = useCallback((command: string) => {
    dispatch({ type: 'EDIT', command });
  }, []);

  const cancel = useCallback(() => {
    dispatch({ type: 'CANCEL' });
  }, []);

  const toggleOutput = useCallback(() => {
    dispatch({ type: 'TOGGLE_OUTPUT' });
  }, []);

  const completeSetup = useCallback(() => {
    dispatch({ type: 'SETUP_COMPLETE' });
  }, []);

  const clearEditingCommand = useCallback(() => {
    dispatch({ type: 'EDIT', command: '' });
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

  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
  }, []);

  return {
    store,
    dispatch,
    submitQuery,
    handleAIResponse,
    handleAIAlternatives,
    handleAIError,
    execute,
    executeEdited,
    markExecutionDone,
    copy,
    edit,
    cancel,
    toggleOutput,
    completeSetup,
    clearEditingCommand,
    openPalette,
    updatePalette,
    closePalette,
    openConfig,
    updateConfigSection,
    closeConfig,
    openHelp,
    closeHelp,
    clearHistory,
  };
}
