/**
 * Left-border accent panel using ┃ character
 */
import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface PanelProps {
  borderColor: string;
  backgroundColor?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingY?: number;
  border?: 'left' | 'all' | 'none';
  children: ReactNode;
}

export function Panel({
  borderColor,
  paddingLeft = 1,
  paddingRight = 0,
  paddingY = 0,
  border = 'left',
  children,
}: PanelProps): ReactNode {
  if (border === 'all') {
    return (
      <Box borderStyle="single" borderColor={borderColor} paddingLeft={paddingLeft} paddingRight={paddingRight} paddingTop={paddingY} paddingBottom={paddingY}>
        {children}
      </Box>
    );
  }

  if (border === 'none') {
    return (
      <Box paddingLeft={paddingLeft} paddingRight={paddingRight} paddingTop={paddingY} paddingBottom={paddingY}>
        {children}
      </Box>
    );
  }

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
