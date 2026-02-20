/**
 * Compact 1-line header status bar
 */
import { APP_NAME, VERSION } from '../constants.js';
import { useTheme } from '../theme/index.js';
import { Panel } from './ui/Panel.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface StatusBarProps {
  tokenCount?: number;
  cost?: number;
}

export function StatusBar({ tokenCount, cost }: StatusBarProps): ReactNode {
  const theme = useTheme();

  return (
    <Box marginBottom={1}>
      <Panel borderColor={theme.primary}>
        <Box justifyContent="space-between" width={(process.stdout.columns || 80) - 4}>
          <Box>
            <Text color={theme.primary} bold>
              {APP_NAME}
            </Text>
            <Text color={theme.textMuted}> v{VERSION}</Text>
          </Box>
          {(tokenCount !== undefined || cost !== undefined) && (
            <Box>
              {tokenCount !== undefined && (
                <Text color={theme.textMuted}>{tokenCount} tokens</Text>
              )}
              {cost !== undefined && (
                <>
                  <Text color={theme.textMuted}> | </Text>
                  <Text color={theme.textMuted}>${cost.toFixed(4)}</Text>
                </>
              )}
            </Box>
          )}
        </Box>
      </Panel>
    </Box>
  );
}
