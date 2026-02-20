import type {
  CommandProposal,
  HistoryEntry,
  Result,
  SessionContext,
  ShellType,
} from '../types/index.js';
import { createHash } from 'node:crypto';
import { generateDirectoryTree } from './directory-tree.js';
import { createProvider, type Provider } from './providers/index.js';
import { getApiKey, getConfig } from './secure-storage.js';

let cachedProvider: { key: string; instance: Provider } | null = null;

async function getProvider(): Promise<Provider | null> {
  const config = getConfig();
  const apiKey = getApiKey(config.provider);
  if (!apiKey) return null;

  const keyHash = createHash('sha256').update(apiKey).digest('hex').slice(0, 8);
  const cacheKey = `${config.provider}:${config.model}:${keyHash}`;
  if (cachedProvider?.key === cacheKey) {
    return cachedProvider.instance;
  }

  const instance = await createProvider(config.provider, apiKey, config.model);
  cachedProvider = { key: cacheKey, instance };
  return instance;
}

export function clearProviderCache(): void {
  cachedProvider = null;
}

export async function generateCommand(
  query: string,
  context: SessionContext,
): Promise<Result<CommandProposal>> {
  const provider = await getProvider();
  if (!provider) {
    return { success: false, error: new Error('No API key configured') };
  }
  return provider.generateCommand(query, context);
}

export async function generateAlternatives(
  query: string,
  context: SessionContext,
  excludeCommand: string,
  count: number = 3,
): Promise<Result<CommandProposal[]>> {
  const provider = await getProvider();
  if (!provider) {
    return { success: false, error: new Error('No API key configured') };
  }
  return provider.generateAlternatives(query, context, excludeCommand, count);
}

export async function explainCommand(command: string): Promise<Result<string>> {
  const provider = await getProvider();
  if (!provider) {
    return { success: false, error: new Error('No API key configured') };
  }
  return provider.explainCommand(command);
}

export async function createSessionContext(
  shell: ShellType,
  history: HistoryEntry[] = [],
): Promise<SessionContext> {
  const cwd = process.cwd();
  return {
    shell,
    cwd,
    platform: process.platform,
    directoryTree: await generateDirectoryTree(cwd),
    history,
  };
}
