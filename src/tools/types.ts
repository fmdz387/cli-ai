/**
 * Tool system type definitions for agentic mode
 */

import type { ZodType } from 'zod';

import type { ShellType } from '../types/index.js';

/**
 * Permission levels for tool execution
 */
export type PermissionLevel = 'allow' | 'ask' | 'deny';

/**
 * Context passed to every tool execution
 */
export interface ToolContext {
  projectRoot: string;
  cwd: string;
  shell: ShellType;
  signal: AbortSignal;
}

/**
 * Discriminated union for tool execution results
 */
export type ToolResult =
  | { kind: 'success'; output: string }
  | { kind: 'error'; error: string }
  | { kind: 'denied'; reason: string };

/**
 * Tool definition stored in the registry (type-erased input)
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodType;
  defaultPermission: PermissionLevel;
  execute: (input: unknown, context: ToolContext) => Promise<ToolResult>;
}

/**
 * Helper to define a tool with type-safe input that erases to ToolDefinition
 */
export function defineTool<TInput>(options: {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;
  defaultPermission: PermissionLevel;
  execute: (input: TInput, context: ToolContext) => Promise<ToolResult>;
}): ToolDefinition {
  return {
    name: options.name,
    description: options.description,
    inputSchema: options.inputSchema,
    defaultPermission: options.defaultPermission,
    execute: async (raw: unknown, context: ToolContext) => {
      const parsed = options.inputSchema.safeParse(raw);
      if (!parsed.success) {
        return { kind: 'error' as const, error: parsed.error.message };
      }
      return options.execute(parsed.data, context);
    },
  };
}
