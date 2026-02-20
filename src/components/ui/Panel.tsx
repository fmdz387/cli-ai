/**
 * Left-border accent panel using ┃ character
 */
import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface PanelProps {
  borderColor: string;
  backgroundColor?: string;
  paddingLeft?: number;
  paddingY?: number;
  children: ReactNode;
}

export function Panel({
  borderColor,
  paddingLeft = 1,
  paddingY = 0,
  children,
}: PanelProps): ReactNode {
  return (
    <Box>
      <Text color={borderColor}>{'┃'}</Text>
      <Box flexDirection="column" paddingLeft={paddingLeft} paddingTop={paddingY} paddingBottom={paddingY}>
        {children}
      </Box>
    </Box>
  );
}

interface ShadowLineProps {
  width?: number;
  color?: string;
}

export function ShadowLine({ width, color = '#585b70' }: ShadowLineProps): ReactNode {
  const w = width ?? (process.stdout.columns || 80) - 2;
  return (
    <Box>
      <Text color={color}>{'▔'.repeat(Math.max(0, w))}</Text>
    </Box>
  );
}
