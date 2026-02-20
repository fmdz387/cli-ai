/**
 * /compact command - Compacts conversation history into a summary
 */

import type { SlashCommand } from '../types.js';

export const compactCommand: SlashCommand = {
  name: 'compact',
  description: 'Compact conversation into a summary',
  category: 'session',
  aliases: ['summarize'],

  execute: () => ({
    type: 'navigate',
    to: 'compact',
  }),

  isAvailable: (status) => status === 'input' || status === 'palette',
};
