import {
  CUSTOM_MODEL_OPTION,
  PROVIDER_MODELS,
  type ConfigSection as ConfigSectionType,
} from '../../commands/types.js';
import { AI_PROVIDERS, PROVIDER_CONFIG, VERSION } from '../../constants.js';
import { hasApiKey as checkHasApiKey } from '../../lib/secure-storage.js';
import type { AppConfig } from '../../types/index.js';
import { ControlledTextInput, type TextInputState } from '../ControlledTextInput.js';
import { ConfigSection } from './ConfigSection.js';
import { ConfigToggle } from './ConfigToggle.js';

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

const SECTIONS: ConfigSectionType[] = ['provider', 'api-keys', 'toggles', 'about'];

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
  if (!visible) {
    return null;
  }

  const activeSectionIndex = SECTIONS.indexOf(activeSection);
  const currentModels = PROVIDER_MODELS[config.provider];
  const isCustomModel = !currentModels.some((m) => m.id === config.model);
  const customModelIndex = AI_PROVIDERS.length + currentModels.length;

  return (
    <Box flexDirection='column' borderStyle='round' borderColor='blue' paddingX={2} paddingY={1}>
      <Box justifyContent='space-between' marginBottom={1}>
        <Box>
          <Text color='cyan' bold>
            Settings
          </Text>
        </Box>
        <Box>
          <Text dimColor>[Esc] Close [Tab] Section [Enter] Select</Text>
        </Box>
      </Box>

      <ConfigSection title='Provider & Model' isActive={activeSection === 'provider'}>
        <Box flexDirection='column'>
          <Box marginBottom={1}>
            <Text dimColor>Provider</Text>
          </Box>
          {AI_PROVIDERS.map((provider, index) => {
            const providerConfig = PROVIDER_CONFIG[provider];
            const isSelected = config.provider === provider;
            const providerHasKey = checkHasApiKey(provider);
            const isFocused = activeSection === 'provider' && sectionItemIndex === index;
            return (
              <Box key={provider}>
                <Text color={isFocused ? 'cyan' : 'gray'} bold={isFocused}>
                  {isFocused ? '> ' : '  '}
                </Text>
                <Text color={isFocused ? 'cyan' : isSelected ? 'green' : 'white'}>
                  {isSelected ? '●' : '○'} {providerConfig.name}
                </Text>
                <Text> </Text>
                <Text color={providerHasKey ? 'green' : 'red'} dimColor={!isFocused}>
                  {providerHasKey ? '✓ Key' : '✗ No key'}
                </Text>
              </Box>
            );
          })}
          <Box marginTop={1} marginBottom={1}>
            <Text dimColor>Model</Text>
          </Box>
          {currentModels.map((model, index) => {
            const modelIndex = index + AI_PROVIDERS.length;
            const isSelected = config.model === model.id;
            const isFocused = activeSection === 'provider' && sectionItemIndex === modelIndex;
            return (
              <Box key={model.id}>
                <Text color={isFocused ? 'cyan' : 'gray'} bold={isFocused}>
                  {isFocused ? '> ' : '  '}
                </Text>
                <Text color={isFocused ? 'cyan' : isSelected ? 'green' : 'white'}>
                  {isSelected ? '●' : '○'} {model.name}
                </Text>
                <Text dimColor={!isFocused}> {model.description}</Text>
              </Box>
            );
          })}
          <Box key={CUSTOM_MODEL_OPTION.id}>
            <Text
              color={
                activeSection === 'provider' && sectionItemIndex === customModelIndex
                  ? 'cyan'
                  : 'gray'
              }
              bold={activeSection === 'provider' && sectionItemIndex === customModelIndex}
            >
              {activeSection === 'provider' && sectionItemIndex === customModelIndex ? '> ' : '  '}
            </Text>
            {isEditingCustomModel && customModelState ? (
              <>
                <Text color='cyan'>{'○ '}</Text>
                <ControlledTextInput
                  value={customModelState.value}
                  cursorOffset={customModelState.cursorOffset}
                  placeholder='model-id'
                />
                <Text dimColor> (Enter to save, Esc to cancel)</Text>
              </>
            ) : (
              <>
                <Text
                  color={
                    activeSection === 'provider' && sectionItemIndex === customModelIndex
                      ? 'cyan'
                      : isCustomModel
                        ? 'green'
                        : 'white'
                  }
                >
                  {isCustomModel ? '●' : '○'} {CUSTOM_MODEL_OPTION.name}
                </Text>
                <Text
                  dimColor={
                    !(activeSection === 'provider' && sectionItemIndex === customModelIndex)
                  }
                >
                  {' '}
                  {isCustomModel ? `(${config.model})` : CUSTOM_MODEL_OPTION.description}
                </Text>
              </>
            )}
          </Box>
        </Box>
      </ConfigSection>

      <ConfigSection title='API Keys' isActive={activeSection === 'api-keys'}>
        <Box flexDirection='column'>
          {AI_PROVIDERS.map((provider, index) => {
            const providerConfig = PROVIDER_CONFIG[provider];
            const providerHasKey = checkHasApiKey(provider);
            const isFocused = activeSection === 'api-keys' && sectionItemIndex === index;
            return (
              <Box key={provider}>
                <Text color={isFocused ? 'cyan' : 'gray'} bold={isFocused}>
                  {isFocused ? '> ' : '  '}
                </Text>
                <Text color={isFocused ? 'cyan' : 'white'}>{providerConfig.name}: </Text>
                <Text color={providerHasKey ? 'green' : 'red'}>
                  {providerHasKey ? '✓ Configured' : '✗ Not set'}
                </Text>
                <Text dimColor={!isFocused}> [Enter to {providerHasKey ? 'change' : 'add'}]</Text>
              </Box>
            );
          })}
        </Box>
      </ConfigSection>

      <ConfigSection title='Options' isActive={activeSection === 'toggles'}>
        <ConfigToggle
          label='Context (pass history to AI)'
          value={toggles.contextEnabled}
          isSelected={activeSection === 'toggles' && sectionItemIndex === 0}
        />
        <ConfigToggle
          label='Show explanations'
          value={toggles.showExplanations}
          isSelected={activeSection === 'toggles' && sectionItemIndex === 1}
        />
        <ConfigToggle
          label='Syntax highlighting'
          value={toggles.syntaxHighlighting}
          isSelected={activeSection === 'toggles' && sectionItemIndex === 2}
        />
        <ConfigToggle
          label='Simple mode'
          value={toggles.simpleMode}
          isSelected={activeSection === 'toggles' && sectionItemIndex === 3}
        />
      </ConfigSection>

      <ConfigSection title='About' isActive={activeSection === 'about'}>
        <Box flexDirection='column'>
          <Box>
            <Text dimColor>Version: </Text>
            <Text>CLI AI v{VERSION}</Text>
          </Box>
          <Box>
            <Text dimColor>Provider: </Text>
            <Text color='magenta'>{PROVIDER_CONFIG[config.provider].name}</Text>
          </Box>
          <Box>
            <Text dimColor>Model: </Text>
            <Text color='magenta'>{config.model}</Text>
          </Box>
          <Box>
            <Text dimColor>Storage: </Text>
            <Text color={storageInfo.secure ? 'green' : 'yellow'}>{storageInfo.description}</Text>
          </Box>
        </Box>
      </ConfigSection>

      <Box marginTop={1} justifyContent='center'>
        {SECTIONS.map((section, index) => (
          <Box key={section} marginX={1}>
            <Text color={index === activeSectionIndex ? 'cyan' : 'gray'}>
              {index === activeSectionIndex ? '[' : ' '}
              {index + 1}
              {index === activeSectionIndex ? ']' : ' '}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
