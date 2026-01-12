/**
 * Main application component
 * Uses single useInput controller pattern - DO NOT add useInput to child components
 */
import { commandRegistry } from './commands/index.js';
import type { ConfigSection } from './commands/types.js';
import { ApiKeySetup } from './components/ApiKeySetup.js';
import { LiveOutput } from './components/CommandOutput.js';
import { CommandPaletteDisplay } from './components/CommandPalette/index.js';
import { CommandProposal } from './components/CommandProposal.js';
import { AlternativesList } from './components/CommandProposal.js';
import { ConfigPanelDisplay, type StorageInfo } from './components/ConfigPanel/index.js';
import { HelpPanelDisplay } from './components/HelpPanel/index.js';
import { InputPromptDisplay } from './components/InputPromptDisplay.js';
import { OptionsMenuDisplay, SelectionMenuDisplay } from './components/OptionsMenuDisplay.js';
import { ThinkingSpinner } from './components/Spinner.js';
import { WelcomeHeader } from './components/WelcomeHeader.js';
import { useAI } from './hooks/useAI.js';
import { useCommandPalette } from './hooks/useCommandPalette.js';
import { useConfig } from './hooks/useConfig.js';
import { useExec } from './hooks/useExec.js';
import { useInputController, type InputMode } from './hooks/useInputController.js';
import { useSession } from './hooks/useSession.js';
import { copyToClipboard } from './lib/clipboard.js';
import { detectShell } from './lib/platform.js';
import { deleteApiKey, getApiKey, getConfig, getStorageInfo, saveApiKey, setConfig } from './lib/secure-storage.js';

import { Box, Static, Text, useApp } from 'ink';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppConfig, HistoryEntry } from './types/index.js';
import type { SlashCommand } from './commands/types.js';

type StaticItem = { id: string; type: 'header' } | { id: string; type: 'history'; entry: HistoryEntry };

