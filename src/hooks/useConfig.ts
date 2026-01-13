import {
  getApiKey,
  getConfig,
  hasApiKey,
  saveApiKey,
  setConfig,
  validateApiKeyFormat,
} from '../lib/secure-storage.js';
import type { AIProvider, AppConfig } from '../types/index.js';

import { useCallback, useEffect, useState } from 'react';

interface UseConfigState {
  isLoading: boolean;
  hasKey: boolean;
  config: AppConfig;
  error: string | null;
}

interface UseConfigActions {
  saveKey: (provider: AIProvider, key: string) => boolean;
  updateConfig: (config: Partial<AppConfig>) => void;
  refreshKeyStatus: () => void;
}

export type UseConfigReturn = UseConfigState & UseConfigActions;

export function useConfig(): UseConfigReturn {
  const [state, setState] = useState<UseConfigState>({
    isLoading: true,
    hasKey: false,
    config: getConfig(),
    error: null,
  });

  useEffect(() => {
    try {
      const config = getConfig();
      const keyExists = hasApiKey(config.provider);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        hasKey: keyExists,
        config,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to check API key',
      }));
    }
  }, []);

  const saveKey = useCallback((provider: AIProvider, key: string): boolean => {
    if (!validateApiKeyFormat(provider, key)) {
      setState((prev) => ({
        ...prev,
        error: `Invalid API key format for ${provider}`,
      }));
      return false;
    }

    try {
      const result = saveApiKey(provider, key);
      if (result.success) {
        setState((prev) => ({
          ...prev,
          hasKey: true,
          error: null,
        }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          error: result.error.message,
        }));
        return false;
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save API key',
      }));
      return false;
    }
  }, []);

  const updateConfig = useCallback((updates: Partial<AppConfig>): void => {
    setConfig(updates);
    setState((prev) => ({
      ...prev,
      config: { ...prev.config, ...updates },
    }));
  }, []);

  const refreshKeyStatus = useCallback((): void => {
    try {
      const config = getConfig();
      const keyExists = hasApiKey(config.provider);
      setState((prev) => ({
        ...prev,
        hasKey: keyExists,
        config,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to check API key',
      }));
    }
  }, []);

  return {
    ...state,
    saveKey,
    updateConfig,
    refreshKeyStatus,
  };
}

export function useApiKey(): {
  getKey: (provider: AIProvider) => string | null;
} {
  const getKey = useCallback((provider: AIProvider): string | null => {
    return getApiKey(provider);
  }, []);

  return { getKey };
}
