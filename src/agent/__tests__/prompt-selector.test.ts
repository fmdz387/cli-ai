/**
 * Tests for prompt selection and assembly
 */
import { describe, expect, it } from 'vitest';

import { assembleSystemPrompt, selectPromptOverlay } from '../prompts/index.js';

describe('selectPromptOverlay', () => {
  it('returns Anthropic overlay for claude model with anthropic provider', () => {
    const overlay = selectPromptOverlay('claude-sonnet-4-5', 'anthropic');
    expect(overlay).toContain('Planning multi-step work');
  });

  it('returns Anthropic overlay for claude model on openrouter', () => {
    const overlay = selectPromptOverlay('anthropic/claude-sonnet-4.5', 'openrouter');
    expect(overlay).toContain('Planning multi-step work');
  });

  it('returns OpenAI overlay for gpt model with openai provider', () => {
    const overlay = selectPromptOverlay('gpt-5.2', 'openai');
    expect(overlay).toContain('Finish the entire task');
  });

  it('returns Gemini overlay for gemini model on openrouter', () => {
    const overlay = selectPromptOverlay('gemini-2.0-flash', 'openrouter');
    expect(overlay).toContain('Project conventions');
  });

  it('returns empty string for unknown model on openrouter', () => {
    const overlay = selectPromptOverlay('unknown-model', 'openrouter');
    expect(overlay).toBe('');
  });
});

describe('assembleSystemPrompt', () => {
  it('contains base prompt identity', () => {
    const prompt = assembleSystemPrompt({
      model: 'claude-sonnet-4-5',
      provider: 'anthropic',
      shell: 'bash',
      cwd: '/tmp',
      platform: 'linux',
      isGitRepo: false,
      instructions: [],
    });
    expect(prompt).toContain('CLI AI');
  });

  it('contains environment context with env tags', () => {
    const prompt = assembleSystemPrompt({
      model: 'claude-sonnet-4-5',
      provider: 'anthropic',
      shell: 'bash',
      cwd: '/tmp',
      platform: 'linux',
      isGitRepo: true,
      instructions: [],
    });
    expect(prompt).toContain('<env>');
    expect(prompt).toContain('</env>');
  });

  it('contains overlay content for anthropic provider', () => {
    const prompt = assembleSystemPrompt({
      model: 'claude-sonnet-4-5',
      provider: 'anthropic',
      shell: 'bash',
      cwd: '/tmp',
      platform: 'linux',
      isGitRepo: false,
      instructions: [],
    });
    expect(prompt).toContain('Planning multi-step work');
  });

  it('contains instruction content when provided', () => {
    const prompt = assembleSystemPrompt({
      model: 'claude-sonnet-4-5',
      provider: 'anthropic',
      shell: 'bash',
      cwd: '/tmp',
      platform: 'linux',
      isGitRepo: false,
      instructions: ['Instructions from /project/CLAUDE.md:\nAlways use tabs.'],
    });
    expect(prompt).toContain('Always use tabs');
  });
});
