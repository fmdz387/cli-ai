/**
 * Options menu display component (pure display, no input handling)
 */

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export type MenuAction =
  | 'execute'
  | 'copy'
  | 'edit'
  | 'alternatives'
  | 'cancel'
  | 'explain'
  | 'toggle';

interface MenuOption {
  key: string;
  label: string;
}

const MENU_OPTIONS: MenuOption[] = [
  { key: '1', label: 'Execute' },
  { key: '2', label: 'Copy' },
  { key: '3', label: 'Edit' },
  { key: '4', label: 'Alternatives' },
  { key: '5', label: 'Cancel' },
];

interface OptionsMenuDisplayProps {
  focusedIndex: number;
  showExplain?: boolean;
  visible?: boolean;
}

export function OptionsMenuDisplay({
  focusedIndex,
  showExplain = true,
  visible = true,
}: OptionsMenuDisplayProps): ReactNode {
  if (!visible) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection='row' gap={1}>
        {MENU_OPTIONS.map((option, index) => {
          const isFocused = index === focusedIndex;

          return (
            <Box key={option.key}>
              <Text
                color={isFocused ? 'cyan' : 'blue'}
                bold={isFocused}
                inverse={isFocused}
              >
                [{option.key}]
              </Text>
              <Text
                color={isFocused ? 'cyan' : undefined}
                bold={isFocused}
              >
                {' '}{option.label}
              </Text>
            </Box>
          );
        })}
      </Box>

      {showExplain && (
        <Box marginTop={1}>
          <Text dimColor>
            <Text color="blue">[?]</Text> Explain{' '}
            <Text color="blue">[O]</Text> Toggle output{' '}
            <Text dimColor>| ←→ Navigate, Enter Select</Text>
          </Text>
        </Box>
      )}
    </Box>
  );
}

interface SelectionMenuDisplayProps {
  count: number;
  focusedIndex: number;
  visible?: boolean;
}

export function SelectionMenuDisplay({
  count,
  focusedIndex,
  visible = true,
}: SelectionMenuDisplayProps): ReactNode {
  if (!visible) {
    return null;
  }

  return (
    <Box>
      <Text dimColor>
        Press <Text color="blue">1-{count}</Text> or <Text color="blue">↑↓</Text> to select,{' '}
        <Text color="blue">[5]</Text> Cancel
        {focusedIndex >= 0 && (
          <Text color="cyan"> (focused: {focusedIndex + 1})</Text>
        )}
      </Text>
    </Box>
  );
}
