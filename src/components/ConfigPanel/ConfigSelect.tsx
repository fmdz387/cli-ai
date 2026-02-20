/**
 * Selection component for config panel (e.g., model selection)
 */
import { useTheme } from '../../theme/index.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface ConfigSelectOption {
  id: string;
  name: string;
  description?: string;
}

export interface ConfigSelectProps {
  options: readonly ConfigSelectOption[];
  selectedValue: string;
  focusedIndex: number;
  isSectionActive: boolean;
}

export function ConfigSelect({
  options,
  selectedValue,
  focusedIndex,
  isSectionActive,
}: ConfigSelectProps): ReactNode {
  const theme = useTheme();

  return (
    <Box flexDirection="column">
      {options.map((option, index) => {
        const isSelected = option.id === selectedValue;
        const isFocused = isSectionActive && index === focusedIndex;

        return (
          <Box key={option.id}>
            <Text color={isFocused ? theme.primary : theme.textMuted} bold={isFocused}>
              {isFocused ? '> ' : '  '}
            </Text>
            <Text color={isSelected ? theme.success : isFocused ? theme.text : theme.textMuted}>
              {isSelected ? '(*) ' : '( ) '}
            </Text>
            <Text color={isFocused ? theme.text : theme.textMuted} bold={isSelected}>
              {option.name}
            </Text>
            {option.description ? (
              <>
                <Text color={theme.textMuted}> - </Text>
                <Text color={theme.textMuted}>{option.description}</Text>
              </>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
