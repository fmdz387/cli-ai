/**
 * End-to-end integration tests for the full agentic flow
 * Tests the complete pipeline: registry → permissions → adapter → executor
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { PermissionGate } from '../../tools/permissions.js';
import { ToolRegistry } from '../../tools/registry.js';
import { defineTool } from '../../tools/types.js';
import type { ToolCallAdapter } from '../adapters/types.js';
import { ContextManager } from '../context-manager.js';
import { AgentExecutor } from '../executor.js';
import type { AgentConfig, AgentEvent, AgentToolCall, TokenUsage } from '../types.js';

/** Simulate a multi-turn provider with scripted responses */
function createScriptedProvider(
  adapter: ToolCallAdapter,
  script: Array<{
    text: string;
    toolCalls: AgentToolCall[];
    isToolCall: boolean;
    usage: TokenUsage;
  }>,
) {
  let turnIndex = 0;
  return {
    generateCommand: vi.fn(),
    generateAlternatives: vi.fn(),
    explainCommand: vi.fn(),
    sendWithTools: vi.fn(async () => {
      const resp = script[turnIndex];
      if (!resp) {
        throw new Error(`Provider script exhausted at turn ${turnIndex}`);
      }

      // Wire adapter mocks to return the scripted response for this turn
      const currentTurn = turnIndex++;
      (adapter.isToolCallResponse as ReturnType<typeof vi.fn>).mockReturnValueOnce(resp.isToolCall);
      (adapter.parseToolCalls as ReturnType<typeof vi.fn>).mockReturnValueOnce(resp.toolCalls);
      (adapter.extractTextContent as ReturnType<typeof vi.fn>).mockReturnValueOnce(resp.text);
      (adapter.extractTokenUsage as ReturnType<typeof vi.fn>).mockReturnValueOnce(resp.usage);

      return { turn: currentTurn };
    }),
  };
}

function createSequentialAdapter(): ToolCallAdapter {
  return {
    formatTools: vi.fn(() => []),
    parseToolCalls: vi.fn(() => []),
    formatToolResults: vi.fn((r) => r),
    isToolCallResponse: vi.fn(() => false),
    extractTextContent: vi.fn(() => ''),
    extractTokenUsage: vi.fn(() => ({ inputTokens: 0, outputTokens: 0 })),
  };
}

const baseConfig: AgentConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  apiKey: 'test-key',
  maxTurns: 20,
  maxTokensPerTurn: 4096,
  context: {
    shell: 'bash',
    cwd: '/project',
    platform: 'linux',
    directoryTree: '',
    history: [],
  },
};

