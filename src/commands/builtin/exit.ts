/**
 * /exit command - Exit the application
 */

import type { SlashCommand } from '../types.js';

export const exitCommand: SlashCommand = {
  name: 'exit',
  description: 'Exit the application',
  category: 'session',
  aliases: ['quit', 'q'],

  execute: () => ({
    type: 'exit',
  }),

  isAvailable: () => true,
};
