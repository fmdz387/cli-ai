/**
 * Assistant message bubble - renders parts in order for interleaved text/tool display.
 * Shows a "Thinking..." spinner whenever the agent is streaming but no content
 * is actively appearing — before any parts arrive, AND after tool completions
 * while waiting for the next API response.
 */
import type { AssistantMessage, PendingPermission } from '../../types/chat.js';
import { useTheme } from '../../theme/index.js';
import { MarkdownText } from '../MarkdownText.js';
import { Divider } from '../ui/Divider.js';
import { PermissionPrompt } from '../Agent/PermissionPrompt.js';
import { ToolCallStatus } from '../Agent/ToolCallStatus.js';
import { Spinner } from '../Spinner.js';

import { Box, Text } from 'ink';
import { memo, useEffect, useState, type ReactNode } from 'react';

const CURSOR_FRAMES = ['\u2588', ' '];

interface AssistantBubbleProps {
  message: AssistantMessage;
  pendingPermission: PendingPermission | null;
}

function AssistantBubbleComponent({
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

  const termWidth = process.stdout.columns || 80;
  const lastPart = message.parts[message.parts.length - 1];
  const lastPartIsText = lastPart?.type === 'text';

  // Show "Thinking..." whenever streaming but no content is actively appearing:
  // - No parts yet (initial API call)
  // - Last part is a completed/errored/denied tool (waiting for next API response)
  const isWaitingForResponse = message.isStreaming && (
    message.parts.length === 0 ||
    (lastPart?.type === 'tool' && lastPart.status !== 'running' && lastPart.status !== 'pending')
  );

  return (
    <Box flexDirection='column' marginBottom={1} paddingLeft={3}>
      <Text bold color={theme.secondary}>Assistant</Text>
      {/* Render parts in order - text and tools interleaved */}
      {message.parts.map((part, i) => {
        const prevPart = message.parts[i - 1];
        const nextPart = message.parts[i + 1];

        if (part.type === 'text' && part.text) {
          const isLastTextPart = lastPartIsText && i === message.parts.length - 1;
          return (
            <Box key={`text-${i}`} flexDirection='column' width={termWidth - 6}>
              {/* Close tool group divider if previous part was a tool */}
              {prevPart?.type === 'tool' && (
                <Divider char='┄' width={termWidth - 8} color={theme.border} />
              )}
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
          const isFirstInGroup = prevPart?.type !== 'tool';
          const isLastInGroup = nextPart?.type !== 'tool';
          return (
            <Box key={part.id} flexDirection='column'>
              {isFirstInGroup && (
                <Divider char='┄' width={termWidth - 8} color={theme.border} />
              )}
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
              {isLastInGroup && !nextPart && (
                <Divider char='┄' width={termWidth - 8} color={theme.border} />
              )}
            </Box>
          );
        }

        return null;
      })}

      {/* Spinner shown when waiting for content — covers initial thinking AND
          the gap after tool completions before the next text/tool arrives */}
      {isWaitingForResponse && (
        <Box marginTop={message.parts.length > 0 ? 0 : 1}>
          <Spinner label='Thinking...' variant='braille' />
        </Box>
      )}
    </Box>
  );
}

export const AssistantBubble = memo(AssistantBubbleComponent);
