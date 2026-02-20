/**
 * Unit tests for the defineTool helper and Zod validation
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { ToolContext } from '../types.js';
import { defineTool } from '../types.js';

const stubContext: ToolContext = {
  projectRoot: '/tmp',
  cwd: '/tmp',
  shell: 'bash',
  signal: new AbortController().signal,
};

describe('defineTool', () => {
  it('creates a ToolDefinition with correct metadata', () => {
    const tool = defineTool({
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: z.object({ path: z.string() }),
      defaultPermission: 'allow',
      execute: async () => ({ kind: 'success', output: 'ok' }),
    });

    expect(tool.name).toBe('test_tool');
    expect(tool.description).toBe('A test tool');
    expect(tool.defaultPermission).toBe('allow');
    expect(typeof tool.execute).toBe('function');
  });

  it('validates input through Zod and passes parsed data to execute', async () => {
    const executeFn = vi.fn(async (input: { name: string; count: number }) => ({
      kind: 'success' as const,
      output: `${input.name}:${input.count}`,
    }));

    const tool = defineTool({
      name: 'typed_tool',
      description: 'Typed input',
      inputSchema: z.object({ name: z.string(), count: z.number() }),
      defaultPermission: 'allow',
      execute: executeFn,
    });

    const result = await tool.execute({ name: 'hello', count: 42 }, stubContext);
    expect(result).toEqual({ kind: 'success', output: 'hello:42' });
    expect(executeFn).toHaveBeenCalledWith({ name: 'hello', count: 42 }, stubContext);
  });

  it('returns error for invalid input without calling execute', async () => {
    const executeFn = vi.fn(async () => ({ kind: 'success' as const, output: 'ok' }));

    const tool = defineTool({
      name: 'strict_tool',
      description: 'Strict input',
      inputSchema: z.object({ path: z.string() }),
      defaultPermission: 'allow',
      execute: executeFn,
    });

    const result = await tool.execute({ path: 123 }, stubContext);
    expect(result.kind).toBe('error');
    expect(executeFn).not.toHaveBeenCalled();
  });

  it('returns error for missing required fields', async () => {
    const tool = defineTool({
      name: 'required_tool',
      description: 'Required fields',
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      defaultPermission: 'ask',
      execute: async () => ({ kind: 'success', output: 'ok' }),
    });

    const result = await tool.execute({ path: '/tmp/a.txt' }, stubContext);
    expect(result.kind).toBe('error');
  });

  it('handles optional fields correctly', async () => {
    const tool = defineTool({
      name: 'optional_tool',
      description: 'Optional fields',
      inputSchema: z.object({
        path: z.string(),
        encoding: z.string().optional(),
      }),
      defaultPermission: 'allow',
      execute: async (input) => ({
        kind: 'success',
        output: input.encoding ?? 'utf-8',
      }),
    });

    const withOptional = await tool.execute({ path: '/a', encoding: 'ascii' }, stubContext);
    expect(withOptional).toEqual({ kind: 'success', output: 'ascii' });

    const withoutOptional = await tool.execute({ path: '/a' }, stubContext);
    expect(withoutOptional).toEqual({ kind: 'success', output: 'utf-8' });
  });

  it('strips extra fields via Zod strict parsing', async () => {
    const tool = defineTool({
      name: 'strip_tool',
      description: 'Strip extra',
      inputSchema: z.object({ path: z.string() }),
      defaultPermission: 'allow',
      execute: async (input) => ({
        kind: 'success',
        output: JSON.stringify(input),
      }),
    });

    const result = await tool.execute({ path: '/a', extra: 'field' }, stubContext);
    // Zod's default passthrough/strip behavior: extra fields are stripped
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      const parsed = JSON.parse(result.output);
      expect(parsed.path).toBe('/a');
      expect(parsed.extra).toBeUndefined();
    }
  });

  it('propagates execute errors as thrown exceptions', async () => {
    const tool = defineTool({
      name: 'error_tool',
      description: 'Throws',
      inputSchema: z.object({ path: z.string() }),
      defaultPermission: 'allow',
      execute: async () => {
        throw new Error('disk full');
      },
    });

    await expect(tool.execute({ path: '/a' }, stubContext)).rejects.toThrow('disk full');
  });

  it('preserves defaultPermission levels', () => {
    const levels = ['allow', 'ask', 'deny'] as const;
    for (const level of levels) {
      const tool = defineTool({
        name: `perm_${level}`,
        description: `Permission: ${level}`,
        inputSchema: z.object({}),
        defaultPermission: level,
        execute: async () => ({ kind: 'success', output: '' }),
      });
      expect(tool.defaultPermission).toBe(level);
    }
  });

  it('handles empty object schema', async () => {
    const tool = defineTool({
      name: 'empty_tool',
      description: 'No inputs',
      inputSchema: z.object({}),
      defaultPermission: 'allow',
      execute: async () => ({ kind: 'success', output: 'done' }),
    });

    const result = await tool.execute({}, stubContext);
    expect(result).toEqual({ kind: 'success', output: 'done' });
  });
});
