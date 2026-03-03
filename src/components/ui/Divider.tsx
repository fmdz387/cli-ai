/**
 * Horizontal divider line component
 */
import { Text } from 'ink';
import type { ReactNode } from 'react';

import { useTheme } from '../../theme/index.js';

interface DividerProps {
  width?: number;
  char?: string;
  color?: string;
}

export function Divider({ width, char = '─', color }: DividerProps): ReactNode {
  const theme = useTheme();
  const c = color ?? theme.border;
  const w = width ?? (process.stdout.columns || 80) - 4;
  return <Text color={c}>{char.repeat(Math.max(10, w))}</Text>;
}
