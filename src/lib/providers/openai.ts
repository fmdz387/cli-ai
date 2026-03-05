import type { AgentMessage } from '../../agent/types.js';
import { MAX_AI_TOKENS, VERSION } from '../../constants.js';
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

import type { CodexOAuthCredentials } from '../codex-auth.js';
import { refreshCodexToken, CODEX_API_ENDPOINT } from '../codex-auth.js';
import OpenAI from 'openai';
import { release } from 'node:os';

interface OpenAIProviderApiKeyOptions {
  mode: 'api-key';
  apiKey: string;
  model: string;
}

interface OpenAIProviderCodexOptions {
  mode: 'codex-oauth';
  credentials: CodexOAuthCredentials;
  model: string;
  onTokenRefresh: (newCredentials: CodexOAuthCredentials) => void;
}

type OpenAIProviderOptions = OpenAIProviderApiKeyOptions | OpenAIProviderCodexOptions;

export type { OpenAIProviderOptions };

export class OpenAIProvider implements Provider {
  private client: OpenAI;
  private model: string;
  private mode: 'api-key' | 'codex-oauth';
  private credentials?: CodexOAuthCredentials;
  private onTokenRefresh?: (newCredentials: CodexOAuthCredentials) => void;

  constructor(options: OpenAIProviderOptions) {
    this.model = options.model;
    this.mode = options.mode;

    if (options.mode === 'codex-oauth') {
      this.credentials = options.credentials;
      this.onTokenRefresh = options.onTokenRefresh;
      this.client = new OpenAI({
        apiKey: 'codex-placeholder',
        fetch: this.createCodexFetch(),
      });
    } else {
      this.client = new OpenAI({ apiKey: options.apiKey });
    }
  }

