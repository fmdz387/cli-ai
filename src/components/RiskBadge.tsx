/**
 * Risk level badge component
 */
import { useTheme } from '../theme/index.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

import type { RiskLevel } from '../types/index.js';
import { getRiskDescription, getWarnings } from '../lib/risk-assessment.js';

interface RiskBadgeProps {
  risk: RiskLevel;
  command?: string;
  showDescription?: boolean;
  showWarnings?: boolean;
}

export function RiskBadge({
  risk,
  command,
  showDescription = false,
  showWarnings = true,
}: RiskBadgeProps): ReactNode {
  const theme = useTheme();
  const warnings = command && showWarnings ? getWarnings(command) : [];

  const riskColors: Record<RiskLevel, string> = {
    low: theme.success,
    medium: theme.warning,
    high: theme.error,
  };

  const RISK_ICONS: Record<RiskLevel, string> = {
    low: '\u2713',
    medium: '\u26A0',
    high: '\u26A0',
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={riskColors[risk]} bold>
          {RISK_ICONS[risk]} {risk.toUpperCase()} RISK
        </Text>
      </Box>

      {showDescription && (
        <Box marginTop={1}>
          <Text color={theme.textMuted}>{getRiskDescription(risk)}</Text>
        </Box>
      )}

      {warnings.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {warnings.map((warning, i) => (
            <Box key={i}>
              <Text color={theme.warning}>  {'\u2022'} {warning}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function RiskIndicator({ risk }: { risk: RiskLevel }): ReactNode {
  const theme = useTheme();

  const riskColors: Record<RiskLevel, string> = {
    low: theme.success,
    medium: theme.warning,
    high: theme.error,
  };

  return (
    <Text color={riskColors[risk]} bold>
      [{risk.toUpperCase()}]
    </Text>
  );
}
