/**
 * Agent progress display showing step counter, status, and token usage
 */
import { useTheme } from '../../theme/index.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

interface AgentProgressProps {
  stepIndex: number;
  maxSteps: number;
  status: string;
  tokenUsage?: TokenUsage;
}

function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

export function AgentProgress({
  stepIndex,
  maxSteps,
  status,
  tokenUsage,
}: AgentProgressProps): ReactNode {
  const theme = useTheme();
  const filled = Math.min(stepIndex, maxSteps);
  const barWidth = 20;
  const filledWidth = Math.round((filled / maxSteps) * barWidth);
  const emptyWidth = barWidth - filledWidth;
  const bar = '\u2588'.repeat(filledWidth) + '\u2591'.repeat(emptyWidth);

  return (
    <Box flexDirection='column' marginY={1}>
      <Box>
        <Text color={theme.primary} bold>
          Step {stepIndex}/{maxSteps}
        </Text>
        <Text> </Text>
        <Text color={theme.textMuted}>{bar}</Text>
      </Box>
      <Box>
        <Text color={theme.textMuted}>{status}</Text>
      </Box>
      {tokenUsage && (
        <Box>
          <Text color={theme.textMuted}>
            Tokens: {formatTokenCount(tokenUsage.inputTokens)} in /{' '}
            {formatTokenCount(tokenUsage.outputTokens)} out
          </Text>
        </Box>
      )}
      <Box>
        <Text color={theme.textMuted}>
          [<Text color={theme.warning}>Ctrl+C</Text>] to stop
        </Text>
      </Box>
    </Box>
  );
}
