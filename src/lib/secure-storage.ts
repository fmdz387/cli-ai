import { CONFIG_DIR_NAME, DEFAULT_CONFIG, KEYRING_SERVICE, PROVIDER_CONFIG } from '../constants.js';
import type { AIProvider, AppConfig, Result } from '../types/index.js';

import Conf from 'conf';
import { createHash } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import { hostname, userInfo } from 'node:os';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LEGACY_ENCRYPTION_KEY = 'cli-ai-v3-encryption-key';

function getMachineEncryptionKey(): string {
  const machineId = `${hostname()}-${userInfo().username}-cli-ai-v3-salt`;
  return createHash('sha256').update(machineId).digest('hex').slice(0, 32);
}

const configDir = join(homedir(), CONFIG_DIR_NAME);
const configPath = join(configDir, 'config.json');

type StoreSchema = {
  apiKey?: string;
  apiKeys?: Partial<Record<AIProvider, string>>;
  config?: Partial<AppConfig>;
};

function migrateFromLegacyConfig(): StoreSchema | null {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const legacyStore = new Conf<StoreSchema>({
      projectName: 'cli-ai',
      cwd: configDir,
      encryptionKey: LEGACY_ENCRYPTION_KEY,
    });

    const apiKey = legacyStore.get('apiKey');
    const apiKeys = legacyStore.get('apiKeys');
    const config = legacyStore.get('config');

    if (apiKey || apiKeys || config) {
      return { apiKey, apiKeys, config };
    }
  } catch {
    // Not legacy format
  }

  return null;
}

function createStore(): Conf<StoreSchema> {
  const newEncryptionKey = getMachineEncryptionKey();
  const legacyData = migrateFromLegacyConfig();

  if (legacyData) {
    try {
      unlinkSync(configPath);
    } catch {
      // Ignore
    }

    const newStore = new Conf<StoreSchema>({
      projectName: 'cli-ai',
      cwd: configDir,
      encryptionKey: newEncryptionKey,
    });

    if (legacyData.apiKey && !legacyData.apiKeys) {
      newStore.set('apiKeys', { anthropic: legacyData.apiKey });
    } else if (legacyData.apiKeys) {
      newStore.set('apiKeys', legacyData.apiKeys);
    }

    if (legacyData.config) {
      const config = { ...legacyData.config };
      if (!config.provider) {
        config.provider = 'anthropic';
      }
      newStore.set('config', config);
    }

    return newStore;
  }

  try {
    const newStore = new Conf<StoreSchema>({
      projectName: 'cli-ai',
      cwd: configDir,
      encryptionKey: newEncryptionKey,
    });

    migrateToMultiProvider(newStore);
    return newStore;
  } catch {
    try {
      if (existsSync(configPath)) {
        unlinkSync(configPath);
      }
    } catch {
      // Ignore
    }

    return new Conf<StoreSchema>({
      projectName: 'cli-ai',
      cwd: configDir,
      encryptionKey: newEncryptionKey,
    });
  }
}

function migrateToMultiProvider(store: Conf<StoreSchema>): void {
  const oldKey = store.get('apiKey');
  if (oldKey && !store.get('apiKeys')) {
    store.set('apiKeys', { anthropic: oldKey });
    store.delete('apiKey');
  }

  const config = store.get('config');
  if (config && !config.provider) {
    store.set('config', { ...config, provider: 'anthropic' });
  }
}

let _store: Conf<StoreSchema> | null = null;

function getStore(): Conf<StoreSchema> {
  if (_store === null) {
    _store = createStore();
  }
  return _store;
}

let keyringModule: typeof import('@napi-rs/keyring') | null = null;
let keyringModuleLoaded = false;
const keyringEntries = new Map<
  AIProvider,
  InstanceType<typeof import('@napi-rs/keyring').Entry> | null
>();
let keyringAvailable: boolean | null = null;

function loadKeyringModule(): typeof import('@napi-rs/keyring') | null {
  if (keyringModuleLoaded) return keyringModule;

  keyringModuleLoaded = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    keyringModule = require('@napi-rs/keyring') as typeof import('@napi-rs/keyring');
    return keyringModule;
  } catch {
    keyringModule = null;
    return null;
  }
}

