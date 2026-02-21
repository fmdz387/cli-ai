import {
  CUSTOM_MODEL_OPTION,
  PROVIDER_MODELS,
  type ConfigSection as ConfigSectionType,
} from '../../commands/types.js';
import { AI_PROVIDERS, PROVIDER_CONFIG, VERSION } from '../../constants.js';
import { hasApiKey as checkHasApiKey } from '../../lib/secure-storage.js';
import { useTheme } from '../../theme/index.js';
import type { AppConfig } from '../../types/index.js';
import { ControlledTextInput, type TextInputState } from '../ControlledTextInput.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface StorageInfo {
  method: 'env' | 'keyring' | 'encrypted-file' | 'none';
  secure: boolean;
  description: string;
}

export interface ConfigPanelDisplayProps {
  visible: boolean;
  activeSection: ConfigSectionType;
  sectionItemIndex: number;
  config: AppConfig;
  hasApiKey: boolean;
  storageInfo: StorageInfo;
  maskedKey: string | null;
  toggles: {
    showExplanations: boolean;
    syntaxHighlighting: boolean;
    simpleMode: boolean;
    contextEnabled: boolean;
  };
  isEditingCustomModel?: boolean;
  customModelState?: TextInputState;
}

interface TabDef {
  readonly id: ConfigSectionType;
  readonly label: string;
  readonly key: string;
}

const TABS: readonly TabDef[] = [
  { id: 'provider', label: 'Provider', key: '1' },
  { id: 'model', label: 'Model', key: '2' },
  { id: 'api-keys', label: 'API Keys', key: '3' },
  { id: 'options', label: 'Options', key: '4' },
  { id: 'about', label: 'About', key: '5' },
] as const;

interface ToggleDef {
  readonly key: string;
  readonly label: string;
  readonly description: string;
}

const TOGGLE_DEFS: readonly ToggleDef[] = [
  { key: 'contextEnabled', label: 'Context', description: 'Pass conversation history to AI' },
  { key: 'showExplanations', label: 'Explanations', description: 'Show command explanations' },
  { key: 'syntaxHighlighting', label: 'Syntax highlighting', description: 'Highlight command syntax' },
  { key: 'simpleMode', label: 'Simple mode', description: 'Minimal interface' },
] as const;

// --- Shared layout helpers ---

function Divider(): ReactNode {
  const theme = useTheme();
  return (
    <Box>
      <Text color={theme.border}>{'\u2500'.repeat(58)}</Text>
    </Box>
  );
}

function SectionDescription({ text }: { text: string }): ReactNode {
  const theme = useTheme();
  return (
    <Box marginBottom={1}>
      <Text color={theme.textMuted} dimColor>
        {text}
      </Text>
    </Box>
  );
}

function ItemRow({
  isFocused,
  children,
}: {
  isFocused: boolean;
  children: ReactNode;
}): ReactNode {
  const theme = useTheme();
  return (
    <Box>
      <Text color={isFocused ? theme.primary : theme.textMuted} bold={isFocused}>
        {isFocused ? '> ' : '  '}
      </Text>
      {children}
    </Box>
  );
}

// --- Tab content components ---

function ProviderContent({
  config,
  focusIndex,
}: {
  config: AppConfig;
  focusIndex: number;
}): ReactNode {
  const theme = useTheme();

  return (
    <Box flexDirection='column'>
      <SectionDescription text='Select your AI provider' />
      {AI_PROVIDERS.map((provider, index) => {
        const providerCfg = PROVIDER_CONFIG[provider];
        const isSelected = config.provider === provider;
        const providerHasKey = checkHasApiKey(provider);
        const isFocused = focusIndex === index;

        return (
          <ItemRow key={provider} isFocused={isFocused}>
            <Text
              color={isSelected ? theme.success : isFocused ? theme.text : theme.textMuted}
              bold={isSelected}
            >
              {isSelected ? '\u25CF' : '\u25CB'} {providerCfg.name}
            </Text>
            <Text> </Text>
            <Text color={providerHasKey ? theme.success : theme.error}>
              {providerHasKey ? '\u2713 Key' : '\u2717 No key'}
            </Text>
          </ItemRow>
        );
      })}
    </Box>
  );
}

