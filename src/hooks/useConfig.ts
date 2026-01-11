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
  saveKey: (key: string) => Promise<boolean>;
  updateConfig: (config: Partial<AppConfig>) => void;
  refreshKeyStatus: () => Promise<void>;
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
    let mounted = true;

    async function checkKey() {
      try {
        const keyExists = await hasApiKey();
        if (mounted) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            hasKey: keyExists,
            error: null,
          }));
        }
      } catch (error) {
        if (mounted) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to check API key',
          }));
        }
      }
    }

    void checkKey();

    return () => {
      mounted = false;
    };
  }, []);

  const saveKey = useCallback(async (key: string): Promise<boolean> => {
    if (!validateApiKeyFormat(key)) {
      setState((prev) => ({
        ...prev,
        error: 'Invalid API key format. Key should start with "sk-ant-"',
      }));
      return false;
    }

    try {
      const result = await saveApiKey(key);
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

  const refreshKeyStatus = useCallback(async (): Promise<void> => {
    try {
      const keyExists = await hasApiKey();
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
  getKey: () => Promise<string | null>;
  isLoading: boolean;
} {
  const [isLoading, setIsLoading] = useState(false);

  const getKey = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    try {
      return await getApiKey();
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { getKey, isLoading };
}
