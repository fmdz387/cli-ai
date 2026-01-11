/**
 * First-run API key setup component
 */
import { APP_NAME, VERSION } from '../constants.js';

import { Box, Text, useInput } from 'ink';
import { useState, type ReactNode } from 'react';

import { TextInput } from '@inkjs/ui';

interface ApiKeySetupProps {
  onComplete: (apiKey: string) => void;
  onError?: (error: string) => void;
  error?: string | null;
}

type SetupStep = 'welcome' | 'input' | 'saving' | 'complete';

export function ApiKeySetup({ onComplete, onError, error }: ApiKeySetupProps): ReactNode {
  const [step, setStep] = useState<SetupStep>('welcome');
  const [apiKey, setApiKey] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useInput(
    (input, key) => {
      if (step === 'welcome' && (key.return || input === ' ')) {
        setStep('input');
      }
    },
    { isActive: step === 'welcome' },
  );

  const handleSubmit = (value: string) => {
    const trimmedKey = value.trim();

    if (!trimmedKey) {
      setLocalError('API key cannot be empty');
      return;
    }

    if (!trimmedKey.startsWith('sk-ant-')) {
      setLocalError('Invalid key format. Anthropic API keys start with "sk-ant-"');
      return;
    }

    if (trimmedKey.length < 20) {
      setLocalError('API key seems too short');
      return;
    }

    setLocalError(null);
    setStep('saving');
    onComplete(trimmedKey);
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
            To get started, you'll need an Anthropic API key.{'\n'}
            Get one at: <Text color='blue'>https://console.anthropic.com/settings/keys</Text>
          </Text>
        </Box>

        <Box>
          <Text color='green'>Press Enter to continue...</Text>
        </Box>
      </Box>
    );
  }

  const displayError = error ?? localError;

  if (step === 'input') {
    return (
      <Box flexDirection='column' paddingY={1}>
        <Box marginBottom={1}>
          <Text bold>Enter your Anthropic API key:</Text>
        </Box>

        {displayError && (
          <Box marginBottom={1}>
            <Text color='red'>⚠ {displayError}</Text>
          </Box>
        )}

        <Box>
          <Text dimColor>{'> '}</Text>
          <TextInput placeholder='sk-ant-...' onChange={setApiKey} onSubmit={handleSubmit} />
        </Box>

        <Box marginTop={1}>
          <Text dimColor>Your key will be stored securely in your system keyring.</Text>
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
