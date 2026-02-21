/**
 * Slash command type definitions for CLI AI v3
 */
import type { AIProvider, AppConfig } from '../types/index.js';

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
    { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Most capable' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Fast and efficient' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano', description: 'Fastest' },
  ],
};

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
