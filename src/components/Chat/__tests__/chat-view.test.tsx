import { render } from 'ink-testing-library';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AssistantMessage, ChatMessage } from '../../../types/chat.js';
import { ChatView } from '../ChatView.js';

vi.mock('../../../theme/index.js', () => ({
  useTheme: () => ({
    background: '#1e1e2e',
    backgroundPanel: '#313244',
    backgroundElement: '#45475a',
    text: '#cdd6f4',
    textMuted: '#6c7086',
    primary: '#cba6f7',
    secondary: '#89b4fa',
    accent: '#f5c2e7',
    error: '#f38ba8',
    warning: '#fab387',
    success: '#a6e3a1',
    info: '#89b4fa',
    border: '#585b70',
    borderActive: '#cba6f7',
    syntaxKeyword: '#cba6f7',
    syntaxString: '#a6e3a1',
    syntaxVariable: '#89b4fa',
    syntaxFlag: '#fab387',
    syntaxPipe: '#f38ba8',
    syntaxPath: '#f5c2e7',
    markdownHeading: '#cba6f7',
    markdownLink: '#89b4fa',
    markdownCode: '#a6e3a1',
    markdownBlockquote: '#6c7086',
  }),
}));

function output(instance: ReturnType<typeof render>): string {
  return instance.lastFrame() ?? '';
}

function assistant(text: string, timestamp: number, isStreaming = false): AssistantMessage {
  return {
    role: 'assistant',
    timestamp,
    isStreaming,
    parts: text ? [{ type: 'text', text }] : [],
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('ChatView', () => {
  it('renders completed history alongside a live assistant message', () => {
    const messages: ChatMessage[] = [
      { role: 'user', text: 'first user', timestamp: 1 },
      assistant('first assistant', 2),
      assistant('streaming assistant', 3, true),
    ];

    const frame = output(render(<ChatView messages={messages} pendingPermission={null} />));

    expect(frame).toContain('first user');
    expect(frame).toContain('first assistant');
    expect(frame).toContain('streaming assistant');
  });

  it('does not show hidden-history messaging', () => {
    const messages: ChatMessage[] = [
      { role: 'user', text: 'alpha', timestamp: 1 },
      assistant('beta', 2),
      { role: 'system', text: 'gamma', timestamp: 3 },
    ];

    const frame = output(render(<ChatView messages={messages} pendingPermission={null} />));

    expect(frame).not.toContain('earlier messages hidden');
  });
});
