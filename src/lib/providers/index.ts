import type { AIProvider } from '../../types/index.js';
import { debug } from '../debug.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OpenRouterProvider } from './openrouter.js';
import type { Provider } from './types.js';

export type { Provider } from './types.js';

export function createProvider(provider: AIProvider, apiKey: string, model: string): Provider {
  debug(`Creating provider: ${provider}/${model}`);

  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'openrouter':
      return new OpenRouterProvider(apiKey, model);
  }
}
