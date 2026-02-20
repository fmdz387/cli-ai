/**
 * Permission gate for tool execution control
 */

import type { PermissionLevel, ToolDefinition } from './types.js';

interface PermissionRule {
  pattern: RegExp;
  level: PermissionLevel;
}

interface CheckOptions {
  toolName: string;
  input: Record<string, unknown>;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function matchesRule(rule: PermissionRule, value: string): boolean {
  return rule.pattern.test(value);
}

/**
 * Controls whether tools can execute based on permission rules
 */
export class PermissionGate {
  private sessionApprovals = new Map<string, boolean>();
  private rules: PermissionRule[] = [];
  private toolDefaults = new Map<string, PermissionLevel>();
  private globalDefault: PermissionLevel = 'ask';

  registerDefaults(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.toolDefaults.set(tool.name, tool.defaultPermission);
    }
  }

  setRule(pattern: string, level: PermissionLevel): void {
    this.rules.push({ pattern: globToRegex(pattern), level });
  }

  approveForSession(toolName: string): void {
    this.sessionApprovals.set(toolName, true);
  }

  isSessionApproved(toolName: string): boolean {
    return this.sessionApprovals.get(toolName) === true;
  }

  check(options: CheckOptions): PermissionLevel {
    if (this.sessionApprovals.get(options.toolName)) {
      return 'allow';
    }

    const commandStr = options.toolName === 'bash_execute'
      ? String(options.input['command'] ?? '')
      : '';

    for (const rule of this.rules) {
      if (matchesRule(rule, options.toolName)) {
        return rule.level;
      }
      if (commandStr && matchesRule(rule, commandStr)) {
        return rule.level;
      }
    }

    const toolDefault = this.toolDefaults.get(options.toolName);
    if (toolDefault) {
      return toolDefault;
    }

    return this.globalDefault;
  }

  reset(): void {
    this.sessionApprovals.clear();
  }
}
