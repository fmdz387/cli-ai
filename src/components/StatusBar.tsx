/**
 * Compact 1-line header status bar
 */
import { APP_NAME, VERSION } from '../constants.js';
import {
  formatCompactTokenCount,
  type SessionContextMetrics,
} from '../lib/session-context-metrics.js';
import { useTheme } from '../theme/index.js';
import { Panel } from './ui/Panel.js';

import { Box, Text } from 'ink';
import { memo, type ReactNode } from 'react';

interface StatusBarProps {
  sessionContext?: SessionContextMetrics;
  cost?: number;
}

function StatusBarComponent({ sessionContext, cost }: StatusBarProps): ReactNode {
  const theme = useTheme();

  const rightItems: ReactNode[] = [];

  if (sessionContext) {
    const usageColor =
      sessionContext.usagePercent !== null
        ? sessionContext.usagePercent >= 85
          ? theme.error
          : sessionContext.usagePercent >= 65
            ? theme.warning
            : theme.textMuted
        : theme.textMuted;
    const value = sessionContext.maxContextTokens
      ? `${formatCompactTokenCount(sessionContext.usedTokens)}/${formatCompactTokenCount(sessionContext.maxContextTokens)} ctx`
      : `${formatCompactTokenCount(sessionContext.usedTokens)} ctx`;
    const suffix = sessionContext.usagePercent !== null ? ` (${sessionContext.usagePercent}%)` : '';

    rightItems.push(
      <Text key='tokens' color={usageColor}>
        {value}
        {suffix}
      </Text>,
    );
  }
  if (cost !== undefined) {
    rightItems.push(
      <Text key='cost' color={theme.textMuted}>
        ${cost.toFixed(4)}
      </Text>,
    );
  }

  return (
    <Box>
      <Panel borderColor={theme.primary}>
        <Box justifyContent='space-between' width={(process.stdout.columns || 80) - 4}>
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
