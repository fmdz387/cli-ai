/**
 * Slash command system exports
 */

// Re-export types
export type {
  CommandCategory,
  CommandContext,
  CommandRegistry,
  CommandResult,
  ConfigPanelState,
  ConfigSection,
  DisplayToggles,
  SlashCommand,
} from './types.js';

export { AVAILABLE_MODELS } from './types.js';

// Re-export registry
export { commandRegistry, createCommandRegistry } from './registry.js';

// Import built-in commands
import {
  agentCommand,
  clearCommand,
  configCommand,
  exitCommand,
  helpCommand,
} from './builtin/index.js';
import { commandRegistry } from './registry.js';

// Register built-in commands
commandRegistry.register(agentCommand);
commandRegistry.register(configCommand);
commandRegistry.register(helpCommand);
commandRegistry.register(clearCommand);
commandRegistry.register(exitCommand);
