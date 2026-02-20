/**
 * User message bubble in the chat view
 */
import type { UserMessage } from '../../types/chat.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface UserBubbleProps {
  message: UserMessage;
}

export function UserBubble({ message }: UserBubbleProps): ReactNode {
  return (
    <Box marginBottom={1}>
      <Text color='cyan' bold>
        {'> '}
      </Text>
      <Text color='cyan'>{message.text}</Text>
    </Box>
  );
}
