/**
 * Main application component
 * Uses single useInput controller pattern - DO NOT add useInput to child components
 */
import { ApiKeySetup } from './components/ApiKeySetup.js';
import { LiveOutput } from './components/CommandOutput.js';
import { CommandProposal } from './components/CommandProposal.js';
import { AlternativesList } from './components/CommandProposal.js';
import { InputPromptDisplay } from './components/InputPromptDisplay.js';
import { OptionsMenuDisplay, SelectionMenuDisplay } from './components/OptionsMenuDisplay.js';
import { ThinkingSpinner } from './components/Spinner.js';
import { WelcomeHeader } from './components/WelcomeHeader.js';
import { useAI } from './hooks/useAI.js';
import { useConfig } from './hooks/useConfig.js';
import { useExec } from './hooks/useExec.js';
import { useInputController, type InputMode } from './hooks/useInputController.js';
import { useSession } from './hooks/useSession.js';
import { copyToClipboard } from './lib/clipboard.js';
import { detectShell } from './lib/platform.js';
import { saveApiKey } from './lib/secure-storage.js';

import { Box, Static, Text, useApp } from 'ink';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { HistoryEntry } from './types/index.js';

type StaticItem = { id: string; type: 'header' } | { id: string; type: 'history'; entry: HistoryEntry };

