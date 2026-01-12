/**
 * API key section for config panel
 */

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface ApiKeySectionProps {
  hasApiKey: boolean;
  storageMethod: string;
  storageDescription: string;
  isSecure: boolean;
  maskedKey: string | null;
  isSectionActive: boolean;
  focusedIndex: number;
}

export function ApiKeySection({
  hasApiKey,
  storageMethod,
  storageDescription,
  isSecure,
  maskedKey,
  isSectionActive,
  focusedIndex,
}: ApiKeySectionProps): ReactNode {
  return (
    <Box flexDirection="column">
      {/* Status */}
      <Box>
        <Text dimColor>Status:  </Text>
        <Text color={hasApiKey ? 'green' : 'red'}>
          {hasApiKey ? 'Configured' : 'Not configured'}
        </Text>
        {hasApiKey ? (
          <>
            <Text dimColor> (</Text>
            <Text color={isSecure ? 'green' : 'yellow'}>{storageDescription}</Text>
            <Text dimColor>)</Text>
          </>
        ) : null}
      </Box>

      {/* Masked key */}
      {maskedKey ? (
        <Box>
          <Text dimColor>Key:     </Text>
          <Text color="gray">{maskedKey}</Text>
        </Box>
      ) : null}

      {/* Actions */}
      <Box marginTop={1}>
        <Text color={isSectionActive && focusedIndex === 0 ? 'cyan' : 'gray'} bold={isSectionActive && focusedIndex === 0}>
          {isSectionActive && focusedIndex === 0 ? '> ' : '  '}
        </Text>
        <Text color={isSectionActive && focusedIndex === 0 ? 'cyan' : 'blue'}>
          [{hasApiKey ? 'Change API Key' : 'Set API Key'}]
        </Text>
      </Box>

      {hasApiKey ? (
        <Box>
          <Text color={isSectionActive && focusedIndex === 1 ? 'cyan' : 'gray'} bold={isSectionActive && focusedIndex === 1}>
            {isSectionActive && focusedIndex === 1 ? '> ' : '  '}
          </Text>
          <Text color={isSectionActive && focusedIndex === 1 ? 'red' : 'gray'}>
            [Remove API Key]
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
