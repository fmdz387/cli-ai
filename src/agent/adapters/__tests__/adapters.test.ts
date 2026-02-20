/**
 * Unit tests for provider tool call adapters
 */
import { describe, expect, it } from 'vitest';

import { AnthropicToolAdapter } from '../anthropic-adapter.js';
import { OpenAIToolAdapter } from '../openai-adapter.js';
import { OpenRouterToolAdapter } from '../openrouter-adapter.js';

const sampleTools = [
  {
    name: 'file_read',
    description: 'Read a file',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
] as const;

describe('AnthropicToolAdapter', () => {
  const adapter = new AnthropicToolAdapter();

  it('formatTools produces Anthropic tool format', () => {
    const formatted = adapter.formatTools(sampleTools) as Array<{ name: string; input_schema: Record<string, unknown> }>;
    expect(formatted).toHaveLength(1);
    expect(formatted[0]!.name).toBe('file_read');
    expect(formatted[0]!.input_schema).toHaveProperty('type', 'object');
  });

  it('parseToolCalls extracts tool_use blocks', () => {
    const response = {
      content: [
        { type: 'text', text: 'Let me read that file.' },
        { type: 'tool_use', id: 'tc_1', name: 'file_read', input: { path: '/tmp/f.txt' } },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 20 },
    };
    const calls = adapter.parseToolCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.id).toBe('tc_1');
    expect(calls[0]!.name).toBe('file_read');
    expect(calls[0]!.input).toEqual({ path: '/tmp/f.txt' });
  });

  it('formatToolResults produces tool_result blocks', () => {
    const results = adapter.formatToolResults([
      { toolCallId: 'tc_1', content: 'file contents here' },
    ]) as Array<{ type: string; tool_use_id: string; content: string }>;
    expect(results).toHaveLength(1);
    expect(results[0]!.type).toBe('tool_result');
    expect(results[0]!.tool_use_id).toBe('tc_1');
  });

  it('isToolCallResponse detects tool_use stop reason', () => {
    expect(adapter.isToolCallResponse({ stop_reason: 'tool_use', content: [], usage: { input_tokens: 0, output_tokens: 0 } })).toBe(true);
    expect(adapter.isToolCallResponse({ stop_reason: 'end_turn', content: [], usage: { input_tokens: 0, output_tokens: 0 } })).toBe(false);
  });

  it('extractTextContent joins text blocks', () => {
    const response = {
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'tool_use', id: 'tc_1', name: 'file_read', input: {} },
        { type: 'text', text: 'world' },
      ],
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 10 },
    };
    expect(adapter.extractTextContent(response)).toBe('Hello world');
  });

  it('extractTokenUsage returns usage data', () => {
    const response = {
      content: [],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    };
    const usage = adapter.extractTokenUsage(response);
    expect(usage.inputTokens).toBe(100);
    expect(usage.outputTokens).toBe(50);
  });
});

describe('OpenAIToolAdapter', () => {
  const adapter = new OpenAIToolAdapter();

  it('formatTools produces OpenAI function tool format', () => {
    const formatted = adapter.formatTools(sampleTools) as Array<{ type: string; function: { name: string } }>;
    expect(formatted).toHaveLength(1);
    expect(formatted[0]!.type).toBe('function');
    expect(formatted[0]!.function.name).toBe('file_read');
  });

  it('parseToolCalls extracts function tool calls', () => {
    const response = {
      choices: [{
        message: {
          content: null,
          role: 'assistant',
          refusal: null,
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'file_read', arguments: '{"path":"/tmp/f.txt"}' },
          }],
        },
        finish_reason: 'tool_calls',
        index: 0,
      }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    };
    const calls = adapter.parseToolCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.id).toBe('call_1');
    expect(calls[0]!.name).toBe('file_read');
    expect(calls[0]!.input).toEqual({ path: '/tmp/f.txt' });
  });

  it('formatToolResults produces tool message format', () => {
    const results = adapter.formatToolResults([
      { toolCallId: 'call_1', content: 'file contents' },
    ]) as Array<{ role: string; tool_call_id: string; content: string }>;
    expect(results).toHaveLength(1);
    expect(results[0]!.role).toBe('tool');
    expect(results[0]!.tool_call_id).toBe('call_1');
  });

  it('isToolCallResponse detects tool_calls finish reason', () => {
    const withTools = { choices: [{ finish_reason: 'tool_calls', message: { content: null, role: 'assistant', refusal: null }, index: 0 }] };
    const withStop = { choices: [{ finish_reason: 'stop', message: { content: 'done', role: 'assistant', refusal: null }, index: 0 }] };
    expect(adapter.isToolCallResponse(withTools)).toBe(true);
    expect(adapter.isToolCallResponse(withStop)).toBe(false);
  });

  it('extractTextContent returns message content', () => {
    const response = {
      choices: [{ message: { content: 'Hello world', role: 'assistant', refusal: null }, finish_reason: 'stop', index: 0 }],
    };
    expect(adapter.extractTextContent(response)).toBe('Hello world');
  });

  it('extractTokenUsage returns usage data', () => {
    const response = {
      choices: [{ message: { content: '', role: 'assistant', refusal: null }, finish_reason: 'stop', index: 0 }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    };
    const usage = adapter.extractTokenUsage(response);
    expect(usage.inputTokens).toBe(100);
    expect(usage.outputTokens).toBe(50);
  });
});

describe('OpenRouterToolAdapter', () => {
  const adapter = new OpenRouterToolAdapter();

  it('formatTools delegates to OpenAI format', () => {
    const formatted = adapter.formatTools(sampleTools) as Array<{ type: string; function: { name: string } }>;
    expect(formatted).toHaveLength(1);
    expect(formatted[0]!.type).toBe('function');
    expect(formatted[0]!.function.name).toBe('file_read');
  });

  it('parseToolCalls delegates to OpenAI parsing', () => {
    const response = {
      choices: [{
        message: {
          content: null,
          role: 'assistant',
          refusal: null,
          tool_calls: [{
            id: 'call_2',
            type: 'function',
            function: { name: 'file_read', arguments: '{"path":"/etc/hosts"}' },
          }],
        },
        finish_reason: 'tool_calls',
        index: 0,
      }],
    };
    const calls = adapter.parseToolCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.id).toBe('call_2');
  });

  it('isToolCallResponse delegates to OpenAI detection', () => {
    const response = { choices: [{ finish_reason: 'tool_calls', message: { content: null, role: 'assistant', refusal: null }, index: 0 }] };
    expect(adapter.isToolCallResponse(response)).toBe(true);
  });

  it('extractTextContent delegates to OpenAI extraction', () => {
    const response = {
      choices: [{ message: { content: 'result text', role: 'assistant', refusal: null }, finish_reason: 'stop', index: 0 }],
    };
    expect(adapter.extractTextContent(response)).toBe('result text');
  });
});