export function App(): ReactNode {
  const { exit } = useApp();
  const shell = detectShell();

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  // Inline palette state - shown when user types "/" in input
  const [inlinePaletteCommands, setInlinePaletteCommands] = useState<SlashCommand[]>([]);
  const [inlinePaletteIndex, setInlinePaletteIndex] = useState(0);

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
    openPalette,
    updatePalette,
    closePalette,
    openConfig,
    updateConfigSection,
    closeConfig,
    openHelp,
    closeHelp,
    clearHistory,
  } = useSession();

  // Config panel state
  const [configItemIndex, setConfigItemIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState(() => getConfig().model);
  const [displayToggles, setDisplayToggles] = useState(() => {
    const savedConfig = getConfig();
    return {
      contextEnabled: savedConfig.contextEnabled,
      showExplanations: true,
      syntaxHighlighting: true,
      simpleMode: false,
    };
  });
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);

  // Get storage info for config panel
  const storageInfo: StorageInfo = useMemo(() => getStorageInfo(), [hasKey]);

  // Get masked API key
  const maskedKey = useMemo(() => {
    const key = getApiKey();
    if (!key) return null;
    if (key.length <= 12) return '***';
    return `${key.slice(0, 7)}...${key.slice(-4)}`;
  }, [hasKey]);

  // App config for palette
  const appConfig: AppConfig = useMemo(
    () => ({
      model: selectedModel,
      maxHistoryEntries: 5,
      maxOutputLines: 10,
      maxAlternatives: 3,
    }),
    [selectedModel],
  );

  // Command palette hook
  const palette = useCommandPalette({
    sessionStatus: store.state.status,
    config: appConfig,
    updateConfig: () => {},
    onOpenConfig: openConfig,
    onOpenHelp: openHelp,
    onClearHistory: clearHistory,
    onExit: () => exit(),
  });

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
    contextEnabled: displayToggles.contextEnabled,
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
    if (store.state.status === 'palette') return 'palette';
    if (store.state.status === 'config') return 'config';
    if (store.state.status === 'help') return 'help';
    if (store.state.status === 'proposal') return aiLoading ? 'disabled' : 'menu';
    if (store.state.status === 'alternatives') return aiLoading ? 'disabled' : 'selection';
    if (store.state.status === 'input') return 'text';
    return 'disabled';
  }, [configLoading, hasKey, store.state.status, isExecuting, aiLoading]);

  const handleApiKeyComplete = useCallback(
    (apiKey: string) => {
      const result = saveApiKey(apiKey);
      if (result.success) {
        refreshKeyStatus();
        setIsEditingApiKey(false);
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

  // Persist model changes to config
  useEffect(() => {
    const savedModel = getConfig().model;
    if (selectedModel !== savedModel) {
      setConfig({ model: selectedModel });
    }
  }, [selectedModel]);

  // Handle text change to show inline palette when typing "/"
  const handleTextChange = useCallback(
    (value: string) => {
      if (value.startsWith('/')) {
        const query = value.slice(1);
        const filtered = commandRegistry.filter(query);
        setInlinePaletteCommands(filtered);
        setInlinePaletteIndex(0);
      } else {
        setInlinePaletteCommands([]);
        setInlinePaletteIndex(0);
      }
    },
    [],
  );

  const handleTextSubmit = useCallback(
    async (input: string) => {
      // Check for slash command - execute selected from inline palette
      if (input.startsWith('/')) {
        const cmdName = input.slice(1).trim();

        // If we have filtered commands and one is selected, execute it
        if (inlinePaletteCommands.length > 0) {
          const selectedCmd = inlinePaletteCommands[inlinePaletteIndex];
          if (selectedCmd) {
            const result = palette.executeCommand(selectedCmd.name);
            if (result) {
              setInlinePaletteCommands([]);
              setInlinePaletteIndex(0);
              return;
            }
          }
        }

        // Try to execute by name if typed exactly
        if (cmdName) {
          const result = palette.executeCommand(cmdName);
          if (result) {
            setInlinePaletteCommands([]);
            setInlinePaletteIndex(0);
            return;
          }
        }

        // No valid command - clear and show feedback
        setInlinePaletteCommands([]);
        setInlinePaletteIndex(0);
        return;
      }

      // Clear inline palette
      setInlinePaletteCommands([]);
      setInlinePaletteIndex(0);

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
    [store.editingCommand, submitQuery, generate, handleAIResponse, handleAIError, executeEdited, executeCommand, palette, inlinePaletteCommands, inlinePaletteIndex],
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

  // Palette callbacks
  const handlePaletteQueryChange = useCallback(
    (query: string) => {
      const filtered = commandRegistry.filter(query);
      palette.setQuery(query);
      updatePalette(query, filtered);
    },
    [palette, updatePalette],
  );

  const handlePaletteSelect = useCallback(() => {
    const result = palette.executeSelected();
    if (result) {
      closePalette();
      palette.reset();
    }
  }, [palette, closePalette]);

  const handlePaletteNavigate = useCallback(
    (direction: 'up' | 'down') => {
      if (direction === 'up') {
        palette.focusUp();
      } else {
        palette.focusDown();
      }
    },
    [palette],
  );

  const handlePaletteClose = useCallback(() => {
    closePalette();
    palette.reset();
  }, [closePalette, palette]);

  // Config callbacks
  const handleConfigNavigateSection = useCallback(
    (direction: 'next' | 'prev') => {
      const sections: ConfigSection[] = ['api-key', 'model', 'toggles', 'about'];
      if (store.state.status !== 'config') return;
      const currentIndex = sections.indexOf(store.state.section);
      let newIndex: number;
      if (direction === 'next') {
        newIndex = (currentIndex + 1) % sections.length;
      } else {
        newIndex = (currentIndex - 1 + sections.length) % sections.length;
      }
      updateConfigSection(sections[newIndex]!);
      setConfigItemIndex(0);
    },
    [store.state, updateConfigSection],
  );

  const handleConfigNavigateItem = useCallback(
    (direction: 'up' | 'down') => {
      const itemCounts: Record<ConfigSection, number> = {
        'api-key': hasKey ? 2 : 1,
        model: 4,
        toggles: 4,
        about: 0,
      };
      if (store.state.status !== 'config') return;
      const count = itemCounts[store.state.section];
      if (count === 0) return;
      setConfigItemIndex((prev) => {
        if (direction === 'up') {
          return (prev - 1 + count) % count;
        }
        return (prev + 1) % count;
      });
    },
    [store.state, hasKey],
  );

  const handleConfigToggle = useCallback(() => {
    if (store.state.status !== 'config') return;

    // Handle toggles section
    if (store.state.section === 'toggles') {
      setDisplayToggles((prev) => {
        const toggleKeys = ['contextEnabled', 'showExplanations', 'syntaxHighlighting', 'simpleMode'] as const;
        const key = toggleKeys[configItemIndex];
        if (key) {
          const newValue = !prev[key];
          // Persist contextEnabled to config
          if (key === 'contextEnabled') {
            setConfig({ contextEnabled: newValue });
          }
          return { ...prev, [key]: newValue };
        }
        return prev;
      });
      return;
    }

    // Handle model section - select the focused model
    if (store.state.section === 'model') {
      const models = [
        'claude-sonnet-4-5-20250929',
        'claude-opus-4-1-20250219',
        'claude-haiku-3-5-20241022',
        'claude-sonnet-4-20250514',
      ];
      const newModel = models[configItemIndex];
      if (newModel) {
        setSelectedModel(newModel);
      }
      return;
    }

    // Handle API key section
    if (store.state.section === 'api-key') {
      if (configItemIndex === 0) {
        // Change/Set API Key - close config and go to setup
        closeConfig();
        setIsEditingApiKey(true);
      } else if (configItemIndex === 1 && hasKey) {
        // Remove API Key
        const result = deleteApiKey();
        if (result.success) {
          refreshKeyStatus();
          closeConfig();
        }
      }
      return;
    }
  }, [store.state, configItemIndex, closeConfig, hasKey, refreshKeyStatus]);

  const handleConfigClose = useCallback(() => {
    closeConfig();
    setConfigItemIndex(0);
  }, [closeConfig]);

  // Get palette query for input controller
  const paletteQuery = store.state.status === 'palette' ? store.state.query : '';

  // Get current config section item count for input controller
  const configItemCount = useMemo(() => {
    if (store.state.status !== 'config') return 0;
    const itemCounts: Record<ConfigSection, number> = {
      'api-key': hasKey ? 2 : 1,
      model: 4,
      toggles: 4,
      about: 0,
    };
    return itemCounts[store.state.section];
  }, [store.state, hasKey]);

  const { textState, clearText, setText, menuFocusIndex, selectionFocusIndex, paletteFocusIndex, configSectionIndex } = useInputController({
    mode: inputMode,
    initialTextValue: store.editingCommand ?? '',
    paletteQuery,
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
      onTextChange: handleTextChange,
      onNavigateInlinePalette: (direction) => {
        setInlinePaletteIndex((prev) => {
          const count = inlinePaletteCommands.length;
          if (count === 0) return 0;
          if (direction === 'up') {
            return (prev - 1 + count) % count;
          }
          return (prev + 1) % count;
        });
      },
      onCloseInlinePalette: () => {
        setInlinePaletteCommands([]);
        setInlinePaletteIndex(0);
      },
      hasInlinePalette: inlinePaletteCommands.length > 0,
      hasHistory: store.history.length > 0,
    },
    paletteCallbacks: {
      onQueryChange: handlePaletteQueryChange,
      onSelect: handlePaletteSelect,
      onNavigate: handlePaletteNavigate,
      onClose: handlePaletteClose,
      filteredCount: store.state.status === 'palette' ? store.state.filteredCommands.length : 0,
    },
    configCallbacks: {
      onNavigateSection: handleConfigNavigateSection,
      onNavigateItem: handleConfigNavigateItem,
      onToggle: handleConfigToggle,
      onClose: handleConfigClose,
      sectionCount: 4,
      itemCount: configItemCount,
    },
    helpCallbacks: {
      onClose: closeHelp,
    },
  });

  if (configLoading) {
    return (
      <Box flexDirection='column' paddingY={1}>
        <Text dimColor>Loading configuration...</Text>
      </Box>
    );
  }

  if (isEditingApiKey || (!hasKey && store.state.status === 'setup')) {
    return <ApiKeySetup onComplete={handleApiKeyComplete} error={configError} />;
  }

  return (
    <Box flexDirection='column'>
      <Static items={staticItems}>
        {(item) => {
          if (item.type === 'header') {
            return <WelcomeHeader key={item.id} shell={shell} cwd={process.cwd()} model={selectedModel} />;
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

      {/* Command Palette */}
      <CommandPaletteDisplay
        query={store.state.status === 'palette' ? store.state.query : ''}
        filteredCommands={store.state.status === 'palette' ? store.state.filteredCommands : []}
        selectedIndex={paletteFocusIndex}
        visible={store.state.status === 'palette'}
      />

      {/* Config Panel */}
      <ConfigPanelDisplay
        visible={store.state.status === 'config'}
        activeSection={store.state.status === 'config' ? store.state.section : 'api-key'}
        sectionItemIndex={configItemIndex}
        config={appConfig}
        hasApiKey={hasKey}
        storageInfo={storageInfo}
        maskedKey={maskedKey}
        toggles={displayToggles}
      />

      {/* Help Panel */}
      <HelpPanelDisplay visible={store.state.status === 'help'} />

      <InputPromptDisplay
        textState={textState}
        placeholder='Describe what you want to do... (type / for commands)'
        hasHistory={store.history.length > 0}
        visible={store.state.status === 'input'}
      />

      {/* Inline Command Palette - shows below input when typing "/" */}
      {store.state.status === 'input' && inlinePaletteCommands.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginTop={0}>
          <Box marginBottom={0}>
            <Text dimColor>{'─'.repeat(50)}</Text>
          </Box>
          {inlinePaletteCommands.slice(0, 5).map((cmd, index) => (
            <Box key={cmd.name}>
              <Text color={index === inlinePaletteIndex ? 'cyan' : 'gray'} bold={index === inlinePaletteIndex}>
                {index === inlinePaletteIndex ? '> ' : '  '}
              </Text>
              <Text color={index === inlinePaletteIndex ? 'cyan' : 'blue'} bold={index === inlinePaletteIndex}>
                /{cmd.name}
              </Text>
              <Text>  </Text>
              <Text dimColor={index !== inlinePaletteIndex}>{cmd.description}</Text>
            </Box>
          ))}
          <Box marginTop={0}>
            <Text dimColor>[Enter] Select  [Up/Down] Navigate  [Esc] Cancel</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
