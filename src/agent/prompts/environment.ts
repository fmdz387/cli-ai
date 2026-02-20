/**
 * Environment context builder for system prompts
 */

import type { ShellType } from '../../types/index.js';

export interface EnvironmentOptions {
  model: string;
  cwd: string;
  isGitRepo: boolean;
  platform: NodeJS.Platform;
  shell: ShellType;
}

export function buildEnvironmentContext(options: EnvironmentOptions): string {
  const { model, cwd, isGitRepo, platform, shell } = options;

  return `You are powered by the model: ${model}.

Here is useful information about the environment you are running in:
<env>
  Working directory: ${cwd}
  Is directory a git repo: ${isGitRepo ? 'Yes' : 'No'}
  Platform: ${platform}
  Shell: ${shell}
  Today's date: ${new Date().toDateString()}
</env>`;
}
