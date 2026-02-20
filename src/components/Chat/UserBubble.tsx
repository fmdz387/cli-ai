/**
 * User message bubble with left-border panel
 */
import type { UserMessage } from '../../types/chat.js';
import { useTheme } from '../../theme/index.js';
import { Panel } from '../ui/Panel.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface UserBubbleProps {
  message: UserMessage;
}

export function UserBubble({ message }: UserBubbleProps): ReactNode {
  const theme = useTheme();

  return (
    <Box marginBottom={1}>
      <Panel borderColor={theme.primary} paddingLeft={1}>
        <Text color={theme.text}>{message.text}</Text>
      </Panel>
    </Box>
  );
}
