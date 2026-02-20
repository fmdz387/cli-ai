/**
 * Input prompt display component with panel border and metadata
 */
import { useTheme } from '../theme/index.js';
import { PROVIDER_CONFIG } from '../constants.js';
import type { AIProvider } from '../types/index.js';
import { Panel, ShadowLine } from './ui/Panel.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { ControlledTextInput, type TextInputState } from './ControlledTextInput.js';

interface InputPromptDisplayProps {
  textState: TextInputState;
  placeholder?: string;
  disabled?: boolean;
  hasHistory?: boolean;
  visible?: boolean;
  provider?: AIProvider;
  model?: string;
}

export function InputPromptDisplay({
  textState,
  placeholder = 'Describe what you want to do...',
  disabled = false,
  hasHistory = false,
  visible = true,
  provider,
  model,
}: InputPromptDisplayProps): ReactNode {
  const theme = useTheme();

  if (!visible) {
    return null;
  }

  if (disabled) {
    return (
      <Box flexDirection="column">
        <Panel borderColor={theme.border}>
          <Text color={theme.textMuted}>{textState.value || '...'}</Text>
        </Panel>
      </Box>
    );
  }

  const providerName = provider ? PROVIDER_CONFIG[provider].name : undefined;

  return (
    <Box flexDirection="column">
      <Panel borderColor={theme.primary} paddingLeft={1}>
        <Box flexDirection="column">
          <ControlledTextInput
            value={textState.value}
            cursorOffset={textState.cursorOffset}
            placeholder={placeholder}
            isDisabled={disabled}
          />
          {providerName && model && (
            <Box>
              <Text color={theme.textMuted}>{providerName} / {model}</Text>
            </Box>
          )}
        </Box>
      </Panel>
      <ShadowLine color={theme.border} />
    </Box>
  );
}
