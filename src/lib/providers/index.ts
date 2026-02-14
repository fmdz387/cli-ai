import type { AIProvider } from '../../types/index.js';
import { debug } from '../debug.js';
import type { Provider } from './types.js';

export type { Provider } from './types.js';

export async function createProvider(
  provider: AIProvider,
  apiKey: string,
  model: string,
): Promise<Provider> {
  debug(`Creating provider: ${provider}/${model}`);

  switch (provider) {
    case 'anthropic': {
      const { AnthropicProvider } = await import('./anthropic.js');
      return new AnthropicProvider(apiKey, model);
    }
    case 'openai': {
      const { OpenAIProvider } = await import('./openai.js');
      return new OpenAIProvider(apiKey, model);
    }
    case 'openrouter': {
      const { OpenRouterProvider } = await import('./openrouter.js');
      return new OpenRouterProvider(apiKey, model);
    }
  }
}