export function App(): ReactNode {
  const { exit } = useApp();
  const shell = detectShell();

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  const { isLoading: configLoading, hasKey, error: configError, refreshKeyStatus } = useConfig();

  const {
    store,
    submitQuery,
    handleAIResponse,
    handleAIAlternatives,
    handleAIError,
    execute: executeAction,
    executeEdited,
    markExecutionDone,
    copy,
    edit,
    cancel,
    toggleOutput,
    completeSetup,
  } = useSession();

  const staticItems = useMemo<StaticItem[]>(() => {
    const items: StaticItem[] = [{ id: 'header', type: 'header' }];
    const pastHistory = store.history.slice(0, -1);
    pastHistory.forEach((entry, i) => {
      items.push({ id: `history-${i}`, type: 'history', entry });
    });
    return items;
  }, [store.history]);

  const lastHistoryEntry = store.history.length > 0 ? store.history[store.history.length - 1] : null;

  const {
    generate,
    getAlternatives,
    explain,
    isLoading: aiLoading,
  } = useAI({
    shell,
    history: store.history,
  });

  const {
    execute: executeCommand,
    kill: killCommand,
    isExecuting,
    liveOutput,
  } = useExec({
    shell,
    onComplete: markExecutionDone,
  });

  const inputMode: InputMode = useMemo(() => {
    if (configLoading || !hasKey) return 'disabled';
    if (store.state.status === 'setup') return 'disabled';
    if (store.state.status === 'loading') return 'disabled';
    if (store.state.status === 'executing' || isExecuting) return 'disabled';
    if (store.state.status === 'proposal') return aiLoading ? 'disabled' : 'menu';
    if (store.state.status === 'alternatives') return aiLoading ? 'disabled' : 'selection';
    if (store.state.status === 'input') return 'text';
    return 'disabled';
  }, [configLoading, hasKey, store.state.status, isExecuting, aiLoading]);

  const handleApiKeyComplete = useCallback(
    async (apiKey: string) => {
      const result = await saveApiKey(apiKey);
      if (result.success) {
        await refreshKeyStatus();
        completeSetup();
      }
    },
    [refreshKeyStatus, completeSetup],
  );

  useEffect(() => {
    if (!configLoading && hasKey && store.state.status === 'setup') {
      completeSetup();
    }
  }, [configLoading, hasKey, store.state.status, completeSetup]);

  const handleTextSubmit = useCallback(
    async (input: string) => {
      if (store.editingCommand) {
        executeEdited(input);
        await executeCommand(input);
        return;
      }

      submitQuery(input);
      setExplanation(null);

      const result = await generate(input);

      if (result.success) {
        handleAIResponse(result.data);
      } else {
        handleAIError(result.error);
      }
    },
    [store.editingCommand, submitQuery, generate, handleAIResponse, handleAIError, executeEdited, executeCommand],
  );

  // Menu action handlers
  const handleExecute = useCallback(async () => {
    if (store.state.status !== 'proposal') return;
    executeAction();
    await executeCommand(store.state.proposal.command);
  }, [store.state, executeAction, executeCommand]);

  const handleCopy = useCallback(async () => {
    if (store.state.status !== 'proposal') return;
    const result = await copyToClipboard(store.state.proposal.command);
    if (result.success) {
      setCopyFeedback('✓ Copied to clipboard');
      setTimeout(() => setCopyFeedback(null), 2000);
    } else {
      setCopyFeedback('✗ Failed to copy');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
    copy();
  }, [store.state, copy]);

  const handleEdit = useCallback(() => {
    if (store.state.status !== 'proposal') return;
    edit(store.state.proposal.command);
  }, [store.state, edit]);

  const handleAlternatives = useCallback(async () => {
    if (store.state.status !== 'proposal') return;
    const result = await getAlternatives(store.currentQuery, store.state.proposal.command);
    if (result.success) {
      handleAIAlternatives(result.data);
    } else {
      handleAIError(result.error);
    }
  }, [store.state, store.currentQuery, getAlternatives, handleAIAlternatives, handleAIError]);

  const handleCancel = useCallback(() => {
    cancel();
    setExplanation(null);
  }, [cancel]);

  const handleExplain = useCallback(async () => {
    if (store.state.status !== 'proposal') return;
    const result = await explain(store.state.proposal.command);
    if (result.success) {
      setExplanation(result.data);
    }
  }, [store.state, explain]);

  const handleToggle = useCallback(() => {
    toggleOutput();
  }, [toggleOutput]);

  // Handle alternative selection
  const handleAlternativeSelect = useCallback(
    (index: number) => {
      if (store.state.status !== 'alternatives') return;
      const proposal = store.state.proposals[index];
      if (proposal) {
        handleAIResponse(proposal);
      }
    },
    [store.state, handleAIResponse],
  );

  const { textState, clearText, setText, menuFocusIndex, selectionFocusIndex } = useInputController({
    mode: inputMode,
    initialTextValue: store.editingCommand ?? '',
    menuCallbacks: {
      onExecute: handleExecute,
      onCopy: handleCopy,
      onEdit: handleEdit,
      onAlternatives: handleAlternatives,
      onCancel: handleCancel,
      onExplain: handleExplain,
      onToggle: handleToggle,
    },
    selectionCallbacks: {
      onSelect: handleAlternativeSelect,
      onCancel: cancel,
      count: store.state.status === 'alternatives' ? store.state.proposals.length : 1,
    },
    textCallbacks: {
      onSubmit: handleTextSubmit,
      onToggleOutput: toggleOutput,
      hasHistory: store.history.length > 0,
    },
  });

  if (configLoading) {
    return (
      <Box flexDirection='column' paddingY={1}>
        <Text dimColor>Loading configuration...</Text>
      </Box>
    );
  }

  if (!hasKey && store.state.status === 'setup') {
    return <ApiKeySetup onComplete={handleApiKeyComplete} error={configError} />;
  }

  return (
    <Box flexDirection='column'>
      <Static items={staticItems}>
        {(item) => {
          if (item.type === 'header') {
            return <WelcomeHeader key={item.id} shell={shell} cwd={process.cwd()} />;
          }
          if (item.type === 'history') {
            return (
              <Box key={item.id} flexDirection='column' marginBottom={1}>
                <Box>
                  <Text color='cyan' bold>❯ </Text>
                  <Text color='cyan'>{item.entry.query}</Text>
                </Box>
                <Box marginLeft={2} flexDirection='column'>
                  <Box>
                    <Text dimColor>$ {item.entry.command} </Text>
                    <Text color={item.entry.exitCode === 0 ? 'green' : 'red'}>
                      {item.entry.exitCode === 0 ? '✓' : `✗ ${item.entry.exitCode}`}
                    </Text>
                  </Box>
                  {item.entry.output && (
                    <Box flexDirection='column'>
                      {item.entry.output.split('\n').slice(0, 10).map((line, i) => (
                        <Text key={i}>{line}</Text>
                      ))}
                      {item.entry.output.split('\n').length > 10 && (
                        <Text dimColor>... ({item.entry.output.split('\n').length - 10} more lines)</Text>
                      )}
                    </Box>
                  )}
                </Box>
                <Box marginTop={1}>
                  <Text dimColor>{'─'.repeat(50)}</Text>
                </Box>
              </Box>
            );
          }
          return null;
        }}
      </Static>

      {lastHistoryEntry && (
        <Box flexDirection='column' marginBottom={1}>
          <Box>
            <Text color='cyan' bold>❯ </Text>
            <Text color='cyan'>{lastHistoryEntry.query}</Text>
          </Box>
          <Box marginLeft={2} flexDirection='column'>
            <Box>
              <Text dimColor>$ {lastHistoryEntry.command} </Text>
              <Text color={lastHistoryEntry.exitCode === 0 ? 'green' : 'red'}>
                {lastHistoryEntry.exitCode === 0 ? '✓' : `✗ ${lastHistoryEntry.exitCode}`}
              </Text>
            </Box>
            {lastHistoryEntry.output && (
              <Box flexDirection='column'>
                {(() => {
                  const lines = lastHistoryEntry.output.split('\n').filter(l => l.length > 0);
                  const maxLines = store.outputExpanded ? 500 : 10;
                  const displayLines = lines.slice(0, maxLines);
                  const hiddenCount = lines.length - displayLines.length;
                  return (
                    <>
                      {displayLines.map((line, i) => (
                        <Text key={i}>{line}</Text>
                      ))}
                      {hiddenCount > 0 && (
                        <Box>
                          <Text dimColor>... ({hiddenCount} more lines, press </Text>
                          <Text color='blue'>[O]</Text>
                          <Text dimColor> to expand)</Text>
                        </Box>
                      )}
                    </>
                  );
                })()}
              </Box>
            )}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{'─'.repeat(50)}</Text>
          </Box>
        </Box>
      )}

      {store.error && (
        <Box marginY={1}>
          <Text color='red'>Error: {store.error}</Text>
        </Box>
      )}

      {copyFeedback && (
        <Box marginY={1}>
          <Text color='green'>{copyFeedback}</Text>
        </Box>
      )}

      {store.state.status === 'loading' && <ThinkingSpinner query={store.state.query} />}

      {store.state.status === 'proposal' && (
        <Box flexDirection='column' marginY={1}>
          <CommandProposal proposal={store.state.proposal} showExplanation={!!explanation} />

          {explanation && (
            <Box marginTop={1} paddingX={1}>
              <Text dimColor>{explanation}</Text>
            </Box>
          )}
        </Box>
      )}

      {store.state.status === 'proposal' && aiLoading && (
        <ThinkingSpinner label="Generating alternatives..." />
      )}

      <OptionsMenuDisplay
        focusedIndex={menuFocusIndex}
        visible={store.state.status === 'proposal' && !aiLoading}
      />

      {store.state.status === 'alternatives' && (
        <Box flexDirection='column' marginY={1}>
          <AlternativesList proposals={store.state.proposals} />
        </Box>
      )}

      <SelectionMenuDisplay
        count={store.state.status === 'alternatives' ? store.state.proposals.length : 0}
        focusedIndex={selectionFocusIndex}
        visible={store.state.status === 'alternatives' && !aiLoading}
      />

      {(store.state.status === 'executing' || isExecuting) && (
        <LiveOutput
          lines={liveOutput}
          command={store.state.status === 'executing' ? store.state.command : ''}
        />
      )}

      <InputPromptDisplay
        textState={textState}
        placeholder='Describe what you want to do...'
        hasHistory={store.history.length > 0}
        visible={store.state.status === 'input'}
      />
    </Box>
  );
}