  private createCodexFetch(): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);
      headers.delete('Authorization');
      headers.delete('authorization');

      // Check token expiry, refresh if needed
      if (!this.credentials?.accessToken || this.credentials.expiresAt < Date.now()) {
        const newCreds = await refreshCodexToken(this.credentials!.refreshToken);
        this.credentials = newCreds;
        this.onTokenRefresh?.(newCreds);
      }

      // Set auth headers
      headers.set('Authorization', `Bearer ${this.credentials!.accessToken}`);
      if (this.credentials!.accountId) {
        headers.set('ChatGPT-Account-Id', this.credentials!.accountId);
      }
      headers.set('originator', 'codex');
      headers.set(
        'User-Agent',
        `cli-ai/${VERSION} (${process.platform} ${release()}; ${process.arch})`,
      );

      // Rewrite URL to Codex endpoint
      const url =
        typeof input === 'string'
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL(input.url);

      const isCodexRewrite =
        url.pathname.includes('/v1/responses') || url.pathname.includes('/chat/completions');
      const targetUrl = isCodexRewrite ? CODEX_API_ENDPOINT : url.toString();

      // Transform body for Codex endpoint requirements:
      // - input must be an array, not a string
      // - store must be false
      // - stream must be true
      let body = init?.body;
      if (isCodexRewrite && body) {
        const parsed = JSON.parse(body as string);
        if (typeof parsed.input === 'string') {
          parsed.input = [{ role: 'user', content: parsed.input }];
        }
        if (Array.isArray(parsed.input)) {
          // Strip item IDs from input array
          for (const item of parsed.input) {
            if ('id' in item) delete item.id;
          }
          // Extract developer/system messages into instructions field
          // (Codex requires instructions as a top-level field)
          if (!parsed.instructions) {
            const devMessages: string[] = [];
            parsed.input = parsed.input.filter(
              (item: { role: string; content: string }) => {
                if (item.role === 'developer' || item.role === 'system') {
                  devMessages.push(item.content);
                  return false;
                }
                return true;
              },
            );
            if (devMessages.length > 0) {
              parsed.instructions = devMessages.join('\n\n');
            }
          }
        }
        // Codex endpoint requires these exact settings
        parsed.store = false;
        parsed.stream = true;
        delete parsed.max_output_tokens;
        body = JSON.stringify(parsed);
      }

      const response = await fetch(targetUrl, { ...init, body, headers });

      // Collect SSE stream into a single JSON response for the SDK
      if (isCodexRewrite && response.ok && response.body) {
        return collectSSEResponse(response);
      }

      // Log Codex errors to stderr for debugging
      if (isCodexRewrite && !response.ok) {
        const clone = response.clone();
        clone.text().then((errBody) => {
          process.stderr.write(`[codex] ${response.status}: ${errBody}\n`);
        }).catch(() => {});
      }

      return response;
    };
  }

  async generateCommand(
    query: string,
    context: SessionContext,
  ): Promise<Result<CommandProposal>> {
    for (let attempt = 0; attempt < AI_RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        const response = await (this.client as any).responses.create({
          model: this.model,
          instructions: buildSystemPrompt(context.shell),
          input: buildUserPrompt(query, context),
          max_output_tokens: MAX_AI_TOKENS,
        });

        const content = response.output_text;
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
      const response = await (this.client as any).responses.create({
        model: this.model,
        instructions: buildSystemPrompt(context.shell),
        input: altPrompt,
        max_output_tokens: MAX_AI_TOKENS * 2,
      });

      const content = response.output_text;
      if (!content) {
        throw new Error('No content in AI response');
      }

      return { success: true, data: parseAlternativesResponse(content) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async explainCommand(command: string): Promise<Result<string>> {
    try {
      const response = await (this.client as any).responses.create({
        model: this.model,
        input: `Explain this command briefly (2-3 sentences max):\n${command}`,
        max_output_tokens: MAX_AI_TOKENS,
      });

      const content = response.output_text;
      if (!content) {
        throw new Error('No content in AI response');
      }

      return { success: true, data: content.trim() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async sendWithTools(
    messages: AgentMessage[],
    tools: unknown,
    options: SendWithToolsOptions,
  ): Promise<unknown> {
    // Convert Chat Completions tool format to Responses API format
    const responsesTools = (
      tools as Array<{
        type: string;
        function: { name: string; description: string; parameters: unknown };
      }>
    ).map((tool) => ({
      type: 'function' as const,
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    }));

    // Build input from messages
    const input = formatMessagesForResponses(messages);

    const response = await (this.client as any).responses.create(
      {
        model: this.model,
        input,
        tools: responsesTools,
        max_output_tokens: options.maxTokens,
      },
      options.signal ? { signal: options.signal } : {},
    );

    // Convert Responses API format to Chat Completions format
    // so the existing OpenAI adapter can parse it
    return responsesToChatCompletion(response);
  }
}

/**
 * Collect an SSE stream from the Codex endpoint and return a synthetic
 * JSON Response containing the completed response object. This lets
 * the OpenAI SDK parse it as a normal non-streaming response.
 */
async function collectSSEResponse(sseResponse: Response): Promise<Response> {
  const reader = sseResponse.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResponse: unknown = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const event = JSON.parse(data);
        if (event.type === 'response.completed') {
          finalResponse = event.response;
        }
      } catch {
        // Skip malformed events
      }
    }
  }

  if (!finalResponse) {
    return new Response(JSON.stringify({ error: 'No response.completed event in stream' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // The Codex response doesn't include output_text at the top level,
  // but the OpenAI SDK expects it. Synthesize it from output items.
  const resp = finalResponse as Record<string, unknown>;
  if (!resp.output_text && Array.isArray(resp.output)) {
    const texts: string[] = [];
    for (const item of resp.output as Array<Record<string, unknown>>) {
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const part of item.content as Array<Record<string, unknown>>) {
          if (part.type === 'output_text' && typeof part.text === 'string') {
            texts.push(part.text);
          }
        }
      }
    }
    resp.output_text = texts.join('');
  }

  return new Response(JSON.stringify(resp), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Convert a Responses API response into Chat Completions format
 * so the existing OpenAI adapter (which expects choices/message/tool_calls)
 * can parse it without changes.
 */
function responsesToChatCompletion(resp: Record<string, unknown>): Record<string, unknown> {
  const output = resp.output as Array<Record<string, unknown>> | undefined;
  let textContent = '';
  const toolCalls: Array<Record<string, unknown>> = [];

  if (Array.isArray(output)) {
    for (const item of output) {
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const part of item.content as Array<Record<string, unknown>>) {
          if (part.type === 'output_text' && typeof part.text === 'string') {
            textContent += part.text;
          }
        }
      } else if (item.type === 'function_call') {
        toolCalls.push({
          id: item.call_id ?? item.id ?? `call_${toolCalls.length}`,
          type: 'function',
          function: {
            name: item.name,
            arguments: typeof item.arguments === 'string'
              ? item.arguments
              : JSON.stringify(item.arguments),
          },
        });
      }
    }
  }

  const usage = resp.usage as Record<string, number> | undefined;
  const hasToolCalls = toolCalls.length > 0;
  const finishReason = resp.status === 'incomplete'
    ? 'length'
    : hasToolCalls ? 'tool_calls' : 'stop';

  return {
    id: resp.id,
    object: 'chat.completion',
    model: resp.model,
    choices: [
      {
        index: 0,
        finish_reason: finishReason,
        message: {
          role: 'assistant',
          content: textContent || null,
          ...(hasToolCalls && { tool_calls: toolCalls }),
        },
      },
    ],
    usage: {
      prompt_tokens: usage?.input_tokens ?? 0,
      completion_tokens: usage?.output_tokens ?? 0,
      total_tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    },
  };
}

/**
 * Format agent messages into OpenAI Responses API input items.
 * - system/developer → { role: 'developer', content: string }
 * - user → { role: 'user', content: [{ type: 'input_text', text }] }
 * - assistant → { role: 'assistant', content: [{ type: 'output_text', text }] }
 * - assistant with tool calls → function_call items
 * - tool results → function_call_output items (when store=false, kept inline)
 */
function formatMessagesForResponses(
  messages: AgentMessage[],
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      result.push({ role: 'developer', content: msg.content });
    } else if (msg.role === 'user') {
      result.push({
        role: 'user',
        content: [{ type: 'input_text', text: msg.content }],
      });
    } else if (msg.role === 'assistant') {
      const text = msg.content || '';
      if (text) {
        result.push({
          role: 'assistant',
          content: [{ type: 'output_text', text }],
        });
      }
      // Emit function_call items for each tool call
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          result.push({
            type: 'function_call',
            call_id: tc.id,
            name: tc.name,
            arguments: JSON.stringify(tc.input),
          });
        }
      }
    } else if (msg.role === 'tool_result') {
      const output =
        msg.result.kind === 'success'
          ? msg.result.output
          : msg.result.kind === 'error'
            ? msg.result.error
            : msg.result.reason;
      result.push({
        type: 'function_call_output',
        call_id: msg.toolCallId,
        output: output,
      });
    }
  }

  return result;
}
