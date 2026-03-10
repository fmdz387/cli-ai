import { CONFIG_DIR_NAME } from '../constants.js';
import type { AIProvider } from '../types/index.js';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

type RawCatalog = Record<string, unknown>;

type CatalogIndex = Record<string, number>;

const MODELS_URL = 'https://models.dev/api.json';
const CACHE_FILE = join(homedir(), CONFIG_DIR_NAME, 'models-cache.json');

const BUILTIN_CONTEXT_WINDOWS: CatalogIndex = {
  'claude-sonnet-4-5': 200_000,
  'claude-opus-4-5': 200_000,
  'claude-haiku-4-5': 200_000,
  'anthropic/claude-sonnet-4.5': 200_000,
  'gpt-5.4': 400_000,
  'gpt-5.2': 400_000,
  'gpt-5-mini': 400_000,
  'gpt-5.1-codex': 400_000,
  'gpt-5.1-codex-max': 400_000,
  'gpt-5.3-codex': 400_000,
  'x-ai/grok-code-fast-1': 256_000,
  'google/gemini-3-flash-preview': 1_048_576,
};

let index: CatalogIndex = { ...BUILTIN_CONTEXT_WINDOWS };
let version = 0;
let bootstrapped = false;
let refreshTask: Promise<void> | null = null;
const listeners = new Set<() => void>();

function readContextLimit(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const limit = (value as { limit?: unknown }).limit;
  if (!limit || typeof limit !== 'object') {
    return undefined;
  }

  const context = (limit as { context?: unknown }).context;
  if (typeof context !== 'number' || !Number.isFinite(context) || context <= 0) {
    return undefined;
  }

  return context;
}

function readModelId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function addAlias(values: Set<string>, id: string): void {
  if (!id) {
    return;
  }

  values.add(id);

  if (!id.includes('claude-')) {
    return;
  }

  values.add(id.replace(/-4-5\b/g, '-4.5'));
  values.add(id.replace(/-4\.5\b/g, '-4-5'));
}

function recordContextLimit(target: CatalogIndex, key: string, contextWindow: number): void {
  if (!key) {
    return;
  }

  target[key] = contextWindow;
}

export function buildModelCatalogIndex(source: RawCatalog | undefined): CatalogIndex {
  const next: CatalogIndex = { ...BUILTIN_CONTEXT_WINDOWS };
  if (!source) {
    return next;
  }

  for (const [providerId, providerValue] of Object.entries(source)) {
    if (!providerValue || typeof providerValue !== 'object') {
      continue;
    }

    const models = (providerValue as { models?: unknown }).models;
    if (!models || typeof models !== 'object') {
      continue;
    }

    for (const [modelKey, modelValue] of Object.entries(models as Record<string, unknown>)) {
      const contextWindow = readContextLimit(modelValue);
      if (!contextWindow) {
        continue;
      }

      const aliases = new Set<string>();
      addAlias(aliases, modelKey);
      addAlias(aliases, readModelId(modelValue) ?? '');

      for (const alias of aliases) {
        recordContextLimit(next, alias, contextWindow);
        if (!alias.includes('/')) {
          recordContextLimit(next, `${providerId}/${alias}`, contextWindow);
        }
      }
    }
  }

  return next;
}

export function getModelLookupKeys(provider: AIProvider, modelId: string): string[] {
  const candidates = new Set<string>();

  addAlias(candidates, modelId);

  if (!modelId.includes('/')) {
    if (provider === 'anthropic') {
      addAlias(candidates, `anthropic/${modelId}`);
    }
    if (provider === 'openai') {
      addAlias(candidates, `openai/${modelId}`);
    }
  } else {
    const slash = modelId.indexOf('/');
    addAlias(candidates, modelId.slice(slash + 1));
  }

  return Array.from(candidates);
}

export function resolveModelContextWindow(
  catalog: CatalogIndex,
  provider: AIProvider,
  modelId: string,
): number | undefined {
  for (const key of getModelLookupKeys(provider, modelId)) {
    const hit = catalog[key];
    if (hit) {
      return hit;
    }
  }

  return undefined;
}

function publish(next: CatalogIndex): void {
  index = next;
  version += 1;
  for (const listener of listeners) {
    listener();
  }
}

async function loadCacheFromDisk(): Promise<void> {
  try {
    const raw = await readFile(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as RawCatalog;
    publish(buildModelCatalogIndex(parsed));
  } catch {
    // Keep bundled fallback data.
  }
}

async function saveCache(raw: string): Promise<void> {
  await mkdir(join(homedir(), CONFIG_DIR_NAME), { recursive: true });
  await writeFile(CACHE_FILE, raw, 'utf8');
}

async function refreshFromNetwork(): Promise<void> {
  const response = await fetch(MODELS_URL, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    return;
  }

  const raw = await response.text();
  const parsed = JSON.parse(raw) as RawCatalog;
  publish(buildModelCatalogIndex(parsed));
  await saveCache(raw);
}

export function warmModelCatalog(): void {
  if (!bootstrapped) {
    bootstrapped = true;
    void loadCacheFromDisk();
  }

  if (refreshTask) {
    return;
  }

  refreshTask = refreshFromNetwork()
    .catch(() => {
      // Keep current catalog on network failures.
    })
    .finally(() => {
      refreshTask = null;
    });
}

export function subscribeToModelCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getModelCatalogVersion(): number {
  return version;
}

export function getModelContextWindow(provider: AIProvider, modelId: string): number | undefined {
  return resolveModelContextWindow(index, provider, modelId);
}
