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
} from './types.js';
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider implements Provider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generateCommand(query: string, context: SessionContext): Promise<Result<CommandProposal>> {
    for (let attempt = 0; attempt < AI_RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: MAX_AI_TOKENS,
          system: buildSystemPrompt(context.shell),
          messages: [{ role: 'user', content: buildUserPrompt(query, context) }],
        });

        const textContent = response.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in AI response');
        }

        return { success: true, data: parseCommandResponse(textContent.text) };
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
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_AI_TOKENS * 2,
        system: buildSystemPrompt(context.shell),
        messages: [{ role: 'user', content: altPrompt }],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in AI response');
      }

      return { success: true, data: parseAlternativesResponse(textContent.text) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async explainCommand(command: string): Promise<Result<string>> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_AI_TOKENS,
        messages: [
          {
            role: 'user',
            content: `Explain this command briefly (2-3 sentences max):\n${command}`,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in AI response');
      }

      return { success: true, data: textContent.text.trim() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
