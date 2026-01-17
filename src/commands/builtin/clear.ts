/**
 * /clear command - Clears session history
 */

import type { SlashCommand } from '../types.js';

export const clearCommand: SlashCommand = {
  name: 'clear',
  description: 'Clear conversation history',
  category: 'session',
  aliases: ['cls'],

  execute: () => ({
    type: 'navigate',
    to: 'clear',
  }),

  isAvailable: (status) => status === 'input' || status === 'palette',
};
