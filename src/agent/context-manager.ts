/**
 * Context manager for agent message history
 * Handles token estimation and context compaction
 */

import { CONTEXT_COMPACTION_THRESHOLD } from '../constants.js';
import type { AgentMessage } from './types.js';

const CHARS_PER_TOKEN = 4;
const JSON_OVERHEAD_FACTOR = 1.15;
const OUTPUT_RESERVE_TOKENS = 4096;
const COMPACTION_RATIO = 0.8;
const PRESERVED_TAIL_INTERACTIONS = 3;

export class ContextManager {
  private tokenLimit: number;

  constructor(tokenLimit = CONTEXT_COMPACTION_THRESHOLD) {
    this.tokenLimit = tokenLimit;
  }

  estimateTokens(messages: ReadonlyArray<AgentMessage>): number {
    let totalChars = 0;
    for (const msg of messages) {
      totalChars += this.messageCharCount(msg);
    }
    return Math.ceil((totalChars * JSON_OVERHEAD_FACTOR) / CHARS_PER_TOKEN);
  }

  shouldCompact(messages: ReadonlyArray<AgentMessage>): boolean {
    const budget = (this.tokenLimit - OUTPUT_RESERVE_TOKENS) * COMPACTION_RATIO;
    return this.estimateTokens(messages) > budget;
  }

  compact(messages: ReadonlyArray<AgentMessage>): AgentMessage[] {
    if (messages.length <= 2) return [...messages];

    const systemMsg = messages.find((m) => m.role === 'system');
    const userMsg = messages.find((m) => m.role === 'user');

    const toolInteractions = this.extractTailInteractions(messages);
    const middleMessages = this.extractMiddleMessages(messages, toolInteractions);
    const summary = this.summarizeMessages(middleMessages);

    const result: AgentMessage[] = [];
    if (systemMsg) result.push(systemMsg);
    if (userMsg) result.push(userMsg);
    if (summary) {
      result.push({ role: 'user', content: `[Context summary of prior steps]\n${summary}` });
    }
    result.push(...toolInteractions);
    return result;
  }

  private messageCharCount(msg: AgentMessage): number {
    let chars = msg.role.length;
    if (msg.role === 'tool_result') {
      chars += msg.toolCallId.length + msg.name.length;
      chars += msg.result.kind === 'success'
        ? msg.result.output.length
        : msg.result.kind === 'error'
          ? msg.result.error.length
          : msg.result.reason.length;
    } else {
      chars += msg.content.length;
    }
    if (msg.role === 'assistant' && msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        chars += tc.name.length + JSON.stringify(tc.input).length;
      }
    }
    return chars;
  }

  private extractTailInteractions(
    messages: ReadonlyArray<AgentMessage>,
  ): AgentMessage[] {
    const tail: AgentMessage[] = [];
    let interactionCount = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]!;
      if (msg.role === 'system' || msg.role === 'user' && i <= 1) continue;
      tail.unshift(msg);
      if (msg.role === 'assistant') {
        interactionCount++;
        if (interactionCount >= PRESERVED_TAIL_INTERACTIONS) break;
      }
    }

    return tail;
  }

  private extractMiddleMessages(
    messages: ReadonlyArray<AgentMessage>,
    tailMessages: ReadonlyArray<AgentMessage>,
  ): AgentMessage[] {
    const tailSet = new Set(tailMessages);
    return messages.filter((m, i) => {
      if (m.role === 'system') return false;
      if (m.role === 'user' && i <= 1) return false;
      return !tailSet.has(m);
    });
  }

  private summarizeMessages(messages: ReadonlyArray<AgentMessage>): string {
    if (messages.length === 0) return '';
    const parts: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'assistant') {
        const text = msg.content ? msg.content.slice(0, 200) : '';
        const toolNames = msg.toolCalls?.map((tc) => tc.name).join(', ') ?? '';
        if (toolNames) {
          parts.push(`- Called: ${toolNames}${text ? `. ${text}` : ''}`);
        } else if (text) {
          parts.push(`- ${text}`);
        }
      } else if (msg.role === 'tool_result') {
        const status = msg.result.kind;
        parts.push(`- Tool ${msg.name}: ${status}`);
      }
    }
    return parts.join('\n');
  }
}
