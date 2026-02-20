/**
 * /agent command - Toggles agentic mode
 */
import type { SlashCommand } from '../types.js';

export const agentCommand: SlashCommand = {
  name: 'agent',
  description: 'Switch to agentic mode',
  category: 'navigation',
  aliases: ['a'],

  execute: () => ({
    type: 'action',
    message: 'agent-mode',
  }),

  isAvailable: (status) => status === 'input' || status === 'palette',
};
