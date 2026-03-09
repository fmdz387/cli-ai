/**
 * Compact 1-line header status bar
 */
import { APP_NAME, VERSION } from '../constants.js';
import { useTheme } from '../theme/index.js';
import { Panel } from './ui/Panel.js';

import { Box, Text } from 'ink';
import { memo, type ReactNode } from 'react';

interface StatusBarProps {
  tokenCount?: number;
  cost?: number;
}

function StatusBarComponent({ tokenCount, cost }: StatusBarProps): ReactNode {
  const theme = useTheme();

  const rightItems: ReactNode[] = [];

  if (tokenCount !== undefined) {
    const formatted = tokenCount >= 1000 ? (tokenCount / 1000).toFixed(1) + 'k' : tokenCount.toString();
    rightItems.push(<Text key="tokens" color={theme.textMuted}>{formatted} tokens</Text>);
  }
  if (cost !== undefined) {
    rightItems.push(<Text key="cost" color={theme.textMuted}>${cost.toFixed(4)}</Text>);
  }

  return (
    <Box>
      <Panel borderColor={theme.primary}>
        <Box justifyContent="space-between" width={(process.stdout.columns || 80) - 4}>
          <Box>
            <Text color={theme.primary} bold>
              {APP_NAME}
            </Text>
            <Text color={theme.textMuted}> v{VERSION}</Text>
          </Box>
          {rightItems.length > 0 && (
            <Box>
              {rightItems.map((item, i) => (
                <Box key={i}>
                  {i > 0 && <Text color={theme.textMuted}>{' · '}</Text>}
                  {item}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Panel>
    </Box>
  );
}

export const StatusBar = memo(StatusBarComponent);
