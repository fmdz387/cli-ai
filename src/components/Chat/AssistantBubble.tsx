/**
 * Assistant message bubble - renders parts in order for interleaved text/tool display
 */
import type { AssistantMessage, PendingPermission } from '../../types/chat.js';
import { useTheme } from '../../theme/index.js';
import { MarkdownText } from '../MarkdownText.js';
import { PermissionPrompt } from '../Agent/PermissionPrompt.js';
import { ToolCallStatus } from '../Agent/ToolCallStatus.js';
import { ThinkingSpinner } from '../Spinner.js';

import { Box, Text } from 'ink';
import { useEffect, useState, type ReactNode } from 'react';

const CURSOR_FRAMES = ['\u2588', ' '];

interface AssistantBubbleProps {
  message: AssistantMessage;
  pendingPermission: PendingPermission | null;
}

export function AssistantBubble({
  message,
  pendingPermission,
}: AssistantBubbleProps): ReactNode {
  const theme = useTheme();
  const [cursorFrame, setCursorFrame] = useState(0);

  useEffect(() => {
    if (!message.isStreaming) return;
    const timer = setInterval(() => {
      setCursorFrame((prev) => (prev + 1) % CURSOR_FRAMES.length);
    }, 500);
    return () => clearInterval(timer);
  }, [message.isStreaming]);

  const hasParts = message.parts.length > 0;
  const isThinking = message.isStreaming && !hasParts;
  const termWidth = process.stdout.columns || 80;

  // Check if the last part is a text part (for streaming cursor placement)
  const lastPart = message.parts[message.parts.length - 1];
  const lastPartIsText = lastPart?.type === 'text';

  return (
    <Box flexDirection='column' marginBottom={1} paddingLeft={3}>
      {isThinking && <ThinkingSpinner label='Thinking...' />}

      {/* Render parts in order - text and tools interleaved */}
      {message.parts.map((part, i) => {
        if (part.type === 'text' && part.text) {
          const isLastTextPart = lastPartIsText && i === message.parts.length - 1;
          return (
            <Box key={`text-${i}`} flexDirection='column' width={termWidth - 6}>
              <Box flexWrap='wrap'>
                <MarkdownText>{part.text}</MarkdownText>
                {message.isStreaming && isLastTextPart && (
                  <Text color={theme.primary}>{CURSOR_FRAMES[cursorFrame]}</Text>
                )}
              </Box>
            </Box>
          );
        }

        if (part.type === 'tool') {
          return (
            <Box key={part.id} flexDirection='column'>
              <ToolCallStatus
                call={{ name: part.name, input: part.input }}
                status={part.status}
                result={part.result}
              />
              {pendingPermission && pendingPermission.toolCall.id === part.id && (
                <PermissionPrompt
                  toolCall={pendingPermission.toolCall}
                  onApprove={() => {}}
                  onDeny={() => {}}
                  onApproveSession={() => {}}
                />
              )}
            </Box>
          );
        }

        return null;
      })}
    </Box>
  );
}
