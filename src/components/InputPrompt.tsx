/**
 * User input prompt component
 * Uses always-mounted pattern - TextInput must stay mounted to prevent stdin issues
 */

import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface InputPromptProps {
  onSubmit: (query: string) => void;
  onToggleOutput?: () => void;
  disabled?: boolean;
  initialValue?: string;
  placeholder?: string;
  hasHistory?: boolean;
  visible?: boolean;
}

export function InputPrompt({
  onSubmit,
  onToggleOutput,
  disabled = false,
  initialValue = '',
  placeholder = 'Describe what you want to do...',
  hasHistory = false,
  visible = true,
}: InputPromptProps): ReactNode {
  const [value, setValue] = useState(initialValue);
  const prevInitialValueRef = useRef(initialValue);
  const [textInputKey, setTextInputKey] = useState(0);

  useEffect(() => {
    if (prevInitialValueRef.current !== initialValue) {
      setValue(initialValue);
      prevInitialValueRef.current = initialValue;
      // Force TextInput remount to pick up new defaultValue
      setTextInputKey((k) => k + 1);
    }
  }, [initialValue]);

  useEffect(() => {
    if (visible && !initialValue) {
      setValue('');
    }
  }, [visible, initialValue]);

  useInput(
    (_input, key) => {
      if (key.ctrl && key.meta === false && _input === 'd') {
        if (value.trim() === '') {
          process.exit(130);
        }
      }

      if (_input.toLowerCase() === 'o' && value.trim() === '' && onToggleOutput && hasHistory) {
        onToggleOutput();
      }
    },
    { isActive: visible && !disabled }
  );

  const handleChange = useCallback(
    (newValue: string) => {
      if (newValue.toLowerCase() === 'o' && hasHistory && onToggleOutput) {
        return;
      }
      setValue(newValue);
    },
    [hasHistory, onToggleOutput]
  );

  const handleSubmit = useCallback(
    (submittedValue: string) => {
      const trimmed = submittedValue.trim();

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        process.exit(0);
      }

      if (!trimmed) {
        return;
      }

      setValue('');
      onSubmit(trimmed);
    },
    [onSubmit]
  );

  const isInputDisabled = !visible || disabled;

  if (visible && disabled) {
    return (
      <Box>
        <Text dimColor>{'> '}</Text>
        <Text dimColor>{value || '...'}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" display={visible ? 'flex' : 'none'}>
      <Box>
        <Text color="green" bold>
          {'> '}
        </Text>
        <TextInput
          key={textInputKey}
          placeholder={placeholder}
          defaultValue={initialValue}
          onChange={handleChange}
          onSubmit={handleSubmit}
          isDisabled={isInputDisabled}
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
