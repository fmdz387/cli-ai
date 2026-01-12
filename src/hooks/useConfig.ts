/**
 * React hook for configuration and API key management
 */

import { useCallback, useEffect, useState } from 'react';

import type { AppConfig } from '../types/index.js';
import {
  getApiKey,
  getConfig,
  hasApiKey,
  saveApiKey,
  setConfig,
  validateApiKeyFormat,
} from '../lib/secure-storage.js';

interface UseConfigState {
  isLoading: boolean;
  hasKey: boolean;
  config: AppConfig;
  error: string | null;
}

interface UseConfigActions {
  saveKey: (key: string) => boolean;
  updateConfig: (config: Partial<AppConfig>) => void;
  refreshKeyStatus: () => void;
}

export type UseConfigReturn = UseConfigState & UseConfigActions;

/**
 * Hook for managing application configuration and API key
 */
export function useConfig(): UseConfigReturn {
  const [state, setState] = useState<UseConfigState>({
    isLoading: true,
    hasKey: false,
    config: getConfig(),
    error: null,
  });

  useEffect(() => {
    try {
      const keyExists = hasApiKey();
      setState((prev) => ({
        ...prev,
        isLoading: false,
        hasKey: keyExists,
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

  const saveKey = useCallback((key: string): boolean => {
    if (!validateApiKeyFormat(key)) {
      setState((prev) => ({
        ...prev,
        error: 'Invalid API key format. Key should start with "sk-ant-"',
      }));
      return false;
    }

    try {
      const result = saveApiKey(key);
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
      const keyExists = hasApiKey();
      setState((prev) => ({
        ...prev,
        hasKey: keyExists,
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

/**
 * Hook to get the API key directly (for use in AI client)
 */
export function useApiKey(): {
  getKey: () => string | null;
} {
  const getKey = useCallback((): string | null => {
    return getApiKey();
  }, []);

  return { getKey };
}
