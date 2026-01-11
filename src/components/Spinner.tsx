/**
 * Loading spinner component
 */

import { Box, Text } from 'ink';
import { Spinner as InkSpinner } from '@inkjs/ui';
import type { ReactNode } from 'react';

interface SpinnerProps {
  label?: string;
}

export function Spinner({ label = 'Loading...' }: SpinnerProps): ReactNode {
  return (
    <Box>
      <InkSpinner label={label} />
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
      <Box>
        <InkSpinner label={label} />
      </Box>
      {query && (
        <Box marginTop={1}>
          <Text dimColor>Query: {query}</Text>
        </Box>
      )}
    </Box>
  );
}
