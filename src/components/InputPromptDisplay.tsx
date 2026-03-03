/**
 * Input prompt display component with panel border and metadata
 */
import { useTheme } from '../theme/index.js';
import { Panel, ShadowLine } from './ui/Panel.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { ControlledTextInput, type TextInputState } from './ControlledTextInput.js';

interface InputPromptDisplayProps {
  textState: TextInputState;
  placeholder?: string;
  disabled?: boolean;
  visible?: boolean;
  isAgentRunning?: boolean;
}

export function InputPromptDisplay({
  textState,
  placeholder = 'Describe what you want to do...',
  disabled = false,
  visible = true,
  isAgentRunning = false,
}: InputPromptDisplayProps): ReactNode {
  const theme = useTheme();

  if (!visible) {
    return null;
  }

  const borderColor = isAgentRunning ? theme.warning : disabled ? theme.border : theme.primary;

  if (disabled) {
    return (
      <Box flexDirection="column">
        <Panel borderColor={borderColor}>
          <Text color={theme.textMuted}>{textState.value || '...'}</Text>
        </Panel>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Panel borderColor={borderColor} paddingLeft={1}>
        <ControlledTextInput
          value={textState.value}
          cursorOffset={textState.cursorOffset}
          placeholder={placeholder}
          isDisabled={disabled}
        />
        <Box justifyContent="flex-end" width={(process.stdout.columns || 80) - 6}>
          <Text color={theme.textMuted}>ctrl+p commands {'\u00B7'} ? help</Text>
        </Box>
      </Panel>
      <ShadowLine color={theme.border} />
    </Box>
  );
}
