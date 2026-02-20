/**
 * Loading spinner component with theme support
 */
import { useTheme } from '../theme/index.js';

import { Box, Text } from 'ink';
import { useEffect, useState, type ReactNode } from 'react';

const SPINNER_FRAMES = ['\u2800', '\u2801', '\u2803', '\u2807', '\u280f', '\u281f', '\u283f', '\u287f', '\u28ff', '\u28fe', '\u28fc', '\u28f8', '\u28f0', '\u28e0', '\u28c0', '\u2880'];

interface SpinnerProps {
  label?: string;
}

export function Spinner({ label = 'Loading...' }: SpinnerProps): ReactNode {
  const theme = useTheme();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box>
      <Text color={theme.primary}>{SPINNER_FRAMES[frame]}</Text>
      <Text color={theme.textMuted}> {label}</Text>
    </Box>
  );
}

interface ThinkingSpinnerProps {
  query?: string;
  label?: string;
}

export function ThinkingSpinner({ query, label = "Thinking..." }: ThinkingSpinnerProps): ReactNode {
  const theme = useTheme();

  return (
    <Box flexDirection="column" marginY={1}>
      <Spinner label={label} />
      {query && (
        <Box marginTop={1}>
          <Text color={theme.textMuted}>Query: {query}</Text>
        </Box>
      )}
    </Box>
  );
}
