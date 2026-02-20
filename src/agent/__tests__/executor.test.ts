/**
 * Unit tests for AgentExecutor
 */
import { describe, expect, it, vi } from 'vitest';

import { PermissionGate } from '../../tools/permissions.js';
import { ToolRegistry } from '../../tools/registry.js';
import type { ToolDefinition, ToolResult } from '../../tools/types.js';
import type { ToolCallAdapter } from '../adapters/types.js';
import { ContextManager } from '../context-manager.js';
import { AgentExecutor } from '../executor.js';
import type { AgentConfig, AgentEvent, AgentToolCall, TokenUsage } from '../types.js';

function createMockAdapter(responses: Array<{
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
    extractTextContent: vi.fn(() => {
      const resp = responses[callIndex - 1];
      return resp?.text ?? '';
    }),
    extractTokenUsage: vi.fn(() => {
      const resp = responses[callIndex++];
      return resp?.usage ?? { inputTokens: 0, outputTokens: 0 };
    }),
  };
}

function createMockProvider(_callCount: number) {
  let calls = 0;
  return {
    generateCommand: vi.fn(),
    generateAlternatives: vi.fn(),
    explainCommand: vi.fn(),
    sendWithTools: vi.fn(async () => {
      calls++;
      return { call: calls };
    }),
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

describe('AgentExecutor', () => {
  it('returns text response when no tools are called', async () => {
    const adapter = createMockAdapter([
      { text: 'Hello!', toolCalls: [], isToolCall: false, usage: { inputTokens: 10, outputTokens: 5 } },
    ]);
    const provider = createMockProvider(1);
    const registry = new ToolRegistry();
    const permissions = new PermissionGate();
    const contextManager = new ContextManager();

    const executor = new AgentExecutor({ provider, adapter, registry, permissions, contextManager });
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    const result = await executor.execute({
      query: 'say hello',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    expect(result.finalResponse).toBe('Hello!');
    expect(result.usage.turns).toBe(1);
    expect(events.some((e) => e.type === 'text_delta')).toBe(true);
  });

  it('executes a tool call and returns final response', async () => {
    const adapter = createMockAdapter([
      { text: '', toolCalls: [{ id: 'tc1', name: 'file_read', input: { path: '/tmp/a.txt' } }], isToolCall: true, usage: { inputTokens: 20, outputTokens: 10 } },
      { text: 'File contents are: hello', toolCalls: [], isToolCall: false, usage: { inputTokens: 30, outputTokens: 15 } },
    ]);
    const provider = createMockProvider(2);
    const registry = new ToolRegistry();
    registry.register(mockTool('file_read', { kind: 'success', output: 'hello' }));
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());
    const contextManager = new ContextManager();

    const executor = new AgentExecutor({ provider, adapter, registry, permissions, contextManager });
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    const result = await executor.execute({
      query: 'read file',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    expect(result.finalResponse).toBe('File contents are: hello');
    expect(result.usage.turns).toBe(2);
    expect(events.some((e) => e.type === 'tool_start')).toBe(true);
    expect(events.some((e) => e.type === 'tool_result')).toBe(true);
  });

  it('detects doom loop after 3 identical tool calls', async () => {
    const repeatedCall: AgentToolCall = { id: 'tc1', name: 'file_read', input: { path: '/same' } };
    const adapter = createMockAdapter([
      { text: '', toolCalls: [repeatedCall], isToolCall: true, usage: { inputTokens: 5, outputTokens: 5 } },
      { text: '', toolCalls: [{ ...repeatedCall, id: 'tc2' }], isToolCall: true, usage: { inputTokens: 5, outputTokens: 5 } },
      { text: '', toolCalls: [{ ...repeatedCall, id: 'tc3' }], isToolCall: true, usage: { inputTokens: 5, outputTokens: 5 } },
    ]);
    const provider = createMockProvider(3);
    const registry = new ToolRegistry();
    registry.register(mockTool('file_read', { kind: 'success', output: 'data' }));
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());
    const contextManager = new ContextManager();

    const executor = new AgentExecutor({ provider, adapter, registry, permissions, contextManager });
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    const result = await executor.execute({
      query: 'read forever',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    expect(result.finalResponse).toContain('repeated identical');
    expect(events.some((e) => e.type === 'doom_loop')).toBe(true);
  });

  it('respects permission denial', async () => {
    const adapter = createMockAdapter([
      { text: '', toolCalls: [{ id: 'tc1', name: 'bash_execute', input: { command: 'rm -rf /' } }], isToolCall: true, usage: { inputTokens: 10, outputTokens: 5 } },
      { text: 'Cannot execute that.', toolCalls: [], isToolCall: false, usage: { inputTokens: 15, outputTokens: 8 } },
    ]);
    const provider = createMockProvider(2);
    const registry = new ToolRegistry();
    registry.register(mockTool('bash_execute', { kind: 'success', output: '' }));
    const permissions = new PermissionGate();
    permissions.setRule('bash_execute', 'deny');
    const contextManager = new ContextManager();

    const executor = new AgentExecutor({ provider, adapter, registry, permissions, contextManager });
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    await executor.execute({
      query: 'delete everything',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    const toolResultEvents = events.filter((e) => e.type === 'tool_result');
    expect(toolResultEvents.length).toBeGreaterThan(0);
    const firstResult = toolResultEvents[0] as { type: 'tool_result'; result: ToolResult };
    expect(firstResult.result.kind).toBe('denied');
  });

  it('handles abort signal', async () => {
    const adapter = createMockAdapter([]);
    const provider = createMockProvider(0);
    const registry = new ToolRegistry();
    const permissions = new PermissionGate();
    const contextManager = new ContextManager();

    const executor = new AgentExecutor({ provider, adapter, registry, permissions, contextManager });
    const events: AgentEvent[] = [];
    const controller = new AbortController();
    controller.abort();

    const result = await executor.execute({
      query: 'do something',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    expect(events.some((e) => e.type === 'aborted')).toBe(true);
    expect(result.finalResponse).toBe('');
  });

  it('returns unknown tool as error result', async () => {
    const adapter = createMockAdapter([
      { text: '', toolCalls: [{ id: 'tc1', name: 'nonexistent_tool', input: {} }], isToolCall: true, usage: { inputTokens: 10, outputTokens: 5 } },
      { text: 'Tool not found.', toolCalls: [], isToolCall: false, usage: { inputTokens: 15, outputTokens: 8 } },
    ]);
    const provider = createMockProvider(2);
    const registry = new ToolRegistry();
    const permissions = new PermissionGate();
    const contextManager = new ContextManager();

    const executor = new AgentExecutor({ provider, adapter, registry, permissions, contextManager });
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    await executor.execute({
      query: 'use unknown tool',
      config: baseConfig,
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    const toolResultEvents = events.filter((e) => e.type === 'tool_result');
    expect(toolResultEvents.length).toBeGreaterThan(0);
    const firstResult = toolResultEvents[0] as { type: 'tool_result'; result: ToolResult };
    expect(firstResult.result.kind).toBe('error');
  });

  it('returns non-empty summary when maxTurns is reached', async () => {
    const toolCall: AgentToolCall = { id: 'tc1', name: 'file_read', input: { path: '/a.txt' } };
    // Create an adapter that always returns tool calls (never completes naturally)
    const adapter = createMockAdapter([
      { text: '', toolCalls: [toolCall], isToolCall: true, usage: { inputTokens: 5, outputTokens: 5 } },
      // Summary call response (after max steps)
      { text: 'Summary of work done.', toolCalls: [], isToolCall: false, usage: { inputTokens: 10, outputTokens: 10 } },
    ]);
    const provider = createMockProvider(2);
    const registry = new ToolRegistry();
    registry.register(mockTool('file_read', { kind: 'success', output: 'data' }));
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());
    const contextManager = new ContextManager();

    const executor = new AgentExecutor({ provider, adapter, registry, permissions, contextManager });
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    const result = await executor.execute({
      query: 'do work',
      config: { ...baseConfig, maxTurns: 1 },
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    expect(result.finalResponse).not.toBe('');
    expect(result.finalResponse.length).toBeGreaterThan(0);
  });

  it('makes a final summary call when maxTurns is reached', async () => {
    const toolCall: AgentToolCall = { id: 'tc1', name: 'file_read', input: { path: '/a.txt' } };
    const adapter = createMockAdapter([
      { text: '', toolCalls: [toolCall], isToolCall: true, usage: { inputTokens: 5, outputTokens: 5 } },
      { text: 'Here is a summary.', toolCalls: [], isToolCall: false, usage: { inputTokens: 10, outputTokens: 10 } },
    ]);
    const provider = createMockProvider(2);
    const registry = new ToolRegistry();
    registry.register(mockTool('file_read', { kind: 'success', output: 'data' }));
    const permissions = new PermissionGate();
    permissions.registerDefaults(registry.list());
    const contextManager = new ContextManager();

    const executor = new AgentExecutor({ provider, adapter, registry, permissions, contextManager });
    const events: AgentEvent[] = [];
    const controller = new AbortController();

    await executor.execute({
      query: 'do work',
      config: { ...baseConfig, maxTurns: 1 },
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });

    // Provider should have been called twice: once for the tool loop, once for the summary
    expect(provider.sendWithTools).toHaveBeenCalledTimes(2);
  });
});
