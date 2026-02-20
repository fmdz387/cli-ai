/**
 * Footer status bar showing directory and provider info
 */
import { PROVIDER_CONFIG } from '../constants.js';
import { useTheme } from '../theme/index.js';
import type { AIProvider } from '../types/index.js';

import { Box, Text } from 'ink';
import { homedir } from 'node:os';
import type { ReactNode } from 'react';

interface FooterBarProps {
  cwd: string;
  provider: AIProvider;
  model: string;
}

export function FooterBar({ cwd, provider, model }: FooterBarProps): ReactNode {
  const theme = useTheme();
  const shortCwd = cwd.replace(homedir(), '~');
  const providerName = PROVIDER_CONFIG[provider].name;

  return (
    <Box>
      <Box justifyContent="space-between" width={(process.stdout.columns || 80) - 2}>
        <Text color={theme.textMuted}>{shortCwd}</Text>
        <Text color={theme.textMuted}>
          {providerName} / {model}
        </Text>
      </Box>
    </Box>
  );
}
