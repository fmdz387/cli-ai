/**
 * Factory for creating AgentExecutor dependencies
 * Instantiates the correct provider, adapter, registry, and permissions
 */

import type { AIProvider } from '../types/index.js';
import type { Provider } from '../lib/providers/types.js';
import type { ToolCallAdapter } from './adapters/types.js';
import { AnthropicProvider } from '../lib/providers/anthropic.js';
import { OpenRouterProvider } from '../lib/providers/openrouter.js';
import { AnthropicToolAdapter } from './adapters/anthropic-adapter.js';
import { OpenAIToolAdapter } from './adapters/openai-adapter.js';
import { OpenRouterToolAdapter } from './adapters/openrouter-adapter.js';
import { ToolRegistry } from '../tools/registry.js';
import { PermissionGate } from '../tools/permissions.js';
import { ContextManager } from './context-manager.js';
import { registerBuiltinTools } from '../tools/builtin/index.js';
import type { ExecutorDependencies } from './executor.js';

function createProvider(type: AIProvider, apiKey: string, model: string): Provider {
  switch (type) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'openrouter':
      return new OpenRouterProvider(apiKey, model);
    case 'openai':
      throw new Error('OpenAI agentic provider is not yet implemented');
  }
}

function createAdapter(type: AIProvider): ToolCallAdapter {
  switch (type) {
    case 'anthropic':
      return new AnthropicToolAdapter();
    case 'openrouter':
      return new OpenRouterToolAdapter();
    case 'openai':
      return new OpenAIToolAdapter();
  }
}

/**
 * Build all dependencies needed by AgentExecutor
 */
export function createExecutorDeps(
  provider: AIProvider,
  model: string,
  apiKey: string,
): ExecutorDependencies {
  const providerInstance = createProvider(provider, apiKey, model);
  const adapter = createAdapter(provider);
  const registry = new ToolRegistry();
  registerBuiltinTools(registry);
  const permissions = new PermissionGate();
  permissions.registerDefaults(registry.list());
  const contextManager = new ContextManager();

  return {
    provider: providerInstance,
    adapter,
    registry,
    permissions,
    contextManager,
  };
}
