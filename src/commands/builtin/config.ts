/**
 * /config command - Opens settings and configuration panel
 */

import type { SlashCommand } from '../types.js';

export const configCommand: SlashCommand = {
  name: 'config',
  description: 'Open settings and configuration panel',
  category: 'settings',
  aliases: ['settings', 'preferences', 'prefs'],
  shortcut: 'Ctrl+,',

  execute: () => ({
    type: 'panel',
    panel: 'config',
  }),

  isAvailable: (status) => status === 'input' || status === 'palette',
};
