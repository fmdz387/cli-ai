/**
 * Section wrapper for config panel
 */
import { useTheme } from '../../theme/index.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface ConfigSectionProps {
  title: string;
  isActive: boolean;
  children: ReactNode;
}

export function ConfigSection({ title, isActive, children }: ConfigSectionProps): ReactNode {
  const theme = useTheme();

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Section header */}
      <Box>
        <Text color={isActive ? theme.primary : theme.text} bold>
          {title}
        </Text>
        {isActive ? <Text color={theme.primary}> *</Text> : null}
      </Box>

      {/* Separator */}
      <Box>
        <Text color={theme.border}>{'─'.repeat(50)}</Text>
      </Box>

      {/* Section content */}
      <Box flexDirection="column" paddingLeft={0}>
        {children}
      </Box>
    </Box>
  );
}
