/**
 * First-run API key setup component with provider selection
 */
import { AI_PROVIDERS, APP_NAME, PROVIDER_CONFIG, VERSION } from '../constants.js';
import {
  startBrowserOAuthFlow,
  startDeviceCodeFlow,
  type CodexOAuthCredentials,
  type DeviceCodeInfo,
} from '../lib/codex-auth.js';
import {
  deleteOAuthCredentials,
  saveOAuthCredentials,
  setConfig,
  validateApiKeyFormat,
} from '../lib/secure-storage.js';
import { useTheme } from '../theme/index.js';
import type { AIProvider } from '../types/index.js';
import {
  ControlledTextInput,
  textInputReducer,
  createTextInputState,
} from './ControlledTextInput.js';

import { Box, Text, useInput } from 'ink';
import { useCallback, useReducer, useState, type ReactNode } from 'react';

interface ApiKeySetupProps {
  /** Called when API key is successfully entered */
  onComplete: (apiKey: string, provider: AIProvider) => void;
  onError?: (error: string) => void;
  error?: string | null;
  /** If provided, skip provider selection and go directly to key input */
  provider?: AIProvider;
}

type SetupStep =
  | 'welcome'
  | 'provider'
  | 'auth-method'
  | 'input'
  | 'oauth-progress'
  | 'saving'
  | 'complete';

const PROVIDER_URLS: Record<AIProvider, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  openrouter: 'https://openrouter.ai/keys',
};

const PROVIDER_HINTS: Partial<Record<AIProvider, string>> = {
  openai: '(ChatGPT Plus/Pro or API key)',
};

