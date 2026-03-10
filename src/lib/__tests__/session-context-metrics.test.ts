import type { ChatMessage } from '../../types/chat.js';
import { formatCompactTokenCount, getSessionContextMetrics } from '../session-context-metrics.js';

import { describe, expect, it } from 'vitest';

describe('getSessionContextMetrics', () => {
  it('uses the latest assistant turn and selected model context window', () => {
    const messages: ChatMessage[] = [
      { role: 'user', text: 'one', timestamp: 1 },
      {
        role: 'assistant',
        parts: [],
        isStreaming: false,
        timestamp: 2,
        usage: { inputTokens: 400, outputTokens: 100 },
      },
      { role: 'user', text: 'two', timestamp: 3 },
      {
        role: 'assistant',
        parts: [],
        isStreaming: false,
        timestamp: 4,
        usage: { inputTokens: 2_000, outputTokens: 500 },
      },
    ];

    const metrics = getSessionContextMetrics(messages, 'anthropic', 'claude-sonnet-4-5');

    expect(metrics).toEqual({
      usedTokens: 2_500,
      maxContextTokens: 200_000,
      usagePercent: 1,
    });
  });

  it('returns a metric without a ratio when the model limit is unknown', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        parts: [],
        isStreaming: false,
        timestamp: 1,
        usage: { inputTokens: 123, outputTokens: 77 },
      },
    ];

    const metrics = getSessionContextMetrics(messages, 'openrouter', 'xiaomi/mimo-v2-flash:free');

    expect(metrics).toEqual({
      usedTokens: 200,
      maxContextTokens: undefined,
      usagePercent: null,
    });
  });
});

describe('formatCompactTokenCount', () => {
  it('formats token counts compactly for the status bar', () => {
    expect(formatCompactTokenCount(999)).toBe('999');
    expect(formatCompactTokenCount(1_250)).toBe('1.3k');
    expect(formatCompactTokenCount(18_000)).toBe('18k');
    expect(formatCompactTokenCount(1_048_576)).toBe('1M');
  });
});
