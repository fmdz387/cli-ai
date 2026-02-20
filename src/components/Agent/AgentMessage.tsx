/**
 * Agent message display with streaming cursor and basic formatting
 */
import { Box, Text } from 'ink';
import { useEffect, useState, type ReactNode } from 'react';

interface AgentMessageProps {
  text: string;
  isStreaming: boolean;
}

const CURSOR_FRAMES = ['\u2588', ' '];

export function formatSegments(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} bold>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Text key={i} color='yellow'>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

export function AgentMessage({ text, isStreaming }: AgentMessageProps): ReactNode {
  const [cursorFrame, setCursorFrame] = useState(0);

  useEffect(() => {
    if (!isStreaming) return;
    const timer = setInterval(() => {
      setCursorFrame((prev) => (prev + 1) % CURSOR_FRAMES.length);
    }, 500);
    return () => clearInterval(timer);
  }, [isStreaming]);

  if (!text && !isStreaming) return null;

  const termWidth = process.stdout.columns || 80;

  return (
    <Box flexDirection='column' width={termWidth - 4}>
      <Box flexWrap='wrap'>
        {formatSegments(text)}
        {isStreaming && <Text color='green'>{CURSOR_FRAMES[cursorFrame]}</Text>}
      </Box>
    </Box>
  );
}
