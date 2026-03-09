import { useTheme } from '../../theme/index.js';
import type { AssistantMessage, ChatMessage, PendingPermission } from '../../types/chat.js';
import { Divider } from '../ui/Divider.js';
import { AssistantBubble } from './AssistantBubble.js';
import { UserBubble } from './UserBubble.js';

import { Box, Static, Text } from 'ink';
import { memo, useMemo, type ReactNode } from 'react';

interface ChatViewProps {
  messages: ChatMessage[];
  pendingPermission: PendingPermission | null;
}

function renderMessage(
  msg: ChatMessage,
  pendingPermission: PendingPermission | null,
  key: string,
  systemColor: string,
): ReactNode {
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
        </Box>
      );
    case 'system':
      return (
        <Box key={key} marginBottom={1}>
          <Text color={systemColor}>{msg.text}</Text>
        </Box>
      );
    default:
      return null;
  }
}

function ChatViewComponent({ messages, pendingPermission }: ChatViewProps): ReactNode {
  const theme = useTheme();

  const liveAssistantIndex = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index];
      if (message?.role === 'assistant' && message.isStreaming) {
        return index;
      }
    }
    return -1;
  }, [messages]);

  const staticMessages = liveAssistantIndex === -1 ? messages : messages.slice(0, liveAssistantIndex);
  const liveMessages = liveAssistantIndex === -1 ? [] : messages.slice(liveAssistantIndex);

  if (messages.length === 0) return null;

  return (
    <Box flexDirection='column'>
      <Static items={staticMessages}>
        {(message, index) => {
          const key = `${message.role}-${message.timestamp}-${index}`;
          const nextMessage = staticMessages[index + 1];
          const content = renderMessage(message, null, key, theme.textMuted);

          if (message.role === 'assistant' && nextMessage?.role === 'user') {
            return (
              <Box key={key} flexDirection='column'>
                {content}
                <Box marginY={1}>
                  <Divider char='┄' />
                </Box>
              </Box>
            );
          }

          return content;
        }}
      </Static>

      {liveMessages.map((message, index) => {
        const key = `live-${message.role}-${message.timestamp}-${index}`;
        const nextMessage = liveMessages[index + 1];
        const content = renderMessage(message, pendingPermission, key, theme.textMuted);

        if (message.role === 'assistant' && nextMessage?.role === 'user') {
          return (
            <Box key={key} flexDirection='column'>
              {content}
              <Box marginY={1}>
                <Divider char='┄' />
              </Box>
            </Box>
          );
        }

        return content;
      })}
    </Box>
  );
}

export const ChatView = memo(ChatViewComponent);
