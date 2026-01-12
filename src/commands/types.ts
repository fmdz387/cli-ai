/**
 * Slash command type definitions for CLI AI v3
 */

import type { AppConfig } from '../types/index.js';

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
  | { type: 'navigate'; to: 'input' | 'clear' }
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

/**
 * Config panel section identifiers
 */
export type ConfigSection = 'api-key' | 'model' | 'toggles' | 'about';

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

/**
 * Available models for selection
 */
export const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Fast and capable' },
  { id: 'claude-opus-4-1-20250219', name: 'Claude Opus 4.1', description: 'Most capable' },
  { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', description: 'Fastest' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced' },
] as const;

/**
 * Display toggle options
 */
export interface DisplayToggles {
  showExplanations: boolean;
  syntaxHighlighting: boolean;
  simpleMode: boolean;
  contextEnabled: boolean;
}
