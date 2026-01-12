/**
 * Config panel display component - pure rendering, no input handling
 */

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

import { AVAILABLE_MODELS, type ConfigSection as ConfigSectionType } from '../../commands/types.js';
import { VERSION } from '../../constants.js';
import type { AppConfig } from '../../types/index.js';
import { ApiKeySection } from './ApiKeySection.js';
import { ConfigSection } from './ConfigSection.js';
import { ConfigSelect } from './ConfigSelect.js';
import { ConfigToggle } from './ConfigToggle.js';

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
}

const SECTIONS: ConfigSectionType[] = ['api-key', 'model', 'toggles', 'about'];

export function ConfigPanelDisplay({
  visible,
  activeSection,
  sectionItemIndex,
  config,
  hasApiKey,
  storageInfo,
  maskedKey,
  toggles,
}: ConfigPanelDisplayProps): ReactNode {
  if (!visible) {
    return null;
  }

  const activeSectionIndex = SECTIONS.indexOf(activeSection);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="blue"
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text color="cyan" bold>
            Settings
          </Text>
        </Box>
        <Box>
          <Text dimColor>[Esc] Close  [Tab] Section  [Enter] Select</Text>
        </Box>
      </Box>

      {/* API Key Section */}
      <ConfigSection title="API Key" isActive={activeSection === 'api-key'}>
        <ApiKeySection
          hasApiKey={hasApiKey}
          storageMethod={storageInfo.method}
          storageDescription={storageInfo.description}
          isSecure={storageInfo.secure}
          maskedKey={maskedKey}
          isSectionActive={activeSection === 'api-key'}
          focusedIndex={sectionItemIndex}
        />
      </ConfigSection>

      {/* Model Section */}
      <ConfigSection title="Model" isActive={activeSection === 'model'}>
        <ConfigSelect
          options={AVAILABLE_MODELS}
          selectedValue={config.model}
          focusedIndex={sectionItemIndex}
          isSectionActive={activeSection === 'model'}
        />
      </ConfigSection>

      {/* Toggles Section */}
      <ConfigSection title="Options" isActive={activeSection === 'toggles'}>
        <ConfigToggle
          label="Context (pass history to AI)"
          value={toggles.contextEnabled}
          isSelected={activeSection === 'toggles' && sectionItemIndex === 0}
        />
        <ConfigToggle
          label="Show explanations"
          value={toggles.showExplanations}
          isSelected={activeSection === 'toggles' && sectionItemIndex === 1}
        />
        <ConfigToggle
          label="Syntax highlighting"
          value={toggles.syntaxHighlighting}
          isSelected={activeSection === 'toggles' && sectionItemIndex === 2}
        />
        <ConfigToggle
          label="Simple mode"
          value={toggles.simpleMode}
          isSelected={activeSection === 'toggles' && sectionItemIndex === 3}
        />
      </ConfigSection>

      {/* About Section */}
      <ConfigSection title="About" isActive={activeSection === 'about'}>
        <Box flexDirection="column">
          <Box>
            <Text dimColor>Version: </Text>
            <Text>CLI AI v{VERSION}</Text>
          </Box>
          <Box>
            <Text dimColor>Storage: </Text>
            <Text color={storageInfo.secure ? 'green' : 'yellow'}>
              {storageInfo.description}
            </Text>
          </Box>
        </Box>
      </ConfigSection>

      {/* Footer with section indicators */}
      <Box marginTop={1} justifyContent="center">
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
