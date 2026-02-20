import type { AgentMessage } from '../../agent/types.js';
import { MAX_AI_TOKENS } from '../../constants.js';
import type { CommandProposal, Result, SessionContext } from '../../types/index.js';
import {
  AI_RETRY_CONFIG,
  buildSystemPrompt,
  buildUserPrompt,
  parseAlternativesResponse,
  parseCommandResponse,
  sleep,
  type Provider,
  type SendWithToolsOptions,
} from './types.js';

import OpenAI from 'openai';

export class OpenAIProvider implements Provider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateCommand(query: string, context: SessionContext): Promise<Result<CommandProposal>> {
    for (let attempt = 0; attempt < AI_RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: MAX_AI_TOKENS,
          messages: [
            { role: 'system', content: buildSystemPrompt(context.shell) },
            { role: 'user', content: buildUserPrompt(query, context) },
          ],
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content in AI response');
        }

        return { success: true, data: parseCommandResponse(content) };
      } catch (error) {
        if (attempt === AI_RETRY_CONFIG.maxAttempts - 1) {
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
        const delay = Math.min(
          AI_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
          AI_RETRY_CONFIG.maxDelayMs,
        );
        await sleep(delay);
      }
    }
    return { success: false, error: new Error('Unexpected error') };
  }

  async generateAlternatives(
    query: string,
    context: SessionContext,
    exclude: string,
    count: number,
  ): Promise<Result<CommandProposal[]>> {
    const altPrompt = `${buildUserPrompt(query, context)}

Generate ${count} ALTERNATIVE commands (different approaches).
Exclude: ${exclude}

Output JSON array: [{ "command": "...", "risk": "low|medium|high" }, ...]`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: MAX_AI_TOKENS * 2,
        messages: [
          { role: 'system', content: buildSystemPrompt(context.shell) },
          { role: 'user', content: altPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in AI response');
      }

      return { success: true, data: parseAlternativesResponse(content) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async explainCommand(command: string): Promise<Result<string>> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: MAX_AI_TOKENS,
        messages: [
          {
            role: 'user',
            content: `Explain this command briefly (2-3 sentences max):\n${command}`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in AI response');
      }

      return { success: true, data: content.trim() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async sendWithTools(
    messages: AgentMessage[],
    tools: unknown,
    options: SendWithToolsOptions,
  ): Promise<unknown> {
    return this.client.chat.completions.create({
      model: this.model,
      max_tokens: options.maxTokens,
      messages: formatOpenAIMessages(messages),
      tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
      ...(options.signal ? { signal: options.signal } : {}),
    });
  }
}

function formatOpenAIMessages(
  messages: AgentMessage[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      result.push({ role: 'system', content: msg.content });
    } else if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      const assistantMsg: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: msg.content || null,
      };
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        }));
      }
      result.push(assistantMsg);
    } else if (msg.role === 'tool_result') {
      const content = msg.result.kind === 'success'
        ? msg.result.output
        : msg.result.kind === 'error'
          ? msg.result.error
          : msg.result.reason;
      result.push({ role: 'tool', tool_call_id: msg.toolCallId, content });
    }
  }

  return result;
}
