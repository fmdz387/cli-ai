import { useInputController } from '../useInputController.js';

import { render } from 'ink-testing-library';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type InputHandler = (input: string, key: Record<string, boolean | undefined>) => void;

let capturedInput: InputHandler | null = null;

vi.mock('ink', async () => {
  const actual = await vi.importActual<typeof import('ink')>('ink');
  return {
    ...actual,
    useInput: (handler: InputHandler) => {
      capturedInput = handler;
    },
  };
});

function Harness({
  onToggle,
  mode = 'config',
}: {
  onToggle: (index: number) => void;
  mode?: 'config' | 'text';
}) {
  const [itemIndex, setItemIndex] = useState(0);

  useInputController({
    mode,
    textCallbacks: mode === 'text'
      ? {
          onSubmit: () => {},
        }
      : undefined,
    configCallbacks: {
      onNavigateSection: () => {},
      onJumpToSection: () => {},
      onNavigateItem: setItemIndex,
      onToggle,
      onClose: () => {},
      sectionCount: 5,
      itemCount: 5,
      currentItemIndex: itemIndex,
    },
  });

  return null;
}

describe('useInputController config mode', () => {
  beforeEach(() => {
    capturedInput = null;
  });

  it('toggles the currently focused item after repeated navigation', async () => {
    let toggledIndex: number | null = null;

    render(<Harness onToggle={(index) => {
      toggledIndex = index;
    }}
    />);

    expect(capturedInput).not.toBeNull();

    capturedInput?.('', { downArrow: true });
    capturedInput?.('', { downArrow: true });
    capturedInput?.('', { downArrow: true });
    capturedInput?.('', { return: true });

    await Promise.resolve();

    expect(toggledIndex).toBe(3);
  });
});
