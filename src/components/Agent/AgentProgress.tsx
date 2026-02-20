/**
 * Agent progress display showing step counter, status, and token usage
 */
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
  const filled = Math.min(stepIndex, maxSteps);
  const barWidth = 20;
  const filledWidth = Math.round((filled / maxSteps) * barWidth);
  const emptyWidth = barWidth - filledWidth;
  const bar = '\u2588'.repeat(filledWidth) + '\u2591'.repeat(emptyWidth);

  return (
    <Box flexDirection='column' marginY={1}>
      <Box>
        <Text color='cyan' bold>
          Step {stepIndex}/{maxSteps}
        </Text>
        <Text> </Text>
        <Text dimColor>{bar}</Text>
      </Box>
      <Box>
        <Text dimColor>{status}</Text>
      </Box>
      {tokenUsage && (
        <Box>
          <Text dimColor>
            Tokens: {formatTokenCount(tokenUsage.inputTokens)} in /{' '}
            {formatTokenCount(tokenUsage.outputTokens)} out
          </Text>
        </Box>
      )}
      <Box>
        <Text dimColor>
          [<Text color='yellow'>Ctrl+C</Text>] to stop
        </Text>
      </Box>
    </Box>
  );
}
