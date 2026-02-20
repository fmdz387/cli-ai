/**
 * Model-aware prompt selector and system prompt assembler
 */

import type { AIProvider, ShellType } from '../../types/index.js';
import { getAnthropicOverlay } from './anthropic.js';
import { getBasePrompt } from './base.js';
import { buildEnvironmentContext } from './environment.js';
import { getGeminiOverlay } from './gemini.js';
import { getOpenAIOverlay } from './openai.js';

export interface AssemblePromptOptions {
  model: string;
  provider: AIProvider;
  shell: ShellType;
  cwd: string;
  platform: NodeJS.Platform;
  isGitRepo: boolean;
  instructions: string[];
}

export function selectPromptOverlay(model: string, provider: AIProvider): string {
  if (model.includes('claude') || provider === 'anthropic') {
    return getAnthropicOverlay();
  }
  if (
    model.includes('gpt-') ||
    model.includes('o1') ||
    model.includes('o3') ||
    model.includes('o4') ||
    provider === 'openai'
  ) {
    return getOpenAIOverlay();
  }
  if (model.includes('gemini')) {
    return getGeminiOverlay();
  }
  return '';
}

export function assembleSystemPrompt(options: AssemblePromptOptions): string {
  const parts: string[] = [];

  parts.push(getBasePrompt());

  const overlay = selectPromptOverlay(options.model, options.provider);
  if (overlay) {
    parts.push(overlay);
  }

  for (const instruction of options.instructions) {
    parts.push(instruction);
  }

  parts.push(
    buildEnvironmentContext({
      model: options.model,
      cwd: options.cwd,
      isGitRepo: options.isGitRepo,
      platform: options.platform,
      shell: options.shell,
    }),
  );

  return parts.join('\n\n');
}
