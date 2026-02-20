/**
 * Assistant message bubble - tools first, then response text
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

  const hasText = message.text.length > 0;
  const hasToolCalls = message.toolCalls.length > 0;
  const isThinking = message.isStreaming && !hasText && !hasToolCalls;
  const termWidth = process.stdout.columns || 80;

  return (
    <Box flexDirection='column' marginBottom={1} paddingLeft={3}>
      {isThinking && <ThinkingSpinner label='Thinking...' />}

      {/* Tool calls FIRST - logical order: work happens before response */}
      {hasToolCalls && (
        <Box flexDirection='column' marginBottom={hasText ? 1 : 0}>
          {message.toolCalls.map((tc) => (
            <Box key={tc.id} flexDirection='column'>
              <ToolCallStatus
                call={{ name: tc.name, input: tc.input }}
                status={tc.status}
                result={tc.result}
              />
              {pendingPermission && pendingPermission.toolCall.id === tc.id && (
                <PermissionPrompt
                  toolCall={pendingPermission.toolCall}
                  onApprove={() => {}}
                  onDeny={() => {}}
                  onApproveSession={() => {}}
                />
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Response text AFTER tools */}
      {hasText && (
        <Box flexDirection='column' width={termWidth - 6}>
          <Box flexWrap='wrap'>
            <MarkdownText>{message.text}</MarkdownText>
            {message.isStreaming && <Text color={theme.primary}>{CURSOR_FRAMES[cursorFrame]}</Text>}
          </Box>
        </Box>
      )}
    </Box>
  );
}
