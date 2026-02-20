/**
 * Unit tests for agent message builder
 */
import { describe, expect, it } from 'vitest';

import { buildAgentSystemPrompt, buildInitialMessages } from '../message-builder.js';

describe('buildAgentSystemPrompt', () => {
  it('includes shell type in prompt', () => {
    const prompt = buildAgentSystemPrompt({ shell: 'bash', cwd: '/home/user', platform: 'linux' });
    expect(prompt).toContain('bash');
  });

  it('includes platform in prompt', () => {
    const prompt = buildAgentSystemPrompt({ shell: 'powershell', cwd: 'C:\\Users', platform: 'win32' });
    expect(prompt).toContain('win32');
  });

  it('includes working directory in prompt', () => {
    const prompt = buildAgentSystemPrompt({ shell: 'zsh', cwd: '/projects/myapp', platform: 'darwin' });
    expect(prompt).toContain('/projects/myapp');
  });

  it('includes tool usage guidelines', () => {
    const prompt = buildAgentSystemPrompt({ shell: 'bash', cwd: '/tmp', platform: 'linux' });
    expect(prompt).toContain('Read before writing');
    expect(prompt).toContain('Search before assuming');
    expect(prompt).toContain('Execute with care');
  });

  it('returns a non-empty string for all shell types', () => {
    const shells = ['bash', 'zsh', 'fish', 'powershell', 'pwsh', 'cmd'] as const;
    for (const shell of shells) {
      const prompt = buildAgentSystemPrompt({ shell, cwd: '/tmp', platform: 'linux' });
      expect(prompt.length).toBeGreaterThan(100);
    }
  });
});

describe('buildInitialMessages', () => {
  it('returns system and user messages', () => {
    const messages = buildInitialMessages('list files', {
      shell: 'bash', cwd: '/tmp', platform: 'linux',
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe('system');
    expect(messages[1]!.role).toBe('user');
  });

  it('system message contains shell info', () => {
    const messages = buildInitialMessages('hello', {
      shell: 'fish', cwd: '/home', platform: 'darwin',
    });
    const systemMsg = messages[0]!;
    if (systemMsg.role === 'system') {
      expect(systemMsg.content).toContain('fish');
      expect(systemMsg.content).toContain('darwin');
      expect(systemMsg.content).toContain('/home');
    }
  });

  it('user message contains the query', () => {
    const messages = buildInitialMessages('find all typescript files', {
      shell: 'bash', cwd: '/tmp', platform: 'linux',
    });
    const userMsg = messages[1]!;
    if (userMsg.role === 'user') {
      expect(userMsg.content).toBe('find all typescript files');
    }
  });

  it('preserves exact query text without modification', () => {
    const query = '  spaces  and\nnewlines  ';
    const messages = buildInitialMessages(query, {
      shell: 'bash', cwd: '/tmp', platform: 'linux',
    });
    if (messages[1]!.role === 'user') {
      expect(messages[1]!.content).toBe(query);
    }
  });
});
