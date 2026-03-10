import type { AssistantMessage, ChatMessage } from '../types/chat.js';
import type { AIProvider } from '../types/index.js';
import { getModelContextWindow } from './model-catalog.js';

export interface SessionContextMetrics {
  usedTokens: number;
  maxContextTokens: number | undefined;
  usagePercent: number | null;
}

function getAssistantUsageTotal(message: AssistantMessage): number {
  return (message.usage?.inputTokens ?? 0) + (message.usage?.outputTokens ?? 0);
}

function getLastAssistantWithUsage(messages: ChatMessage[]): AssistantMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role !== 'assistant') {
      continue;
    }

    if (getAssistantUsageTotal(message) <= 0) {
      continue;
    }

    return message;
  }

  return undefined;
}

export function getSessionContextMetrics(
  messages: ChatMessage[],
  provider: AIProvider,
  model: string,
): SessionContextMetrics | undefined {
  const message = getLastAssistantWithUsage(messages);
  if (!message) {
    return undefined;
  }

  const usedTokens = getAssistantUsageTotal(message);
  const maxContextTokens = getModelContextWindow(provider, model);

  return {
    usedTokens,
    maxContextTokens,
    usagePercent: maxContextTokens ? Math.round((usedTokens / maxContextTokens) * 100) : null,
  };
}

export function formatCompactTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    const formatted =
      tokens >= 10_000_000 ? (tokens / 1_000_000).toFixed(0) : (tokens / 1_000_000).toFixed(1);
    return `${formatted.replace(/\.0$/, '')}M`;
  }

  if (tokens >= 1_000) {
    const formatted = tokens >= 10_000 ? (tokens / 1_000).toFixed(0) : (tokens / 1_000).toFixed(1);
    return `${formatted.replace(/\.0$/, '')}k`;
  }

  return tokens.toString();
}
