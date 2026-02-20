/**
 * Advanced executor tests: multi-tool turns, errors, compaction, max turns
 */
import { describe, expect, it, vi } from 'vitest';

import { PermissionGate } from '../../tools/permissions.js';
import { ToolRegistry } from '../../tools/registry.js';
import type { ToolDefinition, ToolResult } from '../../tools/types.js';
import type { ToolCallAdapter } from '../adapters/types.js';
import { ContextManager } from '../context-manager.js';
import { AgentExecutor } from '../executor.js';
import type { AgentConfig, AgentEvent, AgentToolCall, TokenUsage } from '../types.js';

function createAdapter(responses: Array<{
  text: string;
  toolCalls: AgentToolCall[];
  isToolCall: boolean;
  usage: TokenUsage;
}>): ToolCallAdapter {
  let callIndex = 0;
  return {
    formatTools: vi.fn(() => []),
    parseToolCalls: vi.fn(() => responses[callIndex - 1]?.toolCalls ?? []),
    formatToolResults: vi.fn((r) => r),
    isToolCallResponse: vi.fn(() => responses[callIndex - 1]?.isToolCall ?? false),
    extractTextContent: vi.fn(() => responses[callIndex - 1]?.text ?? ''),
    extractTokenUsage: vi.fn(() => {
      const resp = responses[callIndex++];
      return resp?.usage ?? { inputTokens: 0, outputTokens: 0 };
    }),
  };
}

function createProvider() {
  let calls = 0;
  return {
    generateCommand: vi.fn(),
    generateAlternatives: vi.fn(),
    explainCommand: vi.fn(),
    sendWithTools: vi.fn(async () => ({ call: ++calls })),
  };
}

function mockTool(name: string, result: ToolResult): ToolDefinition {
  return {
    name,
    description: `Mock ${name}`,
    inputSchema: { _def: { typeName: 'ZodObject', shape: () => ({}) } } as never,
    defaultPermission: 'allow',
    execute: vi.fn(async () => result),
  };
}

const baseConfig: AgentConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  apiKey: 'test-key',
  maxTurns: 10,
  maxTokensPerTurn: 4096,
  context: {
    shell: 'bash',
    cwd: '/tmp',
    platform: 'linux',
    directoryTree: '',
    history: [],
  },
};

function makeExecutor(
  adapter: ToolCallAdapter,
  provider: ReturnType<typeof createProvider>,
  registry: ToolRegistry,
  permissions?: PermissionGate,
  contextManager?: ContextManager,
) {
  return new AgentExecutor({
    provider,
    adapter,
    registry,
    permissions: permissions ?? new PermissionGate(),
    contextManager: contextManager ?? new ContextManager(),
  });
}

