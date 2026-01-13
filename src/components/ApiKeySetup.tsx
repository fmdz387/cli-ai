/**
 * First-run API key setup component with provider selection
 */
import { AI_PROVIDERS, APP_NAME, PROVIDER_CONFIG, VERSION } from '../constants.js';
import { validateApiKeyFormat } from '../lib/secure-storage.js';
import type { AIProvider } from '../types/index.js';

import { Box, Text, useInput } from 'ink';
import { useState, type ReactNode } from 'react';

import { TextInput } from '@inkjs/ui';

interface ApiKeySetupProps {
  /** Called when API key is successfully entered */
  onComplete: (apiKey: string, provider: AIProvider) => void;
  onError?: (error: string) => void;
  error?: string | null;
  /** If provided, skip provider selection and go directly to key input */
  provider?: AIProvider;
}

type SetupStep = 'welcome' | 'provider' | 'input' | 'saving' | 'complete';

const PROVIDER_URLS: Record<AIProvider, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  openrouter: 'https://openrouter.ai/keys',
};

export function ApiKeySetup({
  onComplete,
  onError,
  error,
  provider: initialProvider,
}: ApiKeySetupProps): ReactNode {
  const [step, setStep] = useState<SetupStep>(initialProvider ? 'input' : 'welcome');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(
    initialProvider ?? 'anthropic',
  );
  const [providerIndex, setProviderIndex] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useInput(
    (input, key) => {
      if (step === 'welcome' && (key.return || input === ' ')) {
        setStep('provider');
      }
    },
    { isActive: step === 'welcome' },
  );

  useInput(
    (input, key) => {
      if (step === 'provider') {
        if (key.upArrow) {
          setProviderIndex((prev) => (prev - 1 + AI_PROVIDERS.length) % AI_PROVIDERS.length);
          return;
        }
        if (key.downArrow) {
          setProviderIndex((prev) => (prev + 1) % AI_PROVIDERS.length);
          return;
        }
        if (key.return) {
          const provider = AI_PROVIDERS[providerIndex];
          if (provider) {
            setSelectedProvider(provider);
            setStep('input');
          }
          return;
        }
        // Number keys for quick select
        const num = parseInt(input, 10);
        if (num >= 1 && num <= AI_PROVIDERS.length) {
          const provider = AI_PROVIDERS[num - 1];
          if (provider) {
            setSelectedProvider(provider);
            setStep('input');
          }
        }
      }
    },
    { isActive: step === 'provider' },
  );

  const handleSubmit = (value: string) => {
    const trimmedKey = value.trim();

    if (!trimmedKey) {
      setLocalError('API key cannot be empty');
      return;
    }

    if (!validateApiKeyFormat(selectedProvider, trimmedKey)) {
      const config = PROVIDER_CONFIG[selectedProvider];
      setLocalError(`Invalid key format. ${config.name} API keys start with "${config.keyPrefix}"`);
      return;
    }

    setLocalError(null);
    setStep('saving');
    onComplete(trimmedKey, selectedProvider);
  };

  if (step === 'welcome') {
    return (
      <Box flexDirection='column' paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color='cyan'>
            {APP_NAME} v{VERSION}
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text>Welcome! This tool translates natural language into shell commands.</Text>
        </Box>

        <Box marginBottom={1}>
          <Text dimColor>
            To get started, you'll need an API key from one of the supported providers.
          </Text>
        </Box>

        <Box>
          <Text color='green'>Press Enter to continue...</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'provider') {
    return (
      <Box flexDirection='column' paddingY={1}>
        <Box marginBottom={1}>
          <Text bold>Select your AI provider:</Text>
        </Box>

        {AI_PROVIDERS.map((provider, index) => {
          const config = PROVIDER_CONFIG[provider];
          const isFocused = index === providerIndex;
          return (
            <Box key={provider}>
              <Text color={isFocused ? 'cyan' : 'gray'} bold={isFocused}>
                {isFocused ? '> ' : '  '}
              </Text>
              <Text color={isFocused ? 'cyan' : 'white'}>
                {index + 1}. {config.name}
              </Text>
            </Box>
          );
        })}

        <Box marginTop={1}>
          <Text dimColor>[Up/Down] Navigate [Enter] Select [1-3] Quick select</Text>
        </Box>
      </Box>
    );
  }

  const displayError = error ?? localError;
  const providerConfig = PROVIDER_CONFIG[selectedProvider];

  if (step === 'input') {
    return (
      <Box flexDirection='column' paddingY={1}>
        <Box marginBottom={1}>
          <Text bold>Enter your {providerConfig.name} API key:</Text>
        </Box>

        <Box marginBottom={1}>
          <Text dimColor>
            Get one at: <Text color='blue'>{PROVIDER_URLS[selectedProvider]}</Text>
          </Text>
        </Box>

        {displayError && (
          <Box marginBottom={1}>
            <Text color='red'>⚠ {displayError}</Text>
          </Box>
        )}

        <Box>
          <Text dimColor>{'> '}</Text>
          <TextInput
            placeholder={`${providerConfig.keyPrefix}...`}
            onChange={setApiKey}
            onSubmit={handleSubmit}
          />
        </Box>

        <Box marginTop={1}>
          <Text color='yellow'>
            🔒 Your key is stored securely on this machine using your system's credential manager.
          </Text>
        </Box>
      </Box>
    );
  }

  if (step === 'saving') {
    return (
      <Box flexDirection='column' paddingY={1}>
        <Box>
          <Text color='yellow'>⏳ Saving API key...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection='column' paddingY={1}>
      <Box>
        <Text color='green'>✓ API key saved successfully!</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Starting {APP_NAME}...</Text>
      </Box>
    </Box>
  );
}
