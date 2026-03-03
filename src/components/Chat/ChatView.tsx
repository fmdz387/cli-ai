/**
 * Main chat view container - renders the message list
 */
import { MAX_VISIBLE_MESSAGES } from '../../constants.js';
import { useTheme } from '../../theme/index.js';
import type { ChatMessage, PendingPermission } from '../../types/chat.js';
import { Divider } from '../ui/Divider.js';
import { AssistantBubble } from './AssistantBubble.js';
import { UserBubble } from './UserBubble.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface ChatViewProps {
  messages: ChatMessage[];
  pendingPermission: PendingPermission | null;
}

export function ChatView({ messages, pendingPermission }: ChatViewProps): ReactNode {
  const theme = useTheme();
  const visibleMessages = messages.length > MAX_VISIBLE_MESSAGES
    ? messages.slice(-MAX_VISIBLE_MESSAGES)
    : messages;

  const hiddenCount = messages.length - visibleMessages.length;

  if (visibleMessages.length === 0) return null;

  return (
    <Box flexDirection='column'>
      {hiddenCount > 0 && (
        <Box marginBottom={1}>
          <Text color={theme.textMuted}>{'── '}{hiddenCount} earlier messages hidden{' ──'}</Text>
        </Box>
      )}
      {visibleMessages.map((msg, i) => {
        const key = `${msg.role}-${msg.timestamp}-${i}`;
        const nextMsg = visibleMessages[i + 1];
        const showDivider = msg.role === 'assistant' && nextMsg?.role === 'user';

        switch (msg.role) {
          case 'user':
            return <UserBubble key={key} message={msg} />;
          case 'assistant':
            return (
              <Box key={key} flexDirection='column'>
                <AssistantBubble
                  message={msg}
                  pendingPermission={pendingPermission}
                />
                {showDivider && (
                  <Box marginY={1}>
                    <Divider char='┄' />
                  </Box>
                )}
              </Box>
            );
          case 'system':
            return (
              <Box key={key} marginBottom={1}>
                <Text color={theme.textMuted}>{msg.text}</Text>
              </Box>
            );
          default:
            return null;
        }
      })}
    </Box>
  );
}
