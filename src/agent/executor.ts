/**
 * Agent executor implementing the full agentic loop
 */

import { execSync } from 'node:child_process';

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
  RequestPermission,
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
    const { query, config, signal, onEvent, requestPermission } = options;
    const { provider, adapter, registry, permissions, contextManager } = this.deps;

    const messages: AgentMessage[] = options.history
      ? [...options.history, { role: 'user' as const, content: query }]
      : await buildInitialMessages(query, {
          shell: config.context.shell,
          cwd: config.context.cwd,
          platform: config.context.platform,
          model: config.model,
          provider: config.provider,
          isGitRepo: detectGitRepo(config.context.cwd),
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
    const maxTurns = config.maxTurns ?? MAX_AGENT_STEPS;

    for (let step = 0; step < maxTurns; step++) {
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
        const result = await this.executeTool(toolCall, config, signal, permissions, requestPermission);
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

    // If aborted, return empty (not max-steps)
    if (signal.aborted) {
      return { finalResponse: '', usage };
    }

    // Max-steps graceful degradation: request a summary instead of returning empty
    try {
      const maxStepsMessage = `MAXIMUM STEPS REACHED - Tools are disabled until next user input.

STRICT REQUIREMENTS:
1. Do NOT make any tool calls
2. Provide a text response summarizing work done so far
3. List any remaining tasks that were not completed
4. Recommendations for what should be done next`;

      messages.push({ role: 'assistant', content: maxStepsMessage });
      const summaryResponse = await provider.sendWithTools(messages, [], {
        maxTokens: config.maxTokensPerTurn,
        signal,
      });
      const summaryText = adapter.extractTextContent(summaryResponse);
      const summaryUsage = adapter.extractTokenUsage(summaryResponse);
      usage.totalInputTokens += summaryUsage.inputTokens;
      usage.totalOutputTokens += summaryUsage.outputTokens;
      usage.turns++;

      const finalText = summaryText || 'Maximum steps reached. Please continue in a new message.';
      onEvent({ type: 'text_delta', text: finalText });
      return { finalResponse: finalText, usage };
    } catch {
      const fallback = 'Maximum steps reached. Please continue in a new message.';
      onEvent({ type: 'text_delta', text: fallback });
      return { finalResponse: fallback, usage };
    }
  }

  private async executeTool(
    toolCall: AgentToolCall,
    config: AgentConfig,
    signal: AbortSignal,
    permissions: PermissionGate,
    requestPermission?: RequestPermission,
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

    if (level === 'ask') {
      if (requestPermission) {
        const decision = await requestPermission(toolCall);
        if (decision === 'deny') {
          return { kind: 'denied', reason: `User denied ${toolCall.name}` };
        }
        if (decision === 'session') {
          permissions.approveForSession(toolCall.name);
        }
      }
      // Without requestPermission callback (non-interactive), fall through to execute
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

    const maxHashes = DOOM_LOOP_THRESHOLD * 2;
    if (recentHashes.length > maxHashes) {
      recentHashes.splice(0, recentHashes.length - maxHashes);
    }

    if (recentHashes.length < DOOM_LOOP_THRESHOLD) return false;

    const tail = recentHashes.slice(-DOOM_LOOP_THRESHOLD);
    const allSame = tail.every((h) => h === tail[0]);
    return allSame;
  }

  private hashToolCall(toolCall: AgentToolCall): string {
    return `${toolCall.name}:${JSON.stringify(toolCall.input)}`;
  }
}

function detectGitRepo(cwd: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
