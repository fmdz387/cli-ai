/**
 * Agent executor implementing the full agentic loop
 */

import { DOOM_LOOP_THRESHOLD, MAX_AGENT_STEPS } from '../constants.js';
import type { PermissionGate } from '../tools/permissions.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { ToolContext, ToolResult } from '../tools/types.js';
import type { Provider } from '../lib/providers/types.js';
import type { ToolCallAdapter } from './adapters/types.js';
import { ContextManager } from './context-manager.js';
import { buildInitialMessages } from './message-builder.js';
import type {
  AgentConfig,
  AgentMessage,
  AgentToolCall,
  CumulativeUsage,
  ExecutorResult,
  ExecutorRunOptions,
} from './types.js';

export interface ExecutorDependencies {
  provider: Provider;
  adapter: ToolCallAdapter;
  registry: ToolRegistry;
  permissions: PermissionGate;
  contextManager: ContextManager;
}

export class AgentExecutor {
  private deps: ExecutorDependencies;

  constructor(deps: ExecutorDependencies) {
    this.deps = deps;
  }

  async execute(options: ExecutorRunOptions): Promise<ExecutorResult> {
    const { query, config, signal, onEvent } = options;
    const { provider, adapter, registry, permissions, contextManager } = this.deps;

    const messages: AgentMessage[] = buildInitialMessages(query, {
      shell: config.context.shell,
      cwd: config.context.cwd,
      platform: config.context.platform,
    });

    const providerTools = registry.toProviderFormat();
    const adapterInput = providerTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.input_schema as unknown as Record<string, unknown>,
    }));
    const toolSchemas = adapter.formatTools(adapterInput);
    const usage: CumulativeUsage = { totalInputTokens: 0, totalOutputTokens: 0, turns: 0 };
    const recentCallHashes: string[] = [];

    for (let step = 0; step < config.maxTurns || MAX_AGENT_STEPS; step++) {
      if (signal.aborted) {
        onEvent({ type: 'aborted' });
        break;
      }

      if (contextManager.shouldCompact(messages)) {
        const compacted = contextManager.compact(messages);
        messages.length = 0;
        messages.push(...compacted);
      }

      const response = await provider.sendWithTools(messages, toolSchemas, {
        maxTokens: config.maxTokensPerTurn,
        signal,
      });

      const turnUsage = adapter.extractTokenUsage(response);
      usage.totalInputTokens += turnUsage.inputTokens;
      usage.totalOutputTokens += turnUsage.outputTokens;
      usage.turns++;

      const textContent = adapter.extractTextContent(response);
      if (textContent) {
        onEvent({ type: 'text_delta', text: textContent });
      }

      if (!adapter.isToolCallResponse(response)) {
        onEvent({ type: 'turn_complete', usage: turnUsage });
        if (textContent) {
          messages.push({ role: 'assistant', content: textContent });
        }
        return { finalResponse: textContent, usage };
      }

      const toolCalls = adapter.parseToolCalls(response);
      messages.push({ role: 'assistant', content: textContent, toolCalls });

      for (const toolCall of toolCalls) {
        if (signal.aborted) {
          onEvent({ type: 'aborted' });
          return { finalResponse: '', usage };
        }

        if (this.detectDoomLoop(recentCallHashes, toolCall)) {
          onEvent({ type: 'doom_loop', repeatedCall: toolCall });
          return { finalResponse: 'Stopped: repeated identical tool call detected.', usage };
        }

        onEvent({ type: 'tool_start', toolCall });
        const result = await this.executeTool(toolCall, config, signal, permissions);
        onEvent({ type: 'tool_result', toolCallId: toolCall.id, result });
        messages.push({
          role: 'tool_result',
          toolCallId: toolCall.id,
          name: toolCall.name,
          result,
        });
      }

      onEvent({ type: 'turn_complete', usage: turnUsage });
    }

    return { finalResponse: '', usage };
  }

  private async executeTool(
    toolCall: AgentToolCall,
    config: AgentConfig,
    signal: AbortSignal,
    permissions: PermissionGate,
  ): Promise<ToolResult> {
    const tool = this.deps.registry.get(toolCall.name);
    if (!tool) {
      return { kind: 'error', error: `Unknown tool: ${toolCall.name}` };
    }

    const level = permissions.check({
      toolName: toolCall.name,
      input: toolCall.input,
    });
    if (level === 'deny') {
      return { kind: 'denied', reason: `Tool ${toolCall.name} is denied by policy` };
    }

    const toolContext: ToolContext = {
      projectRoot: config.context.cwd,
      cwd: config.context.cwd,
      shell: config.context.shell,
      signal,
    };

    try {
      return await tool.execute(toolCall.input, toolContext);
    } catch (err) {
      return {
        kind: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private detectDoomLoop(recentHashes: string[], toolCall: AgentToolCall): boolean {
    const hash = this.hashToolCall(toolCall);
    recentHashes.push(hash);

    if (recentHashes.length < DOOM_LOOP_THRESHOLD) return false;

    const tail = recentHashes.slice(-DOOM_LOOP_THRESHOLD);
    const allSame = tail.every((h) => h === tail[0]);
    return allSame;
  }

  private hashToolCall(toolCall: AgentToolCall): string {
    return `${toolCall.name}:${JSON.stringify(toolCall.input)}`;
  }
}
