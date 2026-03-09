/**
 * Factory for creating AgentExecutor dependencies
 * Instantiates the correct provider, adapter, registry, and permissions
 */

import type { AIProvider } from '../types/index.js';
import type { Provider } from '../lib/providers/types.js';
import type { ToolCallAdapter } from './adapters/types.js';
import { AnthropicProvider } from '../lib/providers/anthropic.js';
import { OpenAIProvider } from '../lib/providers/openai.js';
import { OpenRouterProvider } from '../lib/providers/openrouter.js';
import { getOAuthCredentials, getOpenAIAuthMode, saveOAuthCredentials } from '../lib/secure-storage.js';
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
    case 'openai': {
      const authMode = getOpenAIAuthMode();
      if (authMode === 'codex-oauth') {
        const credentials = getOAuthCredentials('openai');
        if (!credentials) {
          throw new Error('Codex OAuth credentials not found. Please re-authenticate.');
        }
        return new OpenAIProvider({
          mode: 'codex-oauth',
          credentials,
          model,
          onTokenRefresh: (creds) => saveOAuthCredentials('openai', creds),
        });
      }
      return new OpenAIProvider({ mode: 'api-key', apiKey, model });
    }
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
  options?: { allowAllPermissions?: boolean },
): ExecutorDependencies {
  const providerInstance = createProvider(provider, apiKey, model);
  const adapter = createAdapter(provider);
  const registry = new ToolRegistry();
  registerBuiltinTools(registry);
  const permissions = new PermissionGate({
    allowAll: options?.allowAllPermissions ?? false,
  });
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
