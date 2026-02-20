/**
 * Agent message builder for constructing system prompts and initial messages
 */

import type { AIProvider, ShellType } from '../types/index.js';
import { discoverInstructions } from './instructions.js';
import { assembleSystemPrompt } from './prompts/index.js';
import type { AgentMessage } from './types.js';

export interface SystemPromptOptions {
  shell: ShellType;
  cwd: string;
  platform: NodeJS.Platform;
  model: string;
  provider: AIProvider;
  isGitRepo: boolean;
}

export async function buildAgentSystemPrompt(options: SystemPromptOptions): Promise<string> {
  const instructions = await discoverInstructions(options.cwd);
  return assembleSystemPrompt({
    model: options.model,
    provider: options.provider,
    shell: options.shell,
    cwd: options.cwd,
    platform: options.platform,
    isGitRepo: options.isGitRepo,
    instructions,
  });
}

export async function buildInitialMessages(
  query: string,
  options: SystemPromptOptions,
): Promise<AgentMessage[]> {
  return [
    { role: 'system', content: await buildAgentSystemPrompt(options) },
    { role: 'user', content: query },
  ];
}
