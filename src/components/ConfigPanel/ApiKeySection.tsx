/**
 * API key section for config panel
 */
import { useTheme } from '../../theme/index.js';

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
  const theme = useTheme();

  return (
    <Box flexDirection="column">
      {/* Status */}
      <Box>
        <Text color={theme.textMuted}>Status:  </Text>
        <Text color={hasApiKey ? theme.success : theme.error}>
          {hasApiKey ? 'Configured' : 'Not configured'}
        </Text>
        {hasApiKey ? (
          <>
            <Text color={theme.textMuted}> (</Text>
            <Text color={isSecure ? theme.success : theme.warning}>{storageDescription}</Text>
            <Text color={theme.textMuted}>)</Text>
          </>
        ) : null}
      </Box>

      {/* Masked key */}
      {maskedKey ? (
        <Box>
          <Text color={theme.textMuted}>Key:     </Text>
          <Text color={theme.textMuted}>{maskedKey}</Text>
        </Box>
      ) : null}

      {/* Actions */}
      <Box marginTop={1}>
        <Text color={isSectionActive && focusedIndex === 0 ? theme.primary : theme.textMuted} bold={isSectionActive && focusedIndex === 0}>
          {isSectionActive && focusedIndex === 0 ? '> ' : '  '}
        </Text>
        <Text color={isSectionActive && focusedIndex === 0 ? theme.primary : theme.secondary}>
          [{hasApiKey ? 'Change API Key' : 'Set API Key'}]
        </Text>
      </Box>

      {hasApiKey ? (
        <Box>
          <Text color={isSectionActive && focusedIndex === 1 ? theme.primary : theme.textMuted} bold={isSectionActive && focusedIndex === 1}>
            {isSectionActive && focusedIndex === 1 ? '> ' : '  '}
          </Text>
          <Text color={isSectionActive && focusedIndex === 1 ? theme.error : theme.textMuted}>
            [Remove API Key]
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