function getKeyringEntry(
  provider: AIProvider,
): InstanceType<typeof import('@napi-rs/keyring').Entry> | null {
  if (keyringAvailable === false) return null;

  const cached = keyringEntries.get(provider);
  if (cached !== undefined) return cached;

  const kr = loadKeyringModule();
  if (!kr) {
    keyringAvailable = false;
    return null;
  }

  try {
    const account = PROVIDER_CONFIG[provider].keyringAccount;
    const entry = new kr.Entry(KEYRING_SERVICE, account);
    entry.getPassword();
    keyringAvailable = true;
    keyringEntries.set(provider, entry);
    return entry;
  } catch {
    keyringEntries.set(provider, null);
    if (keyringAvailable === null) {
      keyringAvailable = false;
    }
    return null;
  }
}

export function isKeyringAvailable(): boolean {
  getKeyringEntry('anthropic');
  return keyringAvailable === true;
}

export function getApiKey(provider: AIProvider): string | null {
  const envVar = PROVIDER_CONFIG[provider].envVar;
  const envKey = process.env[envVar];
  if (envKey) return envKey;

  const entry = getKeyringEntry(provider);
  if (entry) {
    try {
      const key = entry.getPassword();
      if (key) return key;
    } catch {
      // Fall through
    }
  }

  const apiKeys = getStore().get('apiKeys');
  return apiKeys?.[provider] ?? null;
}

export function saveApiKey(provider: AIProvider, apiKey: string): Result<void> {
  try {
    const entry = getKeyringEntry(provider);
    if (entry) {
      try {
        entry.setPassword(apiKey);
        const apiKeys = getStore().get('apiKeys') ?? {};
        delete apiKeys[provider];
        if (Object.keys(apiKeys).length > 0) {
          getStore().set('apiKeys', apiKeys);
        } else {
          getStore().delete('apiKeys');
        }
        return { success: true, data: undefined };
      } catch {
        // Fall through
      }
    }

    const apiKeys = getStore().get('apiKeys') ?? {};
    apiKeys[provider] = apiKey;
    getStore().set('apiKeys', apiKeys);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export function deleteApiKey(provider: AIProvider): Result<void> {
  try {
    const entry = getKeyringEntry(provider);
    if (entry) {
      try {
        entry.deleteCredential();
      } catch {
        // Continue
      }
    }

    const apiKeys = getStore().get('apiKeys');
    if (apiKeys?.[provider]) {
      delete apiKeys[provider];
      if (Object.keys(apiKeys).length > 0) {
        getStore().set('apiKeys', apiKeys);
      } else {
        getStore().delete('apiKeys');
      }
    }

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export function hasApiKey(provider: AIProvider): boolean {
  const key = getApiKey(provider);
  return key !== null && key.length > 0;
}

export function getConfig(): AppConfig {
  const storedConfig = getStore().get('config') ?? {};
  return { ...DEFAULT_CONFIG, ...storedConfig };
}

export function setConfig(config: Partial<AppConfig>): void {
  const current = getStore().get('config') ?? {};
  getStore().set('config', { ...current, ...config });
}

export function resetConfig(): void {
  getStore().delete('config');
}

export function validateApiKeyFormat(provider: AIProvider, apiKey: string): boolean {
  const config = PROVIDER_CONFIG[provider];
  if (provider === 'openai') {
    return apiKey.startsWith('sk-') && apiKey.length > 20;
  }
  return apiKey.startsWith(config.keyPrefix) && apiKey.length > 20;
}

export function getStorageInfo(provider: AIProvider): {
  method: 'env' | 'keyring' | 'encrypted-file' | 'none';
  secure: boolean;
  description: string;
} {
  const envVar = PROVIDER_CONFIG[provider].envVar;
  if (process.env[envVar]) {
    return {
      method: 'env',
      secure: false,
      description: 'Environment variable',
    };
  }

  const entry = getKeyringEntry(provider);
  if (entry) {
    try {
      const key = entry.getPassword();
      if (key) {
        return {
          method: 'keyring',
          secure: true,
          description: 'System keyring',
        };
      }
    } catch {
      // Fall through
    }
  }

  const apiKeys = getStore().get('apiKeys');
  if (apiKeys?.[provider]) {
    return {
      method: 'encrypted-file',
      secure: false,
      description: 'Encrypted file',
    };
  }

  return { method: 'none', secure: false, description: 'Not configured' };
}