describe('Full Agentic Flow', () => {
  it('completes a multi-step file exploration workflow', async () => {
    const adapter = createSequentialAdapter();
    const script = [
      {
        text: 'Let me search for config files.',
        toolCalls: [{ id: 'tc1', name: 'glob_search', input: { pattern: '**/*.config.*' } }],
        isToolCall: true,
        usage: { inputTokens: 100, outputTokens: 50 },
      },
      {
        text: 'Found config. Let me read it.',
        toolCalls: [{ id: 'tc2', name: 'file_read', input: { filePath: '/project/tsconfig.json' } }],
        isToolCall: true,
        usage: { inputTokens: 200, outputTokens: 80 },
      },
      {
        text: 'Now running the build to check.',
        toolCalls: [{ id: 'tc3', name: 'bash_execute', input: { command: 'pnpm build' } }],
        isToolCall: true,
        usage: { inputTokens: 300, outputTokens: 100 },
      },
      {
        text: 'The project uses TypeScript with strict mode. Build passes.',
        toolCalls: [],
        isToolCall: false,
        usage: { inputTokens: 350, outputTokens: 120 },
      },
    ];

    const provider = createScriptedProvider(adapter, script);
    const registry = new ToolRegistry();
    registry.register(defineTool({
      name: 'glob_search',
      description: 'Search files',
      inputSchema: z.object({ pattern: z.string() }),
      defaultPermission: 'allow',
      execute: async () => ({ kind: 'success', output: 'tsconfig.json\nvite.config.ts' }),
    }));
    registry.register(defineTool({
      name: 'file_read',
      description: 'Read file',
      inputSchema: z.object({ filePath: z.string() }),
      defaultPermission: 'allow',
      execute: async () => ({ kind: 'success', output: '{"compilerOptions":{"strict":true}}' }),
    }));
    registry.register(defineTool({
      name: 'bash_execute',
      description: 'Run command',
      inputSchema: z.object({ command: z.string() }),
      defaultPermission: 'ask',
      execute: async () => ({ kind: 'success', output: 'Build succeeded' }),
    }));

    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());
    permissions.approveForSession('bash_execute');

    const contextManager = new ContextManager();
    const executor = new AgentExecutor({
      provider, adapter, registry, permissions, contextManager,
    });
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    const result = await executor.execute({
      query: 'Analyze the project configuration',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    expect(result.finalResponse).toBe('The project uses TypeScript with strict mode. Build passes.');
    expect(result.usage.turns).toBe(4);
    expect(result.usage.totalInputTokens).toBe(950);
    expect(result.usage.totalOutputTokens).toBe(350);

    const toolStarts = events.filter((e) => e.type === 'tool_start');
    expect(toolStarts).toHaveLength(3);
    const toolNames = toolStarts.map((e) => (e as { type: 'tool_start'; toolCall: AgentToolCall }).toolCall.name);
    expect(toolNames).toEqual(['glob_search', 'file_read', 'bash_execute']);
  });

  it('handles permission denial mid-flow and recovers', async () => {
    const adapter = createSequentialAdapter();
    const script = [
      {
        text: 'Let me delete temp files.',
        toolCalls: [{ id: 'tc1', name: 'bash_execute', input: { command: 'rm -rf /tmp/*' } }],
        isToolCall: true,
        usage: { inputTokens: 50, outputTokens: 30 },
      },
      {
        text: 'Permission denied. Let me try a safer approach.',
        toolCalls: [{ id: 'tc2', name: 'file_read', input: { filePath: '/tmp/list.txt' } }],
        isToolCall: true,
        usage: { inputTokens: 80, outputTokens: 40 },
      },
      {
        text: 'Listed the temp files instead of deleting them.',
        toolCalls: [],
        isToolCall: false,
        usage: { inputTokens: 100, outputTokens: 50 },
      },
    ];

    const provider = createScriptedProvider(adapter, script);
    const registry = new ToolRegistry();
    registry.register(defineTool({
      name: 'bash_execute',
      description: 'Run command',
      inputSchema: z.object({ command: z.string() }),
      defaultPermission: 'ask',
      execute: async () => ({ kind: 'success', output: 'done' }),
    }));
    registry.register(defineTool({
      name: 'file_read',
      description: 'Read file',
      inputSchema: z.object({ filePath: z.string() }),
      defaultPermission: 'allow',
      execute: async () => ({ kind: 'success', output: 'temp1.txt\ntemp2.txt' }),
    }));

    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());
    permissions.setRule('bash_execute', 'deny');

    const contextManager = new ContextManager();
    const executor = new AgentExecutor({
      provider, adapter, registry, permissions, contextManager,
    });
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    const result = await executor.execute({
      query: 'Clean up temp files',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    expect(result.finalResponse).toBe('Listed the temp files instead of deleting them.');
    const toolResults = events.filter((e) => e.type === 'tool_result');
    expect(toolResults).toHaveLength(2);

    const firstResult = (toolResults[0] as { type: 'tool_result'; result: import('../../tools/types.js').ToolResult }).result;
    expect(firstResult.kind).toBe('denied');

    const secondResult = (toolResults[1] as { type: 'tool_result'; result: import('../../tools/types.js').ToolResult }).result;
    expect(secondResult.kind).toBe('success');
  });

  it('integrates defineTool with registry and provider format', () => {
    const registry = new ToolRegistry();
    const tool = defineTool({
      name: 'custom_search',
      description: 'Custom code search',
      inputSchema: z.object({
        query: z.string(),
        maxResults: z.number().optional(),
        caseSensitive: z.boolean().optional(),
      }),
      defaultPermission: 'allow',
      execute: async () => ({ kind: 'success', output: 'results' }),
    });
    registry.register(tool);

    const providerFormat = registry.toProviderFormat();
    expect(providerFormat).toHaveLength(1);
    expect(providerFormat[0]!.name).toBe('custom_search');
    expect(providerFormat[0]!.input_schema.type).toBe('object');
    expect(providerFormat[0]!.input_schema.properties['query']).toBeDefined();
    expect(providerFormat[0]!.input_schema.properties['query']!.type).toBe('string');
    expect(providerFormat[0]!.input_schema.required).toContain('query');
    expect(providerFormat[0]!.input_schema.required).not.toContain('maxResults');
    expect(providerFormat[0]!.input_schema.required).not.toContain('caseSensitive');
  });

  it('permission gate priority chain works correctly', () => {
    const permissions = new PermissionGate();
    const registry = new ToolRegistry();
    registry.register(defineTool({
      name: 'file_read',
      description: 'Read',
      inputSchema: z.object({ path: z.string() }),
      defaultPermission: 'allow',
      execute: async () => ({ kind: 'success', output: '' }),
    }));
    registry.register(defineTool({
      name: 'bash_execute',
      description: 'Bash',
      inputSchema: z.object({ command: z.string() }),
      defaultPermission: 'ask',
      execute: async () => ({ kind: 'success', output: '' }),
    }));
    permissions.registerDefaults(registry.list());

    // Tool default: file_read = allow
    expect(permissions.check({ toolName: 'file_read', input: {} })).toBe('allow');

    // Tool default: bash_execute = ask
    expect(permissions.check({ toolName: 'bash_execute', input: {} })).toBe('ask');

    // Rule overrides tool default
    permissions.setRule('bash_execute', 'deny');
    expect(permissions.check({ toolName: 'bash_execute', input: {} })).toBe('deny');

    // Session approval overrides everything
    permissions.approveForSession('bash_execute');
    expect(permissions.check({ toolName: 'bash_execute', input: {} })).toBe('allow');

    // Reset clears session approvals
    permissions.reset();
    expect(permissions.check({ toolName: 'bash_execute', input: {} })).toBe('deny');

    // Unknown tool falls back to global default (ask)
    expect(permissions.check({ toolName: 'unknown_tool', input: {} })).toBe('ask');
  });

  it('context manager compaction preserves conversation integrity', () => {
    const mgr = new ContextManager(500);

    const messages: import('../types.js').AgentMessage[] = [
      { role: 'system', content: 'You are a coding assistant.' },
      { role: 'user', content: 'Refactor the auth module.' },
    ];

    // Simulate a long conversation with many tool interactions
    for (let i = 0; i < 15; i++) {
      messages.push({
        role: 'assistant',
        content: `Step ${i}: processing files...`,
        toolCalls: [{ id: `tc${i}`, name: 'file_read', input: { path: `/src/auth/file${i}.ts` } }],
      });
      messages.push({
        role: 'tool_result',
        toolCallId: `tc${i}`,
        name: 'file_read',
        result: { kind: 'success', output: `export function handler${i}() { ${'code '.repeat(100)} }` },
      });
    }
    messages.push({ role: 'assistant', content: 'Final analysis complete.' });

    expect(mgr.shouldCompact(messages)).toBe(true);

    const compacted = mgr.compact(messages);
    expect(compacted.length).toBeLessThan(messages.length);

    // System and user messages preserved
    expect(compacted[0]!.role).toBe('system');
    expect(compacted[1]!.role).toBe('user');

    // Last assistant message preserved
    const lastMsg = compacted[compacted.length - 1]!;
    expect(lastMsg.role).toBe('assistant');
    if (lastMsg.role === 'assistant') {
      expect(lastMsg.content).toBe('Final analysis complete.');
    }

    // Summary message exists
    const summary = compacted.find(
      (m) => m.role === 'user' && 'content' in m && m.content.includes('[Context summary'),
    );
    expect(summary).toBeDefined();
  });

  it('full pipeline: tool creation → registration → schema → execution', async () => {
    // 1. Create tools with defineTool
    const readTool = defineTool({
      name: 'file_read',
      description: 'Read a file',
      inputSchema: z.object({ filePath: z.string() }),
      defaultPermission: 'allow',
      execute: async (input) => ({ kind: 'success', output: `Contents of ${input.filePath}` }),
    });
    const writeTool = defineTool({
      name: 'file_write',
      description: 'Write a file',
      inputSchema: z.object({ filePath: z.string(), content: z.string() }),
      defaultPermission: 'ask',
      execute: async (input) => ({ kind: 'success', output: `Wrote ${input.content.length} chars` }),
    });

    // 2. Register in registry
    const registry = new ToolRegistry();
    registry.register(readTool);
    registry.register(writeTool);
    expect(registry.list()).toHaveLength(2);

    // 3. Convert to provider format
    const schemas = registry.toProviderFormat();
    expect(schemas).toHaveLength(2);
    expect(schemas.find((s) => s.name === 'file_read')).toBeDefined();
    expect(schemas.find((s) => s.name === 'file_write')).toBeDefined();

    // 4. Execute tools directly with valid input
    const stubContext = {
      projectRoot: '/project',
      cwd: '/project',
      shell: 'bash' as const,
      signal: new AbortController().signal,
    };

    const readResult = await readTool.execute({ filePath: '/src/index.ts' }, stubContext);
    expect(readResult).toEqual({ kind: 'success', output: 'Contents of /src/index.ts' });

    const writeResult = await writeTool.execute(
      { filePath: '/out.txt', content: 'hello' },
      stubContext,
    );
    expect(writeResult).toEqual({ kind: 'success', output: 'Wrote 5 chars' });

    // 5. Execute with invalid input
    const badResult = await readTool.execute({ filePath: 123 }, stubContext);
    expect(badResult.kind).toBe('error');
  });

  it('event stream follows correct ordering', async () => {
    const adapter = createSequentialAdapter();
    const script = [
      {
        text: 'Reading file.',
        toolCalls: [{ id: 'tc1', name: 'file_read', input: { filePath: '/a.ts' } }],
        isToolCall: true,
        usage: { inputTokens: 50, outputTokens: 25 },
      },
      {
        text: 'Done.',
        toolCalls: [],
        isToolCall: false,
        usage: { inputTokens: 60, outputTokens: 30 },
      },
    ];

    const provider = createScriptedProvider(adapter, script);
    const registry = new ToolRegistry();
    registry.register(defineTool({
      name: 'file_read',
      description: 'Read',
      inputSchema: z.object({ filePath: z.string() }),
      defaultPermission: 'allow',
      execute: async () => ({ kind: 'success', output: 'file content' }),
    }));
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());

    const executor = new AgentExecutor({
      provider,
      adapter,
      registry,
      permissions,
      contextManager: new ContextManager(),
    });
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    await executor.execute({
      query: 'test',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    const types = events.map((e) => e.type);

    // Expected order: text_delta, tool_start, tool_result, turn_complete, text_delta, turn_complete
    expect(types[0]).toBe('text_delta');
    expect(types[1]).toBe('tool_start');
    expect(types[2]).toBe('tool_result');
    expect(types[3]).toBe('turn_complete');
    expect(types[4]).toBe('text_delta');
    expect(types[5]).toBe('turn_complete');
  });
});
