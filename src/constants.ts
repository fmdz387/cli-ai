/**
 * Application constants and defaults
 */

import type { AppConfig } from './types/index.js';

/**
 * Application version
 */
export const VERSION = '3.0.0';

/**
 * Application name
 */
export const APP_NAME = 'CLI AI';

/**
 * Service name for keyring storage
 */
export const KEYRING_SERVICE = 'cli-ai';

/**
 * Account name for keyring storage
 */
export const KEYRING_ACCOUNT = 'anthropic';

/**
 * Config directory name (in user home)
 */
export const CONFIG_DIR_NAME = '.cli_ai_assistant';

/**
 * Default AI model
 */
export const DEFAULT_MODEL = 'claude-sonnet-4-5';

/**
 * Default application configuration
 */
export const DEFAULT_CONFIG: AppConfig = {
  model: DEFAULT_MODEL,
  maxHistoryEntries: 5,
  maxOutputLines: 10,
  maxAlternatives: 3,
  contextEnabled: true,
};

/**
 * Maximum characters per execution output in context (to limit token usage)
 */
export const MAX_CONTEXT_OUTPUT_CHARS = 500;

/**
 * Maximum history entries to include in context
 */
export const MAX_CONTEXT_HISTORY = 10;

/**
 * Dangerous command patterns - commands that should be flagged as high risk
 */
export const DANGEROUS_PATTERNS: readonly string[] = [
  'rm -rf',
  'sudo rm',
  'chmod 777',
  'mkfs',
  'dd if=',
  '> /dev/',
  'format',
  'del /f',
  'rmdir /s',
  'DROP TABLE',
  'DELETE FROM',
  '--no-preserve-root',
  ':(){:|:&};:',
  '| sh',
  '| bash',
  'curl | bash',
  'wget | bash',
  'eval',
  'sudo su',
  'passwd',
  'chown -R',
  '> /etc/',
  'fdisk',
  'wipefs',
  'shred',
] as const;

/**
 * Medium risk patterns - commands that modify system state
 */
export const MEDIUM_RISK_PATTERNS: readonly string[] = [
  'rm ',
  'mv ',
  'cp ',
  'sudo ',
  'npm install',
  'pnpm install',
  'yarn add',
  'pip install',
  'brew install',
  'apt install',
  'apt-get install',
  'pacman -S',
  'chmod ',
  'chown ',
  'git push',
  'git reset',
  'git rebase',
  'docker ',
  'kubectl ',
  'systemctl ',
  'service ',
  'kill ',
  'pkill ',
] as const;

/**
 * Command keywords for syntax highlighting
 */
export const COMMAND_KEYWORDS = [
  'sudo',
  'rm',
  'git',
  'npm',
  'pnpm',
  'yarn',
  'docker',
  'kubectl',
  'pip',
  'python',
  'node',
  'npx',
  'cd',
  'ls',
  'cat',
  'grep',
  'find',
  'mkdir',
  'touch',
  'mv',
  'cp',
  'echo',
  'curl',
  'wget',
  'ssh',
  'scp',
] as const;

/**
 * Maximum tokens for AI response
 */
export const MAX_AI_TOKENS = 500;

/**
 * Retry configuration for AI calls
 */
export const AI_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
} as const;

/**
 * Context token budget for AI calls
 */
export const CONTEXT_TOKEN_BUDGET = 4000;
