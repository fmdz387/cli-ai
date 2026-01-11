/**
 * Risk level badge component
 */

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

const RISK_COLORS = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
} as const;

const RISK_ICONS = {
  low: '✓',
  medium: '⚠',
  high: '⚠',
} as const;

export function RiskBadge({
  risk,
  command,
  showDescription = false,
  showWarnings = true,
}: RiskBadgeProps): ReactNode {
  const warnings = command && showWarnings ? getWarnings(command) : [];

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={RISK_COLORS[risk]} bold>
          {RISK_ICONS[risk]} {risk.toUpperCase()} RISK
        </Text>
      </Box>

      {showDescription && (
        <Box marginTop={1}>
          <Text dimColor>{getRiskDescription(risk)}</Text>
        </Box>
      )}

      {warnings.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {warnings.map((warning, i) => (
            <Box key={i}>
              <Text color="yellow">  • {warning}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function RiskIndicator({ risk }: { risk: RiskLevel }): ReactNode {
  return (
    <Text color={RISK_COLORS[risk]} bold>
      [{risk.toUpperCase()}]
    </Text>
  );
}
