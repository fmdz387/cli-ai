/**
 * Main application component - Chat-first conversational UX
 * Uses single useInput controller pattern - DO NOT add useInput to child components
 */
import { commandRegistry } from './commands/index.js';
import { PROVIDER_MODELS, type ConfigSection } from './commands/types.js';
import type { SlashCommand } from './commands/types.js';
import { buildCompactedMessages, compactConversation } from './agent/compact.js';
import { createExecutorDeps } from './agent/create-executor.js';
import { AgentExecutor, type ExecutorDependencies } from './agent/executor.js';
import type { AgentConfig, ExecutorResult, ExecutorRunOptions } from './agent/types.js';
import { ApiKeySetup } from './components/ApiKeySetup.js';
import { ChatView } from './components/Chat/index.js';
import { CommandPaletteDisplay } from './components/CommandPalette/index.js';
import { ConfigPanelDisplay, type StorageInfo } from './components/ConfigPanel/index.js';
import { FooterBar } from './components/FooterBar.js';
import { HelpPanelDisplay } from './components/HelpPanel/index.js';
import { InputPromptDisplay } from './components/InputPromptDisplay.js';
import { StatusBar } from './components/StatusBar.js';
import { AI_PROVIDERS, MAX_AGENT_STEPS, PROVIDER_CONFIG } from './constants.js';
import { useChatAgent } from './hooks/useChatAgent.js';
import { useChatSession } from './hooks/useChatSession.js';
import { useCommandPalette } from './hooks/useCommandPalette.js';
import { useConfig } from './hooks/useConfig.js';
import { useInputController, type InputMode } from './hooks/useInputController.js';
import { detectShell } from './lib/platform.js';
import {
  getApiKey,
  getConfig,
  getStorageInfo,
  saveApiKey,
  setConfig,
} from './lib/secure-storage.js';
import { ThemeProvider } from './theme/index.js';
import type { AIProvider, AppConfig } from './types/index.js';

import { Box, Text, useApp } from 'ink';
import { createHash } from 'node:crypto';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const CONFIG_SECTIONS: readonly ConfigSection[] = ['provider', 'model', 'api-keys', 'options', 'about'];

