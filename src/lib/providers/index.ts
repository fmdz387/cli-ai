import type { AIProvider } from '../../types/index.js';
import type { Provider } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OpenRouterProvider } from './openrouter.js';
import { getOAuthCredentials, getOpenAIAuthMode, saveOAuthCredentials } from '../secure-storage.js';

export type { Provider } from './types.js';

export async function createProvider(
  type: AIProvider,
  apiKey: string,
  model: string,
): Promise<Provider> {
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
