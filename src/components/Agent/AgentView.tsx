/**
 * AgentView container composing all agent sub-components
 */
import type { AgentEvent, AgentToolCall, TokenUsage } from '../../agent/types.js';
import type { AgentToolCallInfo } from '../../types/index.js';

import { Box, Text } from 'ink';
import { useMemo, type ReactNode } from 'react';

import { AgentMessage } from './AgentMessage.js';
import { AgentProgress } from './AgentProgress.js';
import { PermissionPrompt } from './PermissionPrompt.js';
import { ToolCallStatus, type ToolCallStatusType } from './ToolCallStatus.js';

interface PendingPermission {
  toolCall: AgentToolCallInfo;
  onApprove: () => void;
  onDeny: () => void;
  onApproveSession: () => void;
}

interface AgentViewProps {
  events: AgentEvent[];
  pendingPermission: PendingPermission | null;
  isRunning: boolean;
  stepIndex: number;
  maxSteps: number;
  tokenUsage?: TokenUsage;
}

const MAX_VISIBLE_EVENTS = 50;

function toolCallToInfo(tc: AgentToolCall): AgentToolCallInfo {
  return { id: tc.id, name: tc.name, input: tc.input };
}

function deriveToolStatus(
  events: AgentEvent[],
  callId: string,
): ToolCallStatusType {
  for (const ev of events) {
    if (ev.type === 'tool_result' && ev.toolCallId === callId) {
      return ev.result.kind === 'success' ? 'success' : 'error';
    }
  }
  return 'running';
}

function renderEvent(event: AgentEvent, allEvents: AgentEvent[]): ReactNode {
  switch (event.type) {
    case 'text_delta':
      return null;
    case 'tool_start':
      return (
        <ToolCallStatus
          call={toolCallToInfo(event.toolCall)}
          status={deriveToolStatus(allEvents, event.toolCall.id)}
        />
      );
    case 'error':
      return (
        <Box marginLeft={2}>
          <Text color='red'>Error: {event.error.message}</Text>
        </Box>
      );
    case 'doom_loop':
      return (
        <Box marginLeft={2}>
          <Text color='yellow'>
            Repeated call detected: {event.repeatedCall.name}
          </Text>
        </Box>
      );
    default:
      return null;
  }
}

export function AgentView({
  events,
  pendingPermission,
  isRunning,
  stepIndex,
  maxSteps,
  tokenUsage,
}: AgentViewProps): ReactNode {
  const visibleEvents = useMemo(
    () => events.slice(-MAX_VISIBLE_EVENTS),
    [events],
  );

  const streamingText = useMemo(() => {
    const textParts: string[] = [];
    for (const ev of events) {
      if (ev.type === 'text_delta') {
        textParts.push(ev.text);
      }
    }
    return textParts.join('');
  }, [events]);

  const statusText = isRunning ? 'Agent is working...' : 'Complete';

  return (
    <Box flexDirection='column' marginY={1}>
      <AgentProgress
        stepIndex={stepIndex}
        maxSteps={maxSteps}
        status={statusText}
        tokenUsage={tokenUsage}
      />
      {streamingText && (
        <AgentMessage text={streamingText} isStreaming={isRunning} />
      )}
      {visibleEvents.map((event, i) => {
        const rendered = renderEvent(event, events);
        if (!rendered) return null;
        return <Box key={i}>{rendered}</Box>;
      })}
      {pendingPermission && (
        <PermissionPrompt
          toolCall={pendingPermission.toolCall}
          onApprove={pendingPermission.onApprove}
          onDeny={pendingPermission.onDeny}
          onApproveSession={pendingPermission.onApproveSession}
        />
      )}
    </Box>
  );
}
