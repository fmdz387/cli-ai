/**
 * Input prompt display component (pure display, no input handling)
 */

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
  if (!visible) {
    return null;
  }

  if (disabled) {
    return (
      <Box>
        <Text dimColor>{'> '}</Text>
        <Text dimColor>{textState.value || '...'}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="green" bold>
          {'> '}
        </Text>
        <ControlledTextInput
          value={textState.value}
          cursorOffset={textState.cursorOffset}
          placeholder={placeholder}
          isDisabled={disabled}
        />
      </Box>
      {hasHistory && (
        <Box marginTop={1}>
          <Text dimColor>
            <Text color="blue">[O]</Text> Toggle output
          </Text>
        </Box>
      )}
    </Box>
  );
}
