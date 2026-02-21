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
  hasHistory?: boolean;
  visible?: boolean;
}

export function InputPromptDisplay({
  textState,
  placeholder = 'Describe what you want to do...',
  disabled = false,
  hasHistory = false,
  visible = true,
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

  return (
    <Box flexDirection="column">
      <Panel borderColor={theme.primary} paddingLeft={1}>
        <ControlledTextInput
          value={textState.value}
          cursorOffset={textState.cursorOffset}
          placeholder={placeholder}
          isDisabled={disabled}
        />
      </Panel>
      <ShadowLine color={theme.border} />
    </Box>
  );
}
