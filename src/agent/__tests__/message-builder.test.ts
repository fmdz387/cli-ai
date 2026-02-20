/**
 * Unit tests for agent message builder
 */
import { describe, expect, it } from 'vitest';

import type { SystemPromptOptions } from '../message-builder.js';
import { buildAgentSystemPrompt, buildInitialMessages } from '../message-builder.js';

const defaultOptions: SystemPromptOptions = {
  shell: 'bash',
  cwd: '/tmp',
  platform: 'linux',
  model: 'claude-sonnet-4-5',
  provider: 'anthropic',
  isGitRepo: true,
};

describe('buildAgentSystemPrompt', () => {
  it('includes shell type in prompt', async () => {
    const prompt = await buildAgentSystemPrompt({ ...defaultOptions, shell: 'bash', cwd: '/home/user' });
    expect(prompt).toContain('bash');
  });

  it('includes platform in prompt', async () => {
    const prompt = await buildAgentSystemPrompt({ ...defaultOptions, shell: 'powershell', cwd: 'C:\\Users', platform: 'win32' });
    expect(prompt).toContain('win32');
  });

  it('includes working directory in prompt', async () => {
    const prompt = await buildAgentSystemPrompt({ ...defaultOptions, shell: 'zsh', cwd: '/projects/myapp', platform: 'darwin' });
    expect(prompt).toContain('/projects/myapp');
  });

  it('includes tool usage guidelines', async () => {
    const prompt = await buildAgentSystemPrompt(defaultOptions);
    expect(prompt).toContain('file_read');
    expect(prompt).toContain('grep_search');
    expect(prompt).toContain('Accuracy and honesty');
  });

  it('returns a non-empty string for all shell types', async () => {
    const shells = ['bash', 'zsh', 'fish', 'powershell', 'pwsh', 'cmd'] as const;
    for (const shell of shells) {
      const prompt = await buildAgentSystemPrompt({ ...defaultOptions, shell });
      expect(prompt.length).toBeGreaterThan(100);
    }
  });

  it('contains identity section', async () => {
    const prompt = await buildAgentSystemPrompt(defaultOptions);
    expect(prompt).toContain('CLI AI');
  });

  it('contains accuracy section', async () => {
    const prompt = await buildAgentSystemPrompt(defaultOptions);
    expect(prompt).toContain('Accuracy and honesty');
    expect(prompt).toContain('factual answers');
  });

  it('contains Anthropic overlay for anthropic provider', async () => {
    const prompt = await buildAgentSystemPrompt(defaultOptions);
    expect(prompt).toContain('Planning multi-step work');
  });

  it('contains OpenAI overlay for openai provider', async () => {
    const prompt = await buildAgentSystemPrompt({
      ...defaultOptions,
      model: 'gpt-5.2',
      provider: 'openai',
    });
    expect(prompt).toContain('Finish the entire task');
  });

  it('contains environment context with env tags', async () => {
    const prompt = await buildAgentSystemPrompt(defaultOptions);
    expect(prompt).toContain('<env>');
    expect(prompt).toContain('</env>');
  });

  it('works with unknown model on openrouter without errors', async () => {
    const prompt = await buildAgentSystemPrompt({
      ...defaultOptions,
      model: 'unknown-model',
      provider: 'openrouter',
    });
    expect(prompt).toContain('CLI AI');
    expect(prompt).not.toContain('Planning multi-step work');
    expect(prompt).not.toContain('Finish the entire task');
  });
});

describe('buildInitialMessages', () => {
  it('returns system and user messages', async () => {
    const messages = await buildInitialMessages('list files', defaultOptions);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe('system');
    expect(messages[1]!.role).toBe('user');
  });

  it('system message contains shell info', async () => {
    const messages = await buildInitialMessages('hello', {
      ...defaultOptions, shell: 'fish', cwd: '/home', platform: 'darwin',
    });
    const systemMsg = messages[0]!;
    if (systemMsg.role === 'system') {
      expect(systemMsg.content).toContain('fish');
      expect(systemMsg.content).toContain('darwin');
      expect(systemMsg.content).toContain('/home');
    }
  });

  it('user message contains the query', async () => {
    const messages = await buildInitialMessages('find all typescript files', defaultOptions);
    const userMsg = messages[1]!;
    if (userMsg.role === 'user') {
      expect(userMsg.content).toBe('find all typescript files');
    }
  });

  it('preserves exact query text without modification', async () => {
    const query = '  spaces  and\nnewlines  ';
    const messages = await buildInitialMessages(query, defaultOptions);
    if (messages[1]!.role === 'user') {
      expect(messages[1]!.content).toBe(query);
    }
  });
});