export function App(): ReactNode {
  const { exit } = useApp();
  const shell = detectShell();

  // Inline palette state - shown when user types "/" in input
  const [inlinePaletteCommands, setInlinePaletteCommands] = useState<SlashCommand[]>([]);
  const [inlinePaletteIndex, setInlinePaletteIndex] = useState(0);

  const { isLoading: configLoading, hasKey, error: configError, refreshKeyStatus } = useConfig();

  const {
    store: chatStore,
    dispatch: chatDispatch,
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
  } = useChatSession();

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
  const [editingApiKeyProvider, setEditingApiKeyProvider] = useState<AIProvider | null>(null);
  const [isEditingCustomModel, setIsEditingCustomModel] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<AIProvider>(() => getConfig().provider);

  const storageInfo: StorageInfo = useMemo(
    () => getStorageInfo(currentProvider),
    [hasKey, currentProvider],
  );

  const maskedKey = useMemo(() => {
    const key = getApiKey(currentProvider);
    if (!key) return null;
    if (key.length <= 12) return '***';
    return `${key.slice(0, 7)}...${key.slice(-4)}`;
  }, [hasKey, currentProvider]);

  const appConfig: AppConfig = useMemo(
    () => ({
      provider: currentProvider,
      model: selectedModel,
      contextEnabled: displayToggles.contextEnabled,
      maxHistoryEntries: 5,
      maxOutputLines: 10,
      maxAlternatives: 3,
    }),
    [currentProvider, selectedModel, displayToggles.contextEnabled],
  );

  const cachedDepsRef = useRef<{ key: string; deps: ExecutorDependencies } | null>(null);

  const runExecutor = useCallback(
    async (options: ExecutorRunOptions): Promise<ExecutorResult> => {
      const apiKey = getApiKey(options.config.provider);
      if (!apiKey) {
        throw new Error(`No API key configured for ${options.config.provider}`);
      }
      const keyHash = createHash('sha256').update(apiKey).digest('hex').slice(0, 8);
      const cacheKey = `${options.config.provider}:${options.config.model}:${keyHash}`;
      let deps: ExecutorDependencies;
      if (cachedDepsRef.current?.key === cacheKey) {
        deps = cachedDepsRef.current.deps;
      } else {
        deps = createExecutorDeps(options.config.provider, options.config.model, apiKey);
        cachedDepsRef.current = { key: cacheKey, deps };
      }
      const executor = new AgentExecutor(deps);
      return executor.execute(options);
    },
    [],
  );

  const buildAgentConfig = useCallback(
    (): AgentConfig => ({
      provider: currentProvider,
      model: selectedModel,
      apiKey: getApiKey(currentProvider) ?? '',
      maxTurns: MAX_AGENT_STEPS,
      maxTokensPerTurn: 4096,
      context: {
        shell,
        cwd: process.cwd(),
        platform: process.platform,
        directoryTree: '',
        history: [],
      },
    }),
    [currentProvider, selectedModel, shell],
  );

  const handleCompact = useCallback(() => {
    if (chatStore.apiMessages.length < 3) return;
    if (chatStore.isCompacting || chatStore.isAgentRunning) return;

    startCompact();

    const apiKey = getApiKey(currentProvider);
    if (!apiKey) {
      chatDispatch({ type: 'COMPACT_ERROR', error: `No API key for ${currentProvider}` });
      return;
    }

    const deps = createExecutorDeps(currentProvider, selectedModel, apiKey);

    compactConversation(chatStore.apiMessages, deps.provider)
      .then((result) => {
        if (!result.summary) {
          chatDispatch({ type: 'COMPACT_ERROR', error: 'Conversation too short to compact' });
          return;
        }
        const compactedApiMessages = buildCompactedMessages(chatStore.apiMessages, result.summary);
        chatDispatch({ type: 'COMPACT_DONE', summary: result.summary, compactedApiMessages });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        chatDispatch({ type: 'COMPACT_ERROR', error: message });
      });
  }, [chatStore.apiMessages, chatStore.isCompacting, chatStore.isAgentRunning, currentProvider, selectedModel, startCompact, chatDispatch]);

  const chatAgent = useChatAgent({
    runExecutor,
    buildConfig: buildAgentConfig,
    apiMessages: chatStore.apiMessages,
    dispatch: chatDispatch,
  });

  // Command palette hook
  const palette = useCommandPalette({
    sessionStatus: chatStore.overlay.type === 'palette' ? 'palette' : 'input',
    config: appConfig,
    updateConfig: () => {},
    onOpenConfig: openConfig,
    onOpenHelp: openHelp,
    onClearHistory: clearConversation,
    onCompact: handleCompact,
    onExit: () => exit(),
  });

  // Determine input mode
  const inputMode: InputMode = useMemo(() => {
    if (configLoading || !hasKey) return 'disabled';
    if (!chatStore.isSetup) return 'disabled';
    if (chatStore.overlay.type === 'palette') return 'palette';
    if (chatStore.overlay.type === 'config') return 'config';
    if (chatStore.overlay.type === 'help') return 'help';
    return 'text';
  }, [configLoading, hasKey, chatStore.isSetup, chatStore.overlay.type]);

  const handleApiKeyComplete = useCallback(
    (apiKey: string, provider: AIProvider) => {
      const result = saveApiKey(provider, apiKey);
      if (result.success) {
        if (!hasKey && !chatStore.isSetup) {
          setConfig({ provider, model: PROVIDER_CONFIG[provider].defaultModel });
          setCurrentProvider(provider);
          setSelectedModel(PROVIDER_CONFIG[provider].defaultModel);
        }
        refreshKeyStatus();
        setIsEditingApiKey(false);
        setEditingApiKeyProvider(null);
        completeSetup();
      }
    },
    [hasKey, chatStore.isSetup, refreshKeyStatus, completeSetup],
  );

  useEffect(() => {
    if (!configLoading && hasKey && !chatStore.isSetup) {
      completeSetup();
    }
  }, [configLoading, hasKey, chatStore.isSetup, completeSetup]);

  // Persist model changes to config
  useEffect(() => {
    const savedModel = getConfig().model;
    if (selectedModel !== savedModel) {
      setConfig({ model: selectedModel });
    }
  }, [selectedModel]);

  // Handle text change to show inline palette when typing "/"
  const handleTextChange = useCallback((value: string) => {
    if (value.startsWith('/')) {
      const query = value.slice(1);
      const filtered = commandRegistry.filter(query);
      setInlinePaletteCommands(filtered);
      setInlinePaletteIndex(0);
    } else {
      setInlinePaletteCommands([]);
      setInlinePaletteIndex(0);
    }
  }, []);

  const handleTextSubmit = useCallback(
    (input: string) => {
      // Check for slash command
      if (input.startsWith('/')) {
        const cmdName = input.slice(1).trim();

        if (inlinePaletteCommands.length > 0) {
          const selectedCmd = inlinePaletteCommands[inlinePaletteIndex];
          if (selectedCmd) {
            palette.executeCommand(selectedCmd.name);
            setInlinePaletteCommands([]);
            setInlinePaletteIndex(0);
            return;
          }
        }

        if (cmdName) {
          palette.executeCommand(cmdName);
          setInlinePaletteCommands([]);
          setInlinePaletteIndex(0);
          return;
        }

        setInlinePaletteCommands([]);
        setInlinePaletteIndex(0);
        return;
      }

      // Clear inline palette
      setInlinePaletteCommands([]);
      setInlinePaletteIndex(0);

      // Send message through chat flow
      sendMessage(input);
      chatAgent.run(input);
    },
    [
      sendMessage,
      chatAgent,
      palette,
      inlinePaletteCommands,
      inlinePaletteIndex,
    ],
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
      if (chatStore.overlay.type !== 'config') return;
      if (isEditingCustomModel) {
        setIsEditingCustomModel(false);
      }
      const currentIndex = CONFIG_SECTIONS.indexOf(chatStore.overlay.section);
      let newIndex: number;
      if (direction === 'next') {
        newIndex = (currentIndex + 1) % CONFIG_SECTIONS.length;
      } else {
        newIndex = (currentIndex - 1 + CONFIG_SECTIONS.length) % CONFIG_SECTIONS.length;
      }
      updateConfigSection(CONFIG_SECTIONS[newIndex]!);
      setConfigItemIndex(0);
    },
    [chatStore.overlay, updateConfigSection, isEditingCustomModel],
  );

  const handleConfigJumpToSection = useCallback(
    (index: number) => {
      const section = CONFIG_SECTIONS[index];
      if (!section) return;
      if (isEditingCustomModel) {
        setIsEditingCustomModel(false);
      }
      updateConfigSection(section);
      setConfigItemIndex(0);
    },
    [updateConfigSection, isEditingCustomModel],
  );

  const getItemCount = useCallback(
    (section: ConfigSection): number => {
      const counts: Record<ConfigSection, number> = {
        'provider': AI_PROVIDERS.length,
        'model': PROVIDER_MODELS[currentProvider].length + 1,
        'api-keys': AI_PROVIDERS.length,
        'options': 4,
        'about': 0,
      };
      return counts[section];
    },
    [currentProvider],
  );

  const handleConfigNavigateItem = useCallback(
    (direction: 'up' | 'down') => {
      if (chatStore.overlay.type !== 'config') return;
      const count = getItemCount(chatStore.overlay.section);
      if (count === 0) return;
      setConfigItemIndex((prev) => {
        if (direction === 'up') {
          return (prev - 1 + count) % count;
        }
        return (prev + 1) % count;
      });
    },
    [chatStore.overlay, getItemCount],
  );

  const handleConfigToggle = useCallback(() => {
    if (chatStore.overlay.type !== 'config') return;
    const section = chatStore.overlay.section;

    if (section === 'options') {
      setDisplayToggles((prev) => {
        const toggleKeys = [
          'contextEnabled',
          'showExplanations',
          'syntaxHighlighting',
          'simpleMode',
        ] as const;
        const key = toggleKeys[configItemIndex];
        if (key) {
          const newValue = !prev[key];
          if (key === 'contextEnabled') {
            setConfig({ contextEnabled: newValue });
          }
          return { ...prev, [key]: newValue };
        }
        return prev;
      });
      return;
    }

    if (section === 'provider') {
      const newProvider = AI_PROVIDERS[configItemIndex];
      if (newProvider && newProvider !== currentProvider) {
        const newModel = PROVIDER_CONFIG[newProvider].defaultModel;
        setConfig({ provider: newProvider, model: newModel });
        setCurrentProvider(newProvider);
        setSelectedModel(newModel);
        setIsEditingCustomModel(false);
        refreshKeyStatus();
      }
      return;
    }

    if (section === 'model') {
      const models = PROVIDER_MODELS[currentProvider];
      const customModelIndex = models.length;

      if (configItemIndex === customModelIndex) {
        setIsEditingCustomModel(true);
      } else {
        const newModel = models[configItemIndex];
        if (newModel && newModel.id !== selectedModel) {
          setConfig({ model: newModel.id });
          setSelectedModel(newModel.id);
          setIsEditingCustomModel(false);
        }
      }
      return;
    }

    if (section === 'api-keys') {
      const provider = AI_PROVIDERS[configItemIndex];
      if (provider) {
        closeConfig();
        setEditingApiKeyProvider(provider);
        setIsEditingApiKey(true);
      }
      return;
    }
  }, [chatStore.overlay, configItemIndex, closeConfig, currentProvider, refreshKeyStatus, selectedModel]);

  const handleConfigClose = useCallback(() => {
    closeConfig();
    setConfigItemIndex(0);
    setIsEditingCustomModel(false);
  }, [closeConfig]);

  // Get palette query for input controller
  const paletteQuery = chatStore.overlay.type === 'palette' ? chatStore.overlay.query : '';

  const configItemCount = useMemo(() => {
    if (chatStore.overlay.type !== 'config') return 0;
    return getItemCount(chatStore.overlay.section);
  }, [chatStore.overlay, getItemCount]);

  const {
    textState,
    clearText,
    setText,
    paletteFocusIndex,
    customModelState,
    dispatchCustomModel,
  } = useInputController({
    mode: inputMode,
    paletteQuery,
    textCallbacks: {
      onSubmit: handleTextSubmit,
      onTextChange: handleTextChange,
      onExit: () => exit(),
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
    },
    agenticCallbacks: {
      onAbort: chatAgent.abort,
      onApprove: chatAgent.approvePermission,
      onDeny: chatAgent.denyPermission,
      onApproveSession: chatAgent.approveForSession,
      hasPendingPermission: chatStore.pendingPermission !== null,
      isAgentRunning: chatStore.isAgentRunning,
    },
    paletteCallbacks: {
      onQueryChange: handlePaletteQueryChange,
      onSelect: handlePaletteSelect,
      onNavigate: handlePaletteNavigate,
      onClose: handlePaletteClose,
      filteredCount: chatStore.overlay.type === 'palette' ? chatStore.overlay.filteredCommands.length : 0,
    },
    configCallbacks: {
      onNavigateSection: handleConfigNavigateSection,
      onJumpToSection: handleConfigJumpToSection,
      onNavigateItem: handleConfigNavigateItem,
      onToggle: handleConfigToggle,
      onClose: handleConfigClose,
      sectionCount: CONFIG_SECTIONS.length,
      itemCount: configItemCount,
      isEditingCustomModel,
      onCustomModelSubmit: (value: string) => {
        setConfig({ model: value });
        setSelectedModel(value);
        setIsEditingCustomModel(false);
      },
      onCustomModelCancel: () => {
        setIsEditingCustomModel(false);
      },
    },
    helpCallbacks: {
      onClose: closeHelp,
    },
  });

  // Initialize custom model state when entering edit mode
  useEffect(() => {
    if (isEditingCustomModel) {
      const isCurrentCustom = !PROVIDER_MODELS[currentProvider].some((m) => m.id === selectedModel);
      dispatchCustomModel({ type: 'set', value: isCurrentCustom ? selectedModel : '' });
    }
  }, [isEditingCustomModel, currentProvider, selectedModel, dispatchCustomModel]);

  if (configLoading) {
    return (
      <ThemeProvider>
        <Box flexDirection='column' paddingY={1}>
          <Text dimColor>Loading configuration...</Text>
        </Box>
      </ThemeProvider>
    );
  }

  if (isEditingApiKey || (!hasKey && !chatStore.isSetup)) {
    return (
      <ThemeProvider>
        <ApiKeySetup
          onComplete={handleApiKeyComplete}
          error={configError}
          provider={editingApiKeyProvider ?? undefined}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Box flexDirection='column'>
        {/* Compact status bar header */}
        <StatusBar />

        {/* Chat messages */}
        <ChatView
          messages={chatStore.messages}
          pendingPermission={chatStore.pendingPermission}
          streamingText={chatStore.streamingText}
        />

        {/* Command Palette */}
        <CommandPaletteDisplay
          query={chatStore.overlay.type === 'palette' ? chatStore.overlay.query : ''}
          filteredCommands={chatStore.overlay.type === 'palette' ? chatStore.overlay.filteredCommands : []}
          selectedIndex={paletteFocusIndex}
          visible={chatStore.overlay.type === 'palette'}
        />

        {/* Config Panel */}
        <ConfigPanelDisplay
          visible={chatStore.overlay.type === 'config'}
          activeSection={chatStore.overlay.type === 'config' ? chatStore.overlay.section : 'provider'}
          sectionItemIndex={configItemIndex}
          config={appConfig}
          hasApiKey={hasKey}
          storageInfo={storageInfo}
          maskedKey={maskedKey}
          toggles={displayToggles}
          isEditingCustomModel={isEditingCustomModel}
          customModelState={customModelState}
        />

        {/* Help Panel */}
        <HelpPanelDisplay visible={chatStore.overlay.type === 'help'} />

        {/* Ctrl+C hint when agent is running */}
        {chatStore.isAgentRunning && !chatStore.pendingPermission && (
          <Box>
            <Text dimColor>Ctrl+C to stop</Text>
          </Box>
        )}

        {/* Input prompt - always visible at the bottom */}
        <InputPromptDisplay
          textState={textState}
          placeholder='Type a message... (/ for commands)'
          disabled={chatStore.isAgentRunning || chatStore.isCompacting}
          visible={chatStore.overlay.type === 'none'}
        />

        {/* Inline Command Palette - shows below input when typing "/" */}
        {chatStore.overlay.type === 'none' && !chatStore.isAgentRunning && inlinePaletteCommands.length > 0 && (
          <Box flexDirection='column' marginLeft={2} marginTop={0}>
            <Box marginBottom={0}>
              <Text dimColor>{'─'.repeat(50)}</Text>
            </Box>
            {inlinePaletteCommands.slice(0, 5).map((cmd, index) => (
              <Box key={cmd.name}>
                <Text
                  color={index === inlinePaletteIndex ? '#cba6f7' : '#6c7086'}
                  bold={index === inlinePaletteIndex}
                >
                  {index === inlinePaletteIndex ? '> ' : '  '}
                </Text>
                <Text
                  color={index === inlinePaletteIndex ? '#cba6f7' : '#89b4fa'}
                  bold={index === inlinePaletteIndex}
                >
                  /{cmd.name}
                </Text>
                <Text> </Text>
                <Text color={index !== inlinePaletteIndex ? '#6c7086' : '#cdd6f4'}>{cmd.description}</Text>
              </Box>
            ))}
            <Box marginTop={0}>
              <Text color='#6c7086'>[Enter] Select [Up/Down] Navigate [Esc] Cancel</Text>
            </Box>
          </Box>
        )}

        {/* Footer bar */}
        <FooterBar
          cwd={process.cwd()}
          provider={currentProvider}
          model={selectedModel}
        />
      </Box>
    </ThemeProvider>
  );
}
