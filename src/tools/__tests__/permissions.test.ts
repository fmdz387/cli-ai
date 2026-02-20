/**
 * Unit tests for PermissionGate
 */

import { describe, expect, it } from 'vitest';

import { PermissionGate } from '../permissions.js';
import type { ToolDefinition, ToolResult } from '../types.js';
import { z } from 'zod';

function makeTool(name: string, defaultPermission: 'allow' | 'ask' | 'deny'): ToolDefinition {
  return {
    name,
    description: name,
    inputSchema: z.object({}),
    defaultPermission,
    execute: async (): Promise<ToolResult> => ({ kind: 'success', output: '' }),
  };
}

describe('PermissionGate', () => {
  it('should use tool default when no rules or session', () => {
    const gate = new PermissionGate();
    gate.registerDefaults([makeTool('file_read', 'allow')]);
    expect(gate.check({ toolName: 'file_read', input: {} })).toBe('allow');
  });

  it('should fall back to global default for unknown tools', () => {
    const gate = new PermissionGate();
    expect(gate.check({ toolName: 'unknown', input: {} })).toBe('ask');
  });

  it('should allow session-approved tools', () => {
    const gate = new PermissionGate();
    gate.registerDefaults([makeTool('bash_execute', 'ask')]);
    gate.approveForSession('bash_execute');
    expect(gate.check({ toolName: 'bash_execute', input: {} })).toBe('allow');
    expect(gate.isSessionApproved('bash_execute')).toBe(true);
  });

  it('should match pattern rules', () => {
    const gate = new PermissionGate();
    gate.setRule('file_*', 'deny');
    expect(gate.check({ toolName: 'file_read', input: {} })).toBe('deny');
    expect(gate.check({ toolName: 'file_write', input: {} })).toBe('deny');
  });

  it('should match bash command patterns', () => {
    const gate = new PermissionGate();
    gate.setRule('git *', 'allow');
    const result = gate.check({
      toolName: 'bash_execute',
      input: { command: 'git status' },
    });
    expect(result).toBe('allow');
  });

  it('should prioritize session over rules over defaults', () => {
    const gate = new PermissionGate();
    gate.registerDefaults([makeTool('bash_execute', 'deny')]);
    gate.setRule('bash_execute', 'ask');
    expect(gate.check({ toolName: 'bash_execute', input: {} })).toBe('ask');

    gate.approveForSession('bash_execute');
    expect(gate.check({ toolName: 'bash_execute', input: {} })).toBe('allow');
  });

  it('should clear session approvals on reset', () => {
    const gate = new PermissionGate();
    gate.registerDefaults([makeTool('bash_execute', 'ask')]);
    gate.approveForSession('bash_execute');
    expect(gate.check({ toolName: 'bash_execute', input: {} })).toBe('allow');

    gate.reset();
    expect(gate.check({ toolName: 'bash_execute', input: {} })).toBe('ask');
    expect(gate.isSessionApproved('bash_execute')).toBe(false);
  });
});
