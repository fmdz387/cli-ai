/**
 * Application constants and defaults
 */
import type { AIProvider, AppConfig } from './types/index.js';

/**
 * Application version
 */
export const VERSION = '3.1.0';

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
 * @deprecated Use PROVIDER_CONFIG[provider].keyringAccount instead
 */
export const KEYRING_ACCOUNT = 'anthropic';

/**
 * Config directory name (in user home)
 */
export const CONFIG_DIR_NAME = '.cli_ai_assistant';

/**
 * All supported AI providers - single source of truth
 */
export const AI_PROVIDERS: readonly AIProvider[] = ['anthropic', 'openrouter', 'openai'] as const;

/**
 * Default AI provider
 */
export const DEFAULT_PROVIDER: AIProvider = 'anthropic';

/**
 * Provider configuration - single source of truth for all provider settings
 */
export const PROVIDER_CONFIG = {
  anthropic: {
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    keyringAccount: 'anthropic',
    keyPrefix: 'sk-ant-',
    defaultModel: 'claude-sonnet-4-5',
  },
  openrouter: {
    name: 'OpenRouter',
    envVar: 'OPENROUTER_API_KEY',
    keyringAccount: 'openrouter',
    keyPrefix: 'sk-or-',
    defaultModel: 'anthropic/claude-sonnet-4.5',
  },
  openai: {
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    keyringAccount: 'openai',
    keyPrefix: 'sk-',
    defaultModel: 'gpt-5.2',
  },
} as const satisfies Record<
  AIProvider,
  {
    name: string;
    envVar: string;
    keyringAccount: string;
    keyPrefix: string;
    defaultModel: string;
  }
>;

/**
 * Default AI model
 */
export const DEFAULT_MODEL = PROVIDER_CONFIG[DEFAULT_PROVIDER].defaultModel;

/**
 * Default application configuration
 */
export const DEFAULT_CONFIG: AppConfig = {
  provider: DEFAULT_PROVIDER,
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
