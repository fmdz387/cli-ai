/**
 * User message bubble with left-border panel
 */
import type { UserMessage } from '../../types/chat.js';
import { useTheme } from '../../theme/index.js';
import { Panel } from '../ui/Panel.js';

import { Box, Text } from 'ink';
import { memo, type ReactNode } from 'react';

interface UserBubbleProps {
  message: UserMessage;
}

function UserBubbleComponent({ message }: UserBubbleProps): ReactNode {
  const theme = useTheme();

  return (
    <Box marginBottom={1}>
      <Panel borderColor={theme.primary} paddingLeft={1}>
        <Box flexDirection='column'>
          <Text bold color={theme.primary}>You</Text>
          <Text color={theme.text}>{message.text}</Text>
        </Box>
      </Panel>
    </Box>
  );
}

export const UserBubble = memo(UserBubbleComponent);