export function ApiKeySetup({
  onComplete,
  onError: _onError,
  error,
  provider: initialProvider,
}: ApiKeySetupProps): ReactNode {
  const theme = useTheme();
  const [step, setStep] = useState<SetupStep>(
    initialProvider ? (initialProvider === 'openai' ? 'auth-method' : 'input') : 'welcome',
  );
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(
    initialProvider ?? 'anthropic',
  );
  const [providerIndex, setProviderIndex] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [authMethodIndex, setAuthMethodIndex] = useState(0);
  const [oauthStatus, setOauthStatus] = useState<string>('');
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);

  // Text input state for API key entry
  const [textState, dispatchText] = useReducer(textInputReducer, createTextInputState());

  const handleSubmit = useCallback(() => {
    const trimmedKey = textState.value.trim();

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
    // When user enters API key for OpenAI, reset auth mode and clear OAuth creds
    if (selectedProvider === 'openai') {
      setConfig({ openaiAuthMode: 'api-key' });
      deleteOAuthCredentials('openai');
    }
    onComplete(trimmedKey, selectedProvider);
  }, [textState.value, selectedProvider, onComplete]);

  const handleOAuthComplete = useCallback(
    (credentials: CodexOAuthCredentials) => {
      saveOAuthCredentials('openai', credentials);
      setConfig({ openaiAuthMode: 'codex-oauth' });
      setStep('complete');
      // Call onComplete with empty string since we're using OAuth, not API key
      onComplete('', selectedProvider);
    },
    [selectedProvider, onComplete],
  );

  // NOTE: This component uses local useInput hooks. This is SAFE because:
  // - ApiKeySetup is only mounted when store.state.status === 'setup'
  // - During setup, useInputController.mode === 'disabled' (no active listeners)
  // - Therefore, no stdin race condition exists
  // - When setup completes, this component unmounts and the controller takes over
  useInput(
    (input, key) => {
      // Welcome step
      if (step === 'welcome' && (key.return || input === ' ')) {
        setStep('provider');
        return;
      }

      // Provider selection step
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
            setStep(provider === 'openai' ? 'auth-method' : 'input');
          }
          return;
        }
        const num = parseInt(input, 10);
        if (num >= 1 && num <= AI_PROVIDERS.length) {
          const provider = AI_PROVIDERS[num - 1];
          if (provider) {
            setSelectedProvider(provider);
            setStep(provider === 'openai' ? 'auth-method' : 'input');
          }
        }
        return;
      }

      // Auth method selection step (OpenAI only)
      if (step === 'auth-method') {
        if (key.upArrow) {
          setAuthMethodIndex((prev) => (prev - 1 + 3) % 3);
          return;
        }
        if (key.downArrow) {
          setAuthMethodIndex((prev) => (prev + 1) % 3);
          return;
        }
        if (key.return) {
          if (authMethodIndex === 0) {
            // API Key
            setStep('input');
          } else if (authMethodIndex === 1) {
            // Browser OAuth
            setStep('oauth-progress');
            setOauthStatus('Opening browser for authentication...');
            startBrowserOAuthFlow()
              .then((credentials) => handleOAuthComplete(credentials))
              .catch((err) => {
                setLocalError(err instanceof Error ? err.message : String(err));
                setStep('auth-method');
              });
          } else {
            // Device code
            setStep('oauth-progress');
            setOauthStatus('Requesting device code...');
            startDeviceCodeFlow((info) => {
              setDeviceCode(info);
              setOauthStatus(`Go to ${info.verificationUrl} and enter code: ${info.userCode}`);
            })
              .then((credentials) => handleOAuthComplete(credentials))
              .catch((err) => {
                setLocalError(err instanceof Error ? err.message : String(err));
                setStep('auth-method');
              });
          }
          return;
        }
        if (key.escape) {
          setStep('provider');
          return;
        }
        return;
      }

      // API key input step
      if (step === 'input') {
        if (key.return) {
          handleSubmit();
          return;
        }
        if (key.backspace || key.delete) {
          dispatchText({ type: 'delete' });
          return;
        }
        if (key.leftArrow) {
          dispatchText({ type: 'move-left' });
          return;
        }
        if (key.rightArrow) {
          dispatchText({ type: 'move-right' });
          return;
        }
        // Regular character input
        if (input && !key.ctrl && !key.meta) {
          dispatchText({ type: 'insert', text: input });
        }
      }
    },
    {
      isActive:
        step === 'welcome' || step === 'provider' || step === 'input' || step === 'auth-method',
    },
  );

  if (step === 'welcome') {
    return (
      <Box flexDirection='column' paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color={theme.primary}>
            {APP_NAME} v{VERSION}
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text color={theme.text}>
            Welcome! This tool translates natural language into shell commands.
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text color={theme.textMuted}>
            {"To get started, you'll need an API key from one of the supported providers."}
          </Text>
        </Box>

        <Box>
          <Text color={theme.success}>Press Enter to continue...</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'provider') {
    return (
      <Box flexDirection='column' paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color={theme.text}>
            Select your AI provider:
          </Text>
        </Box>

        {AI_PROVIDERS.map((provider, index) => {
          const config = PROVIDER_CONFIG[provider];
          const isFocused = index === providerIndex;
          return (
            <Box key={provider}>
              <Text color={isFocused ? theme.primary : theme.textMuted} bold={isFocused}>
                {isFocused ? '> ' : '  '}
              </Text>
              <Text color={isFocused ? theme.primary : theme.text}>
                {index + 1}. {config.name}
              </Text>
              {PROVIDER_HINTS[provider] && (
                <Text color={theme.textMuted} dimColor>
                  {' '}
                  {PROVIDER_HINTS[provider]}
                </Text>
              )}
            </Box>
          );
        })}

        <Box marginTop={1}>
          <Text color={theme.textMuted}>[Up/Down] Navigate [Enter] Select [1-3] Quick select</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'auth-method') {
    const authMethods = [
      { label: 'API Key (direct)', description: 'Enter your OpenAI API key' },
      { label: 'ChatGPT Plus/Pro (browser login)', description: 'Authenticate via browser' },
      { label: 'ChatGPT Plus/Pro (device code)', description: 'For headless/SSH environments' },
    ];

    return (
      <Box flexDirection='column' paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color={theme.text}>
            Choose authentication method for OpenAI:
          </Text>
        </Box>

        {authMethods.map((method, index) => {
          const isFocused = index === authMethodIndex;
          return (
            <Box key={method.label}>
              <Text color={isFocused ? theme.primary : theme.textMuted} bold={isFocused}>
                {isFocused ? '> ' : '  '}
              </Text>
              <Text color={isFocused ? theme.primary : theme.text}>
                {index + 1}. {method.label}
              </Text>
              <Text color={theme.textMuted} dimColor>
                {' '}
                {method.description}
              </Text>
            </Box>
          );
        })}

        {localError && (
          <Box marginTop={1}>
            <Text color={theme.error}>{localError}</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text color={theme.textMuted}>[Up/Down] Navigate [Enter] Select [Esc] Back</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'oauth-progress') {
    return (
      <Box flexDirection='column' paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color={theme.text}>
            OpenAI Authentication
          </Text>
        </Box>
        <Box>
          <Text color={theme.warning}>{oauthStatus}</Text>
        </Box>
        {deviceCode && (
          <Box marginTop={1} flexDirection='column'>
            <Text color={theme.primary} bold>
              Code: {deviceCode.userCode}
            </Text>
            <Text color={theme.textMuted}>Visit: {deviceCode.verificationUrl}</Text>
          </Box>
        )}
      </Box>
    );
  }

  const displayError = error ?? localError;
  const providerConfig = PROVIDER_CONFIG[selectedProvider];

  if (step === 'input') {
    return (
      <Box flexDirection='column' paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color={theme.text}>
            Enter your {providerConfig.name} API key:
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text color={theme.textMuted}>
            Get one at: <Text color={theme.secondary}>{PROVIDER_URLS[selectedProvider]}</Text>
          </Text>
        </Box>

        {displayError && (
          <Box marginBottom={1}>
            <Text color={theme.error}>{displayError}</Text>
          </Box>
        )}

        <Box>
          <Text color={theme.textMuted}>{'> '}</Text>
          <ControlledTextInput
            value={textState.value}
            cursorOffset={textState.cursorOffset}
            placeholder={`${providerConfig.keyPrefix}...`}
          />
        </Box>

        <Box marginTop={1}>
          <Text color={theme.warning}>
            {"Your key is stored securely on this machine using your system's credential manager."}
          </Text>
        </Box>
      </Box>
    );
  }

  if (step === 'saving') {
    return (
      <Box flexDirection='column' paddingY={1}>
        <Box>
          <Text color={theme.warning}>Saving API key...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection='column' paddingY={1}>
      <Box>
        <Text color={theme.success}>{'\u2713'} API key saved successfully!</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text}>Starting {APP_NAME}...</Text>
      </Box>
    </Box>
  );
}
