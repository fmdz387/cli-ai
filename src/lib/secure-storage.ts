/**
 * Secure storage for API keys with @napi-rs/keyring + encrypted conf fallback
 */

import { Entry } from '@napi-rs/keyring';
import Conf from 'conf';
import { createHash } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import { hostname, userInfo } from 'node:os';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { CONFIG_DIR_NAME, DEFAULT_CONFIG, KEYRING_ACCOUNT, KEYRING_SERVICE } from '../constants.js';
import type { AppConfig, Result } from '../types/index.js';

/**
 * Legacy encryption key (hardcoded in v3.0.0)
 * Used only for migration purposes
 */
const LEGACY_ENCRYPTION_KEY = 'cli-ai-v3-encryption-key';

/**
 * Generate machine-specific encryption key (not hardcoded for security)
 * Derived from hostname + username to make encryption unique per machine/user
 */
function getMachineEncryptionKey(): string {
  const machineId = `${hostname()}-${userInfo().username}-cli-ai-v3-salt`;
  return createHash('sha256').update(machineId).digest('hex').slice(0, 32);
}

const configDir = join(homedir(), CONFIG_DIR_NAME);
const configPath = join(configDir, 'config.json');

/**
 * Attempt migration from legacy encrypted config to new format
 * Returns true if migration was performed or not needed
 */
function migrateFromLegacyConfig(): { apiKey?: string; config?: Partial<AppConfig> } | null {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    // Try reading with legacy key
    const legacyStore = new Conf<{ apiKey?: string; config?: Partial<AppConfig> }>({
      projectName: 'cli-ai',
      cwd: configDir,
      encryptionKey: LEGACY_ENCRYPTION_KEY,
    });

    const apiKey = legacyStore.get('apiKey');
    const config = legacyStore.get('config');

    if (apiKey || config) {
      // Successfully read legacy data
      return { apiKey, config };
    }
  } catch {
    // Not legacy format, might be new format or corrupted
  }

  return null;
}

/**
 * Initialize store with migration support
 */
function createStore(): Conf<{ apiKey?: string; config?: Partial<AppConfig> }> {
  const newEncryptionKey = getMachineEncryptionKey();

  // Check if we need to migrate from legacy format
  const legacyData = migrateFromLegacyConfig();

  if (legacyData) {
    // Delete old config file
    try {
      unlinkSync(configPath);
    } catch {
      // Ignore deletion errors
    }

    // Create new store with machine-specific key
    const newStore = new Conf<{ apiKey?: string; config?: Partial<AppConfig> }>({
      projectName: 'cli-ai',
      cwd: configDir,
      encryptionKey: newEncryptionKey,
    });

    // Migrate data to new store
    if (legacyData.apiKey) {
      newStore.set('apiKey', legacyData.apiKey);
    }
    if (legacyData.config) {
      newStore.set('config', legacyData.config);
    }

    return newStore;
  }

  // No migration needed, try creating store with new key
  try {
    return new Conf<{ apiKey?: string; config?: Partial<AppConfig> }>({
      projectName: 'cli-ai',
      cwd: configDir,
      encryptionKey: newEncryptionKey,
    });
  } catch {
    // Config file might be corrupted, delete and start fresh
    try {
      if (existsSync(configPath)) {
        unlinkSync(configPath);
      }
    } catch {
      // Ignore
    }

    return new Conf<{ apiKey?: string; config?: Partial<AppConfig> }>({
      projectName: 'cli-ai',
      cwd: configDir,
      encryptionKey: newEncryptionKey,
    });
  }
}

/**
 * Encrypted config store with migration support
 */
const store = createStore();

let keyringEntry: Entry | null = null;
let keyringAvailable: boolean | null = null;

/**
 * Get or create keyring entry, testing availability on first access
 */
function getKeyringEntry(): Entry | null {
  if (keyringAvailable === false) return null;

  if (keyringEntry === null) {
    try {
      keyringEntry = new Entry(KEYRING_SERVICE, KEYRING_ACCOUNT);
      // Test that keyring actually works by attempting to read
      // This will throw if keyring is not available on the system
      keyringEntry.getPassword();
      keyringAvailable = true;
    } catch {
      keyringAvailable = false;
      keyringEntry = null;
      return null;
    }
  }
  return keyringEntry;
}

/**
 * Check if system keyring is available
 */
export function isKeyringAvailable(): boolean {
  getKeyringEntry();
  return keyringAvailable === true;
}

/**
 * Get API key from storage (env > keyring > encrypted file)
 */
export function getApiKey(): string | null {
  // Priority 1: Environment variable
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) return envKey;

  // Priority 2: System keyring (most secure)
  const entry = getKeyringEntry();
  if (entry) {
    try {
      const key = entry.getPassword();
      if (key) return key;
    } catch {
      // Fall through to conf
    }
  }

  // Priority 3: Encrypted conf file (fallback)
  return store.get('apiKey') ?? null;
}

/**
 * Save API key to storage (prefers keyring, falls back to encrypted file)
 */
export function saveApiKey(apiKey: string): Result<void> {
  try {
    const entry = getKeyringEntry();
    if (entry) {
      try {
        entry.setPassword(apiKey);
        // Clear any fallback storage when successfully saved to keyring
        store.delete('apiKey');
        return { success: true, data: undefined };
      } catch {
        // Fall through to conf if keyring save fails
      }
    }

    // Fallback: encrypted conf file
    store.set('apiKey', apiKey);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Delete API key from all storage locations
 */
export function deleteApiKey(): Result<void> {
  try {
    const entry = getKeyringEntry();
    if (entry) {
      try {
        entry.deleteCredential();
      } catch {
        // Continue to delete from conf even if keyring delete fails
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

/**
 * Check if API key is configured
 */
export function hasApiKey(): boolean {
  const key = getApiKey();
  return key !== null && key.length > 0;
}

/**
 * Get application configuration
 */
export function getConfig(): AppConfig {
  const storedConfig = store.get('config') ?? {};
  return { ...DEFAULT_CONFIG, ...storedConfig };
}

/**
 * Update application configuration
 */
export function setConfig(config: Partial<AppConfig>): void {
  const current = store.get('config') ?? {};
  store.set('config', { ...current, ...config });
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  store.delete('config');
}

/**
 * Validate API key format (Anthropic keys start with sk-ant-)
 */
export function validateApiKeyFormat(apiKey: string): boolean {
  return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
}

/**
 * Get information about current storage method
 */
export function getStorageInfo(): {
  method: 'env' | 'keyring' | 'encrypted-file' | 'none';
  secure: boolean;
  description: string;
} {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      method: 'env',
      secure: false,
      description: 'Environment variable (visible to other processes)',
    };
  }

  const entry = getKeyringEntry();
  if (entry) {
    try {
      const key = entry.getPassword();
      if (key) {
        return {
          method: 'keyring',
          secure: true,
          description: 'System keyring (OS-protected)',
        };
      }
    } catch {
      // Fall through
    }
  }

  if (store.get('apiKey')) {
    return {
      method: 'encrypted-file',
      secure: false,
      description: 'Encrypted file (machine-specific key)',
    };
  }

  return { method: 'none', secure: false, description: 'Not configured' };
}
