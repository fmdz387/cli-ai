/**
 * Risk assessment for shell commands
 */

import { DANGEROUS_PATTERNS, MEDIUM_RISK_PATTERNS } from '../constants.js';
import type { RiskLevel } from '../types/index.js';

export function assessCommandRisk(command: string): RiskLevel {
  const normalizedCommand = command.toLowerCase();

  // Check for dangerous patterns first (high risk)
  for (const pattern of DANGEROUS_PATTERNS) {
    if (normalizedCommand.includes(pattern.toLowerCase())) {
      return 'high';
    }
  }

  // Check for medium risk patterns
  for (const pattern of MEDIUM_RISK_PATTERNS) {
    if (normalizedCommand.includes(pattern.toLowerCase())) {
      return 'medium';
    }
  }

  // Default to low risk
  return 'low';
}

export function getRiskDescription(risk: RiskLevel): string {
  switch (risk) {
    case 'high':
      return 'This command may cause irreversible changes to your system';
    case 'medium':
      return 'This command modifies files or system state';
    case 'low':
      return 'This command is safe to run';
  }
}

export function combineRiskAssessment(aiRisk: RiskLevel, command: string): RiskLevel {
  const keywordRisk = assessCommandRisk(command);

  const riskPriority: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };

  return riskPriority[aiRisk] >= riskPriority[keywordRisk] ? aiRisk : keywordRisk;
}

export function requiresConfirmation(command: string): boolean {
  const risk = assessCommandRisk(command);
  return risk === 'high';
}

export function getWarnings(command: string): string[] {
  const warnings: string[] = [];
  const normalizedCommand = command.toLowerCase();

  if (normalizedCommand.includes('rm -rf')) {
    warnings.push('Recursive force delete - cannot be undone');
  }

  if (normalizedCommand.includes('sudo')) {
    warnings.push('Runs with elevated privileges');
  }

  if (normalizedCommand.includes('chmod 777')) {
    warnings.push('Makes files readable/writable/executable by everyone');
  }

  if (normalizedCommand.includes('dd if=')) {
    warnings.push('Direct disk write - can overwrite data');
  }

  if (normalizedCommand.includes('> /dev/')) {
    warnings.push('Writing directly to device');
  }

  if (normalizedCommand.includes('| sh') || normalizedCommand.includes('| bash')) {
    warnings.push('Piping to shell - executing remote code');
  }

  if (normalizedCommand.includes('eval')) {
    warnings.push('Dynamic code execution');
  }

  if (normalizedCommand.includes('--no-preserve-root')) {
    warnings.push('Can affect root filesystem');
  }

  return warnings;
}
