/**
 * /help command - Shows help and keyboard shortcuts
 */
import type { SlashCommand } from '../types.js';

export const helpCommand: SlashCommand = {
  name: 'help',
  description: 'Show help and keyboard shortcuts',
  category: 'help',
  aliases: ['h', '?'],

  execute: () => ({
    type: 'panel',
    panel: 'help',
  }),

  isAvailable: () => true,
};