function ModelContent({
  config,
  focusIndex,
  isEditingCustomModel,
  customModelState,
  isCustomModel,
}: {
  config: AppConfig;
  focusIndex: number;
  isEditingCustomModel: boolean;
  customModelState?: TextInputState;
  isCustomModel: boolean;
}): ReactNode {
  const theme = useTheme();
  const currentModels = PROVIDER_MODELS[config.provider];
  const customIndex = currentModels.length;

  return (
    <Box flexDirection='column'>
      <SectionDescription
        text={`Choose a model for ${PROVIDER_CONFIG[config.provider].name}`}
      />
      {currentModels.map((model, index) => {
        const isSelected = config.model === model.id;
        const isFocused = focusIndex === index;

        return (
          <ItemRow key={model.id} isFocused={isFocused}>
            <Text
              color={isSelected ? theme.success : isFocused ? theme.text : theme.textMuted}
              bold={isSelected}
            >
              {isSelected ? '\u25CF' : '\u25CB'} {model.name}
            </Text>
            <Text color={theme.textMuted} dimColor>
              {' '}
              {model.description}
            </Text>
          </ItemRow>
        );
      })}

      {/* Custom model option */}
      <ItemRow isFocused={focusIndex === customIndex}>
        {isEditingCustomModel && customModelState ? (
          <>
            <Text color={theme.primary}>{'\u25CB '}</Text>
            <ControlledTextInput
              value={customModelState.value}
              cursorOffset={customModelState.cursorOffset}
              placeholder='model-id'
            />
            <Text color={theme.textMuted} dimColor>
              {' '}
              (Enter save, Esc cancel)
            </Text>
          </>
        ) : (
          <>
            <Text
              color={
                isCustomModel
                  ? theme.success
                  : focusIndex === customIndex
                    ? theme.text
                    : theme.textMuted
              }
              bold={isCustomModel}
            >
              {isCustomModel ? '\u25CF' : '\u25CB'} {CUSTOM_MODEL_OPTION.name}
            </Text>
            <Text color={theme.textMuted} dimColor>
              {' '}
              {isCustomModel ? `(${config.model})` : CUSTOM_MODEL_OPTION.description}
            </Text>
          </>
        )}
      </ItemRow>
    </Box>
  );
}

function ApiKeysContent({
  focusIndex,
}: {
  focusIndex: number;
}): ReactNode {
  const theme = useTheme();

  return (
    <Box flexDirection='column'>
      <SectionDescription text='Manage API keys for each provider' />
      {AI_PROVIDERS.map((provider, index) => {
        const providerCfg = PROVIDER_CONFIG[provider];
        const providerHasKey = checkHasApiKey(provider);
        const isFocused = focusIndex === index;

        return (
          <ItemRow key={provider} isFocused={isFocused}>
            <Text color={isFocused ? theme.text : theme.textMuted}>{providerCfg.name}</Text>
            <Text> </Text>
            <Text color={providerHasKey ? theme.success : theme.error}>
              {providerHasKey ? '\u2713 Configured' : '\u2717 Not set'}
            </Text>
            <Text color={theme.textMuted} dimColor>
              {' '}
              [Enter to {providerHasKey ? 'change' : 'add'}]
            </Text>
          </ItemRow>
        );
      })}
    </Box>
  );
}

