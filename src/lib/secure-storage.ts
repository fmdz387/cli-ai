/**
 * Secure storage for API keys with keytar + conf fallback
 */

import Conf from 'conf';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { CONFIG_DIR_NAME, DEFAULT_CONFIG, KEYRING_ACCOUNT, KEYRING_SERVICE } from '../constants.js';
import type { AppConfig, Result } from '../types/index.js';

/**
 * Keytar module type (loaded dynamically)
 */
type KeytarModule = typeof import('keytar');

/**
 * Encrypted config store as fallback when keytar isn't available
 */
const store = new Conf<{ apiKey?: string; config?: Partial<AppConfig> }>({
  projectName: 'cli-ai',
  cwd: join(homedir(), CONFIG_DIR_NAME),
  encryptionKey: 'cli-ai-v3-encryption-key',
});

let keytarModule: KeytarModule | null | undefined = null;

async function getKeytar(): Promise<KeytarModule | null> {
  if (keytarModule !== null) {
    return keytarModule ?? null;
  }

  try {
    keytarModule = await import('keytar');
    // Test that it actually works
    await keytarModule.findCredentials(KEYRING_SERVICE);
    return keytarModule;
  } catch {
    keytarModule = undefined; // Mark as failed
    return null;
  }
}

export async function isKeytarAvailable(): Promise<boolean> {
  const keytar = await getKeytar();
  return keytar !== null;
}

export async function getApiKey(): Promise<string | null> {
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) {
    return envKey;
  }

  const keytar = await getKeytar();
  if (keytar) {
    try {
      const key = await keytar.getPassword(KEYRING_SERVICE, KEYRING_ACCOUNT);
      if (key) {
        return key;
      }
    } catch {
    }
  }

  const confKey = store.get('apiKey');
  return confKey ?? null;
}

export async function saveApiKey(apiKey: string): Promise<Result<void>> {
  try {
    const keytar = await getKeytar();
    if (keytar) {
      try {
        await keytar.setPassword(KEYRING_SERVICE, KEYRING_ACCOUNT, apiKey);
        return { success: true, data: undefined };
      } catch {
      }
    }

    store.set('apiKey', apiKey);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export async function deleteApiKey(): Promise<Result<void>> {
  try {
    const keytar = await getKeytar();
    if (keytar) {
      try {
        await keytar.deletePassword(KEYRING_SERVICE, KEYRING_ACCOUNT);
      } catch {
      }
    }

    store.delete('apiKey');

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return key !== null && key.length > 0;
}

export function getConfig(): AppConfig {
  const storedConfig = store.get('config') ?? {};
  return { ...DEFAULT_CONFIG, ...storedConfig };
}

export function setConfig(config: Partial<AppConfig>): void {
  const current = store.get('config') ?? {};
  store.set('config', { ...current, ...config });
}

export function resetConfig(): void {
  store.delete('config');
}

export function validateApiKeyFormat(apiKey: string): boolean {
  return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
}

export async function getStorageInfo(): Promise<{
  method: 'env' | 'keytar' | 'conf' | 'none';
  path?: string;
}> {
  if (process.env.ANTHROPIC_API_KEY) {
    return { method: 'env' };
  }

  const keytar = await getKeytar();
  if (keytar) {
    try {
      const key = await keytar.getPassword(KEYRING_SERVICE, KEYRING_ACCOUNT);
      if (key) {
        return { method: 'keytar' };
      }
    } catch {
      // Fall through
    }
  }

  if (store.get('apiKey')) {
    return { method: 'conf', path: store.path };
  }

  return { method: 'none' };
}
