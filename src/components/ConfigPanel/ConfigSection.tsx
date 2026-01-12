/**
 * Section wrapper for config panel
 */

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface ConfigSectionProps {
  title: string;
  isActive: boolean;
  children: ReactNode;
}

export function ConfigSection({ title, isActive, children }: ConfigSectionProps): ReactNode {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Section header */}
      <Box>
        <Text color={isActive ? 'cyan' : 'white'} bold>
          {title}
        </Text>
        {isActive ? <Text color="cyan"> *</Text> : null}
      </Box>

      {/* Separator */}
      <Box>
        <Text dimColor>{'─'.repeat(50)}</Text>
      </Box>

      {/* Section content */}
      <Box flexDirection="column" paddingLeft={0}>
        {children}
      </Box>
    </Box>
  );
}