function OptionsContent({
  toggles,
  focusIndex,
}: {
  toggles: Record<string, boolean>;
  focusIndex: number;
}): ReactNode {
  const theme = useTheme();

  return (
    <Box flexDirection='column'>
      <SectionDescription text='Customize your experience' />
      {TOGGLE_DEFS.map((opt, index) => {
        const value = toggles[opt.key] ?? false;
        const isFocused = focusIndex === index;

        return (
          <ItemRow key={opt.key} isFocused={isFocused}>
            <Text color={value ? theme.success : theme.textMuted}>
              {value ? '[\u2713]' : '[ ]'}
            </Text>
            <Text color={isFocused ? theme.text : theme.textMuted}> {opt.label}</Text>
            <Text color={theme.textMuted} dimColor>
              {'  '}
              {opt.description}
            </Text>
          </ItemRow>
        );
      })}
    </Box>
  );
}

function AboutContent({
  config,
  storageInfo,
}: {
  config: AppConfig;
  storageInfo: StorageInfo;
}): ReactNode {
  const theme = useTheme();
  const PAD = 12;

  const rows: readonly { label: string; value: string; color: string }[] = [
    { label: 'Version', value: `CLI AI v${VERSION}`, color: theme.text },
    { label: 'Provider', value: PROVIDER_CONFIG[config.provider].name, color: theme.accent },
    { label: 'Model', value: config.model, color: theme.accent },
    {
      label: 'Storage',
      value: storageInfo.description,
      color: storageInfo.secure ? theme.success : theme.warning,
    },
  ];

  return (
    <Box flexDirection='column'>
      <SectionDescription text='Application information' />
      {rows.map((row) => (
        <Box key={row.label}>
          <Text color={theme.textMuted} dimColor>
            {row.label.padEnd(PAD)}
          </Text>
          <Text color={row.color}>{row.value}</Text>
        </Box>
      ))}
    </Box>
  );
}

// --- Main panel ---

export function ConfigPanelDisplay({
  visible,
  activeSection,
  sectionItemIndex,
  config,
  hasApiKey,
  storageInfo,
  maskedKey,
  toggles,
  isEditingCustomModel = false,
  customModelState,
}: ConfigPanelDisplayProps): ReactNode {
  const theme = useTheme();

  if (!visible) return null;

  const currentModels = PROVIDER_MODELS[config.provider];
  const isCustomModel = !currentModels.some((m) => m.id === config.model);

  return (
    <Box
      flexDirection='column'
      borderStyle='round'
      borderColor={theme.border}
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box justifyContent='space-between' marginBottom={1}>
        <Text color={theme.primary} bold>
          Settings
        </Text>
        <Text color={theme.textMuted} dimColor>
          Esc to close
        </Text>
      </Box>

      {/* Tab bar */}
      <Box>
        {TABS.map((tab) => {
          const isActive = activeSection === tab.id;
          return (
            <Box key={tab.id} marginRight={1}>
              <Text
                color={isActive ? theme.primary : theme.textMuted}
                bold={isActive}
                dimColor={!isActive}
              >
                {tab.key}{'\u00B7'}
                {tab.label}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Divider />

      {/* Active tab content */}
      <Box flexDirection='column' marginY={1} minHeight={5}>
        {activeSection === 'provider' && (
          <ProviderContent config={config} focusIndex={sectionItemIndex} />
        )}
        {activeSection === 'model' && (
          <ModelContent
            config={config}
            focusIndex={sectionItemIndex}
            isEditingCustomModel={isEditingCustomModel}
            customModelState={customModelState}
            isCustomModel={isCustomModel}
          />
        )}
        {activeSection === 'api-keys' && <ApiKeysContent focusIndex={sectionItemIndex} />}
        {activeSection === 'options' && (
          <OptionsContent toggles={toggles} focusIndex={sectionItemIndex} />
        )}
        {activeSection === 'about' && <AboutContent config={config} storageInfo={storageInfo} />}
      </Box>

      <Divider />

      {/* Footer key hints */}
      <Box marginTop={0}>
        <Text color={theme.textMuted} dimColor>
          {isEditingCustomModel
            ? 'Enter Save  Esc Cancel'
            : '\u2190/\u2192 Tab  \u2191/\u2193 Navigate  Enter Select  Esc Close'}
        </Text>
      </Box>
    </Box>
  );
}