describe('AgentExecutor - Advanced', () => {
  it('handles multiple tool calls in a single turn', async () => {
    const adapter = createAdapter([
      {
        text: 'Reading two files',
        toolCalls: [
          { id: 'tc1', name: 'file_read', input: { path: '/a.txt' } },
          { id: 'tc2', name: 'file_read', input: { path: '/b.txt' } },
        ],
        isToolCall: true,
        usage: { inputTokens: 20, outputTokens: 10 },
      },
      {
        text: 'Both files read successfully.',
        toolCalls: [],
        isToolCall: false,
        usage: { inputTokens: 30, outputTokens: 15 },
      },
    ]);
    const provider = createProvider();
    const registry = new ToolRegistry();
    registry.register(mockTool('file_read', { kind: 'success', output: 'content' }));
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());

    const executor = makeExecutor(adapter, provider, registry, permissions);
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    const result = await executor.execute({
      query: 'read two files',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    expect(result.finalResponse).toBe('Both files read successfully.');
    const toolStarts = events.filter((e) => e.type === 'tool_start');
    expect(toolStarts).toHaveLength(2);
    const toolResults = events.filter((e) => e.type === 'tool_result');
    expect(toolResults).toHaveLength(2);
  });

  it('handles tool execution that throws an exception', async () => {
    const adapter = createAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc1', name: 'crash_tool', input: {} }],
        isToolCall: true,
        usage: { inputTokens: 10, outputTokens: 5 },
      },
      {
        text: 'Recovered from error.',
        toolCalls: [],
        isToolCall: false,
        usage: { inputTokens: 15, outputTokens: 8 },
      },
    ]);
    const provider = createProvider();
    const registry = new ToolRegistry();
    const crashTool: ToolDefinition = {
      name: 'crash_tool',
      description: 'Always throws',
      inputSchema: { _def: { typeName: 'ZodObject', shape: () => ({}) } } as never,
      defaultPermission: 'allow',
      execute: vi.fn(async () => { throw new Error('segfault'); }),
    };
    registry.register(crashTool);
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());

    const executor = makeExecutor(adapter, provider, registry, permissions);
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    const result = await executor.execute({
      query: 'crash it',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    expect(result.finalResponse).toBe('Recovered from error.');
    const toolResultEvents = events.filter((e) => e.type === 'tool_result');
    const firstResult = toolResultEvents[0] as { type: 'tool_result'; result: ToolResult };
    expect(firstResult.result.kind).toBe('error');
    if (firstResult.result.kind === 'error') {
      expect(firstResult.result.error).toContain('segfault');
    }
  });

  it('terminates when adapter stops returning tool calls', async () => {
    // 3 tool-call turns with unique inputs (avoid doom loop), then adapter exhausts
    const responses = [
      ...Array.from({ length: 3 }, (_, i) => ({
        text: `step ${i}`,
        toolCalls: [{ id: `tc${i}`, name: 'file_read', input: { path: `/file${i}` } }],
        isToolCall: true,
        usage: { inputTokens: 5, outputTokens: 5 },
      })),
    ];

    const adapter = createAdapter(responses);
    const provider = createProvider();
    const registry = new ToolRegistry();
    registry.register(mockTool('file_read', { kind: 'success', output: 'data' }));
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());

    const executor = makeExecutor(adapter, provider, registry, permissions);
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    const result = await executor.execute({
      query: 'process files',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    // 3 tool-call turns + 1 final turn where adapter returns no tool call
    expect(result.usage.turns).toBe(4);
    const turnCompletes = events.filter((e) => e.type === 'turn_complete');
    expect(turnCompletes).toHaveLength(4);
    const toolStarts = events.filter((e) => e.type === 'tool_start');
    expect(toolStarts).toHaveLength(3);
  });

  it('accumulates token usage across turns', async () => {
    const adapter = createAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc1', name: 'file_read', input: { path: '/a' } }],
        isToolCall: true,
        usage: { inputTokens: 100, outputTokens: 50 },
      },
      {
        text: '',
        toolCalls: [{ id: 'tc2', name: 'file_read', input: { path: '/b' } }],
        isToolCall: true,
        usage: { inputTokens: 200, outputTokens: 80 },
      },
      {
        text: 'Done.',
        toolCalls: [],
        isToolCall: false,
        usage: { inputTokens: 150, outputTokens: 60 },
      },
    ]);
    const provider = createProvider();
    const registry = new ToolRegistry();
    registry.register(mockTool('file_read', { kind: 'success', output: 'ok' }));
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());

    const executor = makeExecutor(adapter, provider, registry, permissions);
    const controller = new AbortController();

    const result = await executor.execute({
      query: 'multi-step',
      config: baseConfig,
      signal: controller.signal,
      onEvent: () => {},
    });

    expect(result.usage.totalInputTokens).toBe(450);
    expect(result.usage.totalOutputTokens).toBe(190);
    expect(result.usage.turns).toBe(3);
  });

  it('sends abort mid-tool-execution', async () => {
    const adapter = createAdapter([
      {
        text: '',
        toolCalls: [
          { id: 'tc1', name: 'file_read', input: { path: '/first' } },
          { id: 'tc2', name: 'file_read', input: { path: '/second' } },
        ],
        isToolCall: true,
        usage: { inputTokens: 10, outputTokens: 5 },
      },
    ]);
    const provider = createProvider();
    const registry = new ToolRegistry();
    registry.register(mockTool('file_read', { kind: 'success', output: 'data' }));
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());

    const controller = new AbortController();
    const executor = makeExecutor(adapter, provider, registry, permissions);
    const events: AgentEvent[] = [];

    // Abort after the first tool_start event
    const result = await executor.execute({
      query: 'read then abort',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => {
        events.push(e);
        if (e.type === 'tool_result') {
          controller.abort();
        }
      },
    });

    expect(result.finalResponse).toBe('');
    expect(events.some((e) => e.type === 'aborted')).toBe(true);
  });

  it('handles non-Error thrown objects in tool execution', async () => {
    const adapter = createAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc1', name: 'weird_tool', input: {} }],
        isToolCall: true,
        usage: { inputTokens: 10, outputTokens: 5 },
      },
      {
        text: 'Handled.',
        toolCalls: [],
        isToolCall: false,
        usage: { inputTokens: 10, outputTokens: 5 },
      },
    ]);
    const provider = createProvider();
    const registry = new ToolRegistry();
    const weirdTool: ToolDefinition = {
      name: 'weird_tool',
      description: 'Throws non-Error',
      inputSchema: { _def: { typeName: 'ZodObject', shape: () => ({}) } } as never,
      defaultPermission: 'allow',
      execute: vi.fn(async () => { throw 'string error'; }),
    };
    registry.register(weirdTool);
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());

    const executor = makeExecutor(adapter, provider, registry, permissions);
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    await executor.execute({
      query: 'weird throw',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    const toolResultEvents = events.filter((e) => e.type === 'tool_result');
    const first = toolResultEvents[0] as { type: 'tool_result'; result: ToolResult };
    expect(first.result.kind).toBe('error');
    if (first.result.kind === 'error') {
      expect(first.result.error).toBe('string error');
    }
  });

  it('doom loop detection resets after a different call', async () => {
    const adapter = createAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc1', name: 'file_read', input: { path: '/same' } }],
        isToolCall: true,
        usage: { inputTokens: 5, outputTokens: 5 },
      },
      {
        text: '',
        toolCalls: [{ id: 'tc2', name: 'file_read', input: { path: '/same' } }],
        isToolCall: true,
        usage: { inputTokens: 5, outputTokens: 5 },
      },
      {
        text: '',
        toolCalls: [{ id: 'tc3', name: 'file_read', input: { path: '/different' } }],
        isToolCall: true,
        usage: { inputTokens: 5, outputTokens: 5 },
      },
      {
        text: 'Completed normally.',
        toolCalls: [],
        isToolCall: false,
        usage: { inputTokens: 5, outputTokens: 5 },
      },
    ]);
    const provider = createProvider();
    const registry = new ToolRegistry();
    registry.register(mockTool('file_read', { kind: 'success', output: 'data' }));
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());

    const executor = makeExecutor(adapter, provider, registry, permissions);
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    const result = await executor.execute({
      query: 'varied calls',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    // Should NOT trigger doom loop because call 3 is different
    expect(result.finalResponse).toBe('Completed normally.');
    expect(events.some((e) => e.type === 'doom_loop')).toBe(false);
  });

  it('emits text_delta for each turn with text content', async () => {
    const adapter = createAdapter([
      {
        text: 'Thinking...',
        toolCalls: [{ id: 'tc1', name: 'file_read', input: { path: '/a' } }],
        isToolCall: true,
        usage: { inputTokens: 10, outputTokens: 5 },
      },
      {
        text: 'Final answer.',
        toolCalls: [],
        isToolCall: false,
        usage: { inputTokens: 10, outputTokens: 5 },
      },
    ]);
    const provider = createProvider();
    const registry = new ToolRegistry();
    registry.register(mockTool('file_read', { kind: 'success', output: 'ok' }));
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());

    const executor = makeExecutor(adapter, provider, registry, permissions);
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    await executor.execute({
      query: 'chat',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    const textDeltas = events.filter((e) => e.type === 'text_delta');
    expect(textDeltas).toHaveLength(2);
    expect((textDeltas[0] as { type: 'text_delta'; text: string }).text).toBe('Thinking...');
    expect((textDeltas[1] as { type: 'text_delta'; text: string }).text).toBe('Final answer.');
  });

  it('session-approved tools bypass permission check', async () => {
    const adapter = createAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc1', name: 'bash_execute', input: { command: 'ls' } }],
        isToolCall: true,
        usage: { inputTokens: 10, outputTokens: 5 },
      },
      {
        text: 'Listed files.',
        toolCalls: [],
        isToolCall: false,
        usage: { inputTokens: 10, outputTokens: 5 },
      },
    ]);
    const provider = createProvider();
    const registry = new ToolRegistry();
    registry.register(mockTool('bash_execute', { kind: 'success', output: 'file.txt' }));
    const permissions = new PermissionGate();
    permissions.setRule('bash_execute', 'deny');
    permissions.approveForSession('bash_execute');

    const executor = makeExecutor(adapter, provider, registry, permissions);
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    const result = await executor.execute({
      query: 'list files',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    expect(result.finalResponse).toBe('Listed files.');
    const toolResultEvents = events.filter((e) => e.type === 'tool_result');
    const first = toolResultEvents[0] as { type: 'tool_result'; result: ToolResult };
    expect(first.result.kind).toBe('success');
  });
});
