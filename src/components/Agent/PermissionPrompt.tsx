/**
 * Permission prompt for agent tool calls requiring approval
 */
import { useTheme } from '../../theme/index.js';
import type { AgentToolCallInfo } from '../../types/index.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface PermissionPromptProps {
  toolCall: AgentToolCallInfo;
  onApprove: () => void;
  onDeny: () => void;
  onApproveSession: () => void;
}

function truncateValue(value: unknown, max: number): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

export function PermissionPrompt({
  toolCall,
}: PermissionPromptProps): ReactNode {
  const theme = useTheme();
  const params = Object.entries(toolCall.input);

  return (
    <Box
      flexDirection='column'
      borderStyle='round'
      borderColor={theme.warning}
      paddingX={1}
      marginY={1}
    >
      <Box>
        <Text color={theme.warning} bold>
          Permission Required
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text}>
          Tool: <Text bold color={theme.secondary}>{toolCall.name}</Text>
        </Text>
      </Box>
      {params.length > 0 && (
        <Box flexDirection='column' marginTop={1}>
          {params.slice(0, 5).map(([key, value]) => (
            <Box key={key}>
              <Text color={theme.textMuted}>  {key}: </Text>
              <Text color={theme.text}>{truncateValue(value, 80)}</Text>
            </Box>
          ))}
          {params.length > 5 && (
            <Text color={theme.textMuted}>  ... {params.length - 5} more</Text>
          )}
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.text}>
          [<Text color={theme.success}>y</Text>] Allow once{' '}
          [<Text color={theme.error}>n</Text>] Deny{' '}
          [<Text color={theme.primary}>A</Text>] Allow for session
        </Text>
      </Box>
    </Box>
  );
}
