/**
 * Assistant message bubble with streaming text, tool calls, and permission prompts
 */
import type { AssistantMessage, PendingPermission } from '../../types/chat.js';
import { formatSegments } from '../Agent/AgentMessage.js';
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
    <Box flexDirection='column' marginBottom={1}>
      {isThinking && <ThinkingSpinner label='Thinking...' />}

      {hasText && (
        <Box flexDirection='column' width={termWidth - 4}>
          <Box flexWrap='wrap'>
            {formatSegments(message.text)}
            {message.isStreaming && <Text color='green'>{CURSOR_FRAMES[cursorFrame]}</Text>}
          </Box>
        </Box>
      )}

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
  );
}
