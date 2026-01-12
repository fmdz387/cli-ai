/**
 * Toggle switch component for config panel
 */

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface ConfigToggleProps {
  label: string;
  value: boolean;
  isSelected: boolean;
}

export function ConfigToggle({ label, value, isSelected }: ConfigToggleProps): ReactNode {
  return (
    <Box>
      <Text color={isSelected ? 'cyan' : 'gray'} bold={isSelected}>
        {isSelected ? '> ' : '  '}
      </Text>
      <Text color={value ? 'green' : 'gray'}>{value ? '[x]' : '[ ]'}</Text>
      <Text> </Text>
      <Text color={isSelected ? 'white' : 'gray'}>{label}</Text>
    </Box>
  );
}
