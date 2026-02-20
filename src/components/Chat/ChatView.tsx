/**
 * Main chat view container - renders the message list
 */
import { MAX_VISIBLE_MESSAGES } from '../../constants.js';
import { useTheme } from '../../theme/index.js';
import type { ChatMessage, PendingPermission } from '../../types/chat.js';
import { AssistantBubble } from './AssistantBubble.js';
import { UserBubble } from './UserBubble.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface ChatViewProps {
  messages: ChatMessage[];
  pendingPermission: PendingPermission | null;
  streamingText?: string;
}

export function ChatView({ messages, pendingPermission, streamingText }: ChatViewProps): ReactNode {
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
          <Text color={theme.textMuted}>... {hiddenCount} earlier messages hidden ...</Text>
        </Box>
      )}
      {visibleMessages.map((msg, i) => {
        const key = `${msg.role}-${msg.timestamp}-${i}`;
        switch (msg.role) {
          case 'user':
            return <UserBubble key={key} message={msg} />;
          case 'assistant': {
            const isLast = i === visibleMessages.length - 1;
            const displayMsg = isLast && streamingText
              ? { ...msg, text: msg.text + streamingText }
              : msg;
            return (
              <AssistantBubble
                key={key}
                message={displayMsg}
                pendingPermission={pendingPermission}
              />
            );
          }
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
