/**
 * Selection component for config panel (e.g., model selection)
 */

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
  return (
    <Box flexDirection="column">
      {options.map((option, index) => {
        const isSelected = option.id === selectedValue;
        const isFocused = isSectionActive && index === focusedIndex;

        return (
          <Box key={option.id}>
            <Text color={isFocused ? 'cyan' : 'gray'} bold={isFocused}>
              {isFocused ? '> ' : '  '}
            </Text>
            <Text color={isSelected ? 'green' : isFocused ? 'white' : 'gray'}>
              {isSelected ? '(*) ' : '( ) '}
            </Text>
            <Text color={isFocused ? 'white' : 'gray'} bold={isSelected}>
              {option.name}
            </Text>
            {option.description ? (
              <>
                <Text dimColor> - </Text>
                <Text dimColor>{option.description}</Text>
              </>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
