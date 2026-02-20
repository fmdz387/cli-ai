/**
 * Tool call status display with colored indicators
 */
import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export type ToolCallStatusType =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'denied';

interface ToolCallStatusProps {
  call: { name: string; input: Record<string, unknown> };
  status: ToolCallStatusType;
  result?: string;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}

function statusIndicator(status: ToolCallStatusType): ReactNode {
  const indicators: Record<ToolCallStatusType, [string, string]> = {
    pending: ['\u25CB', 'gray'],
    running: ['\u25D4', 'yellow'],
    success: ['\u2713', 'green'],
    error: ['\u2717', 'red'],
    denied: ['\u26D4', 'red'],
  };
  const [icon, color] = indicators[status];
  return <Text color={color}>{icon}</Text>;
}

function formatParams(input: Record<string, unknown>): string {
  const entries = Object.entries(input);
  if (entries.length === 0) return '';
  const parts = entries.map(([k, v]) => {
    const val = typeof v === 'string' ? v : JSON.stringify(v);
    return `${k}=${val}`;
  });
  return truncate(parts.join(', '), 100);
}

export function ToolCallStatus({
  call,
  status,
  result,
}: ToolCallStatusProps): ReactNode {
  return (
    <Box flexDirection='column' marginLeft={2}>
      <Box>
        {statusIndicator(status)}
        <Text> </Text>
        <Text bold color='blue'>
          {call.name}
        </Text>
        {Object.keys(call.input).length > 0 && (
          <Text dimColor> ({formatParams(call.input)})</Text>
        )}
      </Box>
      {result && (
        <Box marginLeft={4}>
          <Text dimColor>{truncate(result, 200)}</Text>
        </Box>
      )}
    </Box>
  );
}
