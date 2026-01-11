/**
 * Options menu component for command actions
 * Uses always-mounted pattern with display='none' to prevent useInput issues
 */

import { Box, Text, useInput } from 'ink';
import { useEffect, useState, type ReactNode } from 'react';

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
  action: MenuAction;
  label: string;
}

interface OptionsMenuProps {
  onSelect: (action: MenuAction) => void;
  disabled?: boolean;
  showExplain?: boolean;
  visible?: boolean;
}

const MENU_OPTIONS: MenuOption[] = [
  { key: '1', action: 'execute', label: 'Execute' },
  { key: '2', action: 'copy', label: 'Copy' },
  { key: '3', action: 'edit', label: 'Edit' },
  { key: '4', action: 'alternatives', label: 'Alternatives' },
  { key: '5', action: 'cancel', label: 'Cancel' },
];

export function OptionsMenu({
  onSelect,
  disabled = false,
  showExplain = true,
  visible = true,
}: OptionsMenuProps): ReactNode {
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (visible) {
      setFocusedIndex(0);
    }
  }, [visible]);

  useInput(
    (input, key) => {
      if (key.leftArrow) {
        setFocusedIndex((prev) => (prev - 1 + MENU_OPTIONS.length) % MENU_OPTIONS.length);
        return;
      }

      if (key.rightArrow) {
        setFocusedIndex((prev) => (prev + 1) % MENU_OPTIONS.length);
        return;
      }

      if (key.return) {
        const option = MENU_OPTIONS[focusedIndex];
        if (option) {
          onSelect(option.action);
        }
        return;
      }

      const numKey = parseInt(input, 10);
      if (numKey >= 1 && numKey <= 5) {
        const option = MENU_OPTIONS[numKey - 1];
        if (option) {
          onSelect(option.action);
        }
        return;
      }

      if (input === '?' && showExplain) {
        onSelect('explain');
        return;
      }

      if (input.toLowerCase() === 'o') {
        onSelect('toggle');
        return;
      }

      if (key.escape) {
        onSelect('cancel');
        return;
      }
    },
    { isActive: visible && !disabled }
  );

  return (
    <Box flexDirection="column" marginTop={1} display={visible ? 'flex' : 'none'}>
      <Box flexDirection="row" gap={1}>
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

interface SelectionMenuProps {
  count: number;
  onSelect: (index: number) => void;
  onCancel: () => void;
  disabled?: boolean;
  visible?: boolean;
}

export function SelectionMenu({
  count,
  onSelect,
  onCancel,
  disabled = false,
  visible = true,
}: SelectionMenuProps): ReactNode {
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (visible) {
      setFocusedIndex(0);
    }
  }, [visible, count]);

  useInput(
    (input, key) => {
      if (key.upArrow) {
        setFocusedIndex((prev) => (prev - 1 + count) % count);
        return;
      }

      if (key.downArrow) {
        setFocusedIndex((prev) => (prev + 1) % count);
        return;
      }

      if (key.return) {
        onSelect(focusedIndex);
        return;
      }

      const numKey = parseInt(input, 10);
      if (numKey >= 1 && numKey <= count) {
        onSelect(numKey - 1);
        return;
      }

      if (input === '5' || input.toLowerCase() === 'c' || key.escape) {
        onCancel();
        return;
      }
    },
    { isActive: visible && !disabled }
  );

  return (
    <Box display={visible ? 'flex' : 'none'}>
      <Text dimColor>
        Press <Text color="blue">1-{count}</Text> or <Text color="blue">↑↓</Text> to select,{' '}
        <Text color="blue">[5]</Text> Cancel
      </Text>
    </Box>
  );
}
