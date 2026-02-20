/**
 * Unit tests for ContextManager
 */
import { describe, expect, it } from 'vitest';

import type { AgentMessage } from '../types.js';
import { ContextManager } from '../context-manager.js';

function msg(role: 'system' | 'user' | 'assistant', content: string): AgentMessage {
  if (role === 'assistant') return { role, content };
  return { role, content };
}

function toolResult(id: string, name: string, output: string): AgentMessage {
  return { role: 'tool_result', toolCallId: id, name, result: { kind: 'success', output } };
}

function assistantWithTools(content: string, tools: Array<{ id: string; name: string; input: Record<string, unknown> }>): AgentMessage {
  return { role: 'assistant', content, toolCalls: tools };
}

describe('ContextManager', () => {
  describe('estimateTokens', () => {
    it('estimates tokens for simple messages', () => {
      const mgr = new ContextManager();
      const messages: AgentMessage[] = [
        msg('system', 'You are a helper.'),
        msg('user', 'Hello'),
      ];
      const tokens = mgr.estimateTokens(messages);
      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('estimates higher tokens for longer messages', () => {
      const mgr = new ContextManager();
      const short: AgentMessage[] = [msg('user', 'hi')];
      const long: AgentMessage[] = [msg('user', 'x'.repeat(10000))];
      expect(mgr.estimateTokens(long)).toBeGreaterThan(mgr.estimateTokens(short));
    });

    it('accounts for tool call messages', () => {
      const mgr = new ContextManager();
      const withTools: AgentMessage[] = [
        assistantWithTools('reading file', [
          { id: 'tc1', name: 'file_read', input: { filePath: '/very/long/path/to/file.ts' } },
        ]),
      ];
      const withoutTools: AgentMessage[] = [msg('assistant', 'reading file')];
      expect(mgr.estimateTokens(withTools)).toBeGreaterThan(mgr.estimateTokens(withoutTools));
    });

    it('accounts for tool_result messages', () => {
      const mgr = new ContextManager();
      const messages: AgentMessage[] = [
        toolResult('tc1', 'file_read', 'line1\nline2\nline3'),
      ];
      const tokens = mgr.estimateTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('handles error and denied tool results', () => {
      const mgr = new ContextManager();
      const errorMsg: AgentMessage = {
        role: 'tool_result', toolCallId: 'tc1', name: 'bash_execute',
        result: { kind: 'error', error: 'command not found' },
      };
      const deniedMsg: AgentMessage = {
        role: 'tool_result', toolCallId: 'tc2', name: 'bash_execute',
        result: { kind: 'denied', reason: 'user denied' },
      };
      expect(mgr.estimateTokens([errorMsg])).toBeGreaterThan(0);
      expect(mgr.estimateTokens([deniedMsg])).toBeGreaterThan(0);
    });
  });

  describe('shouldCompact', () => {
    it('returns false for small conversations', () => {
      const mgr = new ContextManager();
      const messages: AgentMessage[] = [
        msg('system', 'Helper'),
        msg('user', 'hi'),
        msg('assistant', 'hello'),
      ];
      expect(mgr.shouldCompact(messages)).toBe(false);
    });

    it('returns true when token estimate exceeds budget', () => {
      // Use a very low threshold to trigger compaction
      const mgr = new ContextManager(100);
      const messages: AgentMessage[] = [
        msg('system', 'You are a very detailed assistant.'),
        msg('user', 'Please do a long task.'),
        msg('assistant', 'I will start by reading many files. '.repeat(50)),
        toolResult('tc1', 'file_read', 'content '.repeat(200)),
        msg('assistant', 'Now let me process these results. '.repeat(50)),
      ];
      expect(mgr.shouldCompact(messages)).toBe(true);
    });
  });

  describe('compact', () => {
    it('returns copy for 2 or fewer messages', () => {
      const mgr = new ContextManager();
      const messages: AgentMessage[] = [
        msg('system', 'Helper'),
        msg('user', 'hi'),
      ];
      const compacted = mgr.compact(messages);
      expect(compacted).toHaveLength(2);
      expect(compacted[0]).toEqual(messages[0]);
      expect(compacted[1]).toEqual(messages[1]);
      // Ensure it's a copy, not the same reference
      expect(compacted).not.toBe(messages);
    });

    it('preserves system and first user message', () => {
      const mgr = new ContextManager();
      const sysMsg = msg('system', 'system prompt');
      const userMsg = msg('user', 'user query');
      const messages: AgentMessage[] = [
        sysMsg, userMsg,
        msg('assistant', 'step 1'),
        toolResult('tc1', 'file_read', 'content1'),
        msg('assistant', 'step 2'),
        toolResult('tc2', 'file_read', 'content2'),
        msg('assistant', 'step 3'),
        toolResult('tc3', 'file_read', 'content3'),
        msg('assistant', 'step 4'),
        toolResult('tc4', 'file_read', 'content4'),
        msg('assistant', 'step 5 - latest'),
      ];
      const compacted = mgr.compact(messages);
      expect(compacted[0]).toEqual(sysMsg);
      expect(compacted[1]).toEqual(userMsg);
    });

    it('preserves last 3 tool interactions', () => {
      const mgr = new ContextManager();
      const messages: AgentMessage[] = [
        msg('system', 'sys'),
        msg('user', 'query'),
        msg('assistant', 'old step 1'),
        toolResult('tc1', 'file_read', 'old content'),
        msg('assistant', 'old step 2'),
        toolResult('tc2', 'file_read', 'old content 2'),
        assistantWithTools('recent step 1', [{ id: 'tc3', name: 'file_read', input: { filePath: 'a.ts' } }]),
        toolResult('tc3', 'file_read', 'recent content 1'),
        assistantWithTools('recent step 2', [{ id: 'tc4', name: 'grep_search', input: { pattern: 'foo' } }]),
        toolResult('tc4', 'grep_search', 'recent content 2'),
        assistantWithTools('recent step 3', [{ id: 'tc5', name: 'bash_execute', input: { command: 'ls' } }]),
        toolResult('tc5', 'bash_execute', 'recent content 3'),
      ];
      const compacted = mgr.compact(messages);

      // Should contain system, user, summary, and recent interactions
      const roles = compacted.map((m) => m.role);
      expect(roles[0]).toBe('system');
      expect(roles[1]).toBe('user');

      // Should have the recent assistant+tool_result pairs preserved
      const assistantMsgs = compacted.filter((m) => m.role === 'assistant');
      expect(assistantMsgs.length).toBeGreaterThanOrEqual(3);
    });

    it('generates summary of compacted middle messages', () => {
      const mgr = new ContextManager();
      const messages: AgentMessage[] = [
        msg('system', 'sys'),
        msg('user', 'query'),
        assistantWithTools('reading file', [{ id: 'tc1', name: 'file_read', input: {} }]),
        toolResult('tc1', 'file_read', 'some file content'),
        assistantWithTools('searching code', [{ id: 'tc2', name: 'grep_search', input: {} }]),
        toolResult('tc2', 'grep_search', 'search results'),
        // These are the "recent" ones that won't be summarized
        msg('assistant', 'recent 1'),
        msg('assistant', 'recent 2'),
        msg('assistant', 'recent 3'),
      ];
      const compacted = mgr.compact(messages);

      // Look for the summary message
      const summaryMsg = compacted.find(
        (m) => m.role === 'user' && 'content' in m && m.content.includes('[Context summary'),
      );
      expect(summaryMsg).toBeDefined();
      if (summaryMsg && summaryMsg.role === 'user') {
        expect(summaryMsg.content).toContain('file_read');
      }
    });

    it('reduces message count after compaction', () => {
      const mgr = new ContextManager();
      const messages: AgentMessage[] = [
        msg('system', 'sys'),
        msg('user', 'query'),
      ];
      // Add 10 assistant+tool_result pairs
      for (let i = 0; i < 10; i++) {
        messages.push(
          assistantWithTools(`step ${i}`, [{ id: `tc${i}`, name: 'file_read', input: {} }]),
          toolResult(`tc${i}`, 'file_read', `output ${i}`),
        );
      }
      const compacted = mgr.compact(messages);
      expect(compacted.length).toBeLessThan(messages.length);
    });
  });
});
