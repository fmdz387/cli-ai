/**
 * Toggle switch component for config panel
 */
import { useTheme } from '../../theme/index.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface ConfigToggleProps {
  label: string;
  value: boolean;
  isSelected: boolean;
}

export function ConfigToggle({ label, value, isSelected }: ConfigToggleProps): ReactNode {
  const theme = useTheme();

  return (
    <Box>
      <Text color={isSelected ? theme.primary : theme.textMuted} bold={isSelected}>
        {isSelected ? '> ' : '  '}
      </Text>
      <Text color={value ? theme.success : theme.textMuted}>{value ? '[x]' : '[ ]'}</Text>
      <Text> </Text>
      <Text color={isSelected ? theme.text : theme.textMuted}>{label}</Text>
    </Box>
  );
}
