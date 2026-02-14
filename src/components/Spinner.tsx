/**
 * Loading spinner component
 */

import { Box, Text } from 'ink';
import { useEffect, useState, type ReactNode } from 'react';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface SpinnerProps {
  label?: string;
}

export function Spinner({ label = 'Loading...' }: SpinnerProps): ReactNode {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box>
      <Text color="green">{SPINNER_FRAMES[frame]}</Text>
      <Text> {label}</Text>
    </Box>
  );
}

interface ThinkingSpinnerProps {
  query?: string;
  label?: string;
}

export function ThinkingSpinner({ query, label = "Thinking..." }: ThinkingSpinnerProps): ReactNode {
  return (
    <Box flexDirection="column" marginY={1}>
      <Spinner label={label} />
      {query && (
        <Box marginTop={1}>
          <Text dimColor>Query: {query}</Text>
        </Box>
      )}
    </Box>
  );
}
