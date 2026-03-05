/**
 * Slash command type definitions for CLI AI v3
 */
import type { AIProvider, AppConfig, OpenAIAuthMode } from '../types/index.js';

/**
 * Command categories for organization and filtering
 */
export type CommandCategory = 'settings' | 'navigation' | 'help' | 'session';

/**
 * Context passed to command handlers
 */
export interface CommandContext {
  sessionStatus: string;
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  exit: () => void;
}

/**
 * Result of command execution
 */
export type CommandResult =
  | { type: 'panel'; panel: 'config' | 'help' }
  | { type: 'action'; message: string }
  | { type: 'navigate'; to: 'input' | 'clear' | 'compact' }
  | { type: 'exit' };

/**
 * Slash command definition
 */
export interface SlashCommand {
  /** Command name without slash (e.g., 'config') */
  name: string;
  /** Short description for palette display */
  description: string;
  /** Command category for grouping */
  category: CommandCategory;
  /** Keyboard shortcut hint (optional) */
  shortcut?: string;
  /** Aliases (e.g., ['settings', 'prefs'] for /config) */
  aliases?: string[];
  /** Execute the command */
  execute: (context: CommandContext) => CommandResult | Promise<CommandResult>;
  /** Whether command is available in current context */
  isAvailable?: (sessionStatus: string) => boolean;
}

/**
 * Command registry interface
 */
export interface CommandRegistry {
  /** All registered commands */
  readonly commands: readonly SlashCommand[];
  /** Get command by name or alias */
  get: (nameOrAlias: string) => SlashCommand | undefined;
  /** Filter commands by query (fuzzy match) */
  filter: (query: string) => SlashCommand[];
  /** Register a new command */
  register: (command: SlashCommand) => void;
}

export type ConfigSection = 'provider' | 'model' | 'api-keys' | 'options' | 'about';

/**
 * Config panel state
 */
export interface ConfigPanelState {
  activeSection: ConfigSection;
  focusedItem: number;
  isEditing: boolean;
  pendingApiKey: string;
  error: string | null;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
}

export const CUSTOM_MODEL_OPTION: ModelOption = {
  id: '__custom__',
  name: 'Custom model...',
  description: 'Enter any model ID',
};

export const PROVIDER_MODELS: Record<AIProvider, readonly ModelOption[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Fast and capable' },
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', description: 'Most capable' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Fastest' },
  ],
  openrouter: [
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'Anthropic' },
    { id: 'xiaomi/mimo-v2-flash:free', name: 'MiMo-V2-Flash', description: 'Xiaomi (Free)' },
    { id: 'x-ai/grok-code-fast-1', name: 'Grok Code Fast 1', description: 'xAI' },
    { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', description: 'Google' },
  ],
  openai: [
    // Direct API models
    { id: 'gpt-5.4', name: 'GPT-5.4', description: 'Most capable latest model' },
    { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Most capable thinking model' },
    { id: 'gpt-5.2-mini', name: 'GPT-5.2 Mini', description: 'Fast and efficient' },
    { id: 'gpt-5.2-nano', name: 'GPT-5.2 Nano', description: 'Fastest' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Previous gen mini' },
    // Codex models (available with OAuth only)
    { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', description: 'Codex - optimized for coding' },
    { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', description: 'Codex - latest coding model' },
    { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', description: 'Codex - previous gen' },
    { id: 'gpt-5.1-codex-max', name: 'GPT-5.1 Codex Max', description: 'Codex - extended context' },
    { id: 'gpt-5.1-codex-mini', name: 'GPT-5.1 Codex Mini', description: 'Codex - fast' },
  ],
};

/** Models only available via Codex OAuth */
export const CODEX_ONLY_MODELS = new Set([
  'gpt-5.2-codex',
  'gpt-5.3-codex',
  'gpt-5.1-codex',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini',
]);

/** Models allowed when using Codex OAuth (all Codex + compatible direct models) */
export const CODEX_ALLOWED_MODELS = new Set([
  'gpt-5.4',
  'gpt-5.2',
  'gpt-5.2-codex',
  'gpt-5.3-codex',
  'gpt-5.1-codex',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini',
]);

export function getProviderModels(
  provider: AIProvider,
  options?: { openaiAuthMode?: OpenAIAuthMode },
): readonly ModelOption[] {
  const models = PROVIDER_MODELS[provider];
  if (provider !== 'openai') {
    return models;
  }

  if ((options?.openaiAuthMode ?? 'api-key') === 'codex-oauth') {
    return models.filter((model) => CODEX_ALLOWED_MODELS.has(model.id));
  }

  return models.filter((model) => !CODEX_ONLY_MODELS.has(model.id));
}

/** @deprecated Use PROVIDER_MODELS instead */
export const AVAILABLE_MODELS = PROVIDER_MODELS.anthropic;

/**
 * Display toggle options
 */
export interface DisplayToggles {
  showExplanations: boolean;
  syntaxHighlighting: boolean;
  simpleMode: boolean;
  contextEnabled: boolean;
}
