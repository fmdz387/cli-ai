/**
 * Single Input Controller Hook - the ONLY useInput in the entire application
 * Prevents Ink stdin race conditions by centralizing all input handling
 */

import { useInput } from 'ink';
import { useCallback, useReducer, useRef, useState } from 'react';
import {
  textInputReducer,
  createTextInputState,
  type TextInputState,
  type TextInputAction,
} from '../components/ControlledTextInput.js';

export type InputMode =
  | 'disabled'      // No input handling (loading, executing)
  | 'text'          // Text input mode (typing queries)
  | 'menu'          // Options menu (1-5, arrows)
  | 'selection';    // Alternative selection (1-N, up/down)

export interface MenuCallbacks {
  onExecute: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onAlternatives: () => void;
  onCancel: () => void;
  onExplain: () => void;
  onToggle: () => void;
}

export interface SelectionCallbacks {
  onSelect: (index: number) => void;
  onCancel: () => void;
  count: number;
}

export interface TextCallbacks {
  onSubmit: (value: string) => void;
  onToggleOutput?: () => void;
  hasHistory: boolean;
}

export interface UseInputControllerOptions {
  mode: InputMode;
  menuCallbacks?: MenuCallbacks;
  selectionCallbacks?: SelectionCallbacks;
  textCallbacks?: TextCallbacks;
  /** Initial value for text input (e.g., when editing a command) */
  initialTextValue?: string;
}

export interface UseInputControllerReturn {
  /** Current text input state */
  textState: TextInputState;
  /** Dispatch action to text input reducer */
  dispatchText: React.Dispatch<TextInputAction>;
  /** Clear text input */
  clearText: () => void;
  /** Set text input value */
  setText: (value: string) => void;
  /** Menu focus index (0-4) */
  menuFocusIndex: number;
  /** Selection focus index */
  selectionFocusIndex: number;
}

export function useInputController({
  mode,
  menuCallbacks,
  selectionCallbacks,
  textCallbacks,
  initialTextValue = '',
}: UseInputControllerOptions): UseInputControllerReturn {
  const [textState, dispatchText] = useReducer(
    textInputReducer,
    createTextInputState(initialTextValue)
  );

  const [menuFocusIndex, setMenuFocusIndex] = useState(0);
  const [selectionFocusIndex, setSelectionFocusIndex] = useState(0);

  const prevInitialValueRef = useRef(initialTextValue);
  if (prevInitialValueRef.current !== initialTextValue) {
    prevInitialValueRef.current = initialTextValue;
    dispatchText({ type: 'set', value: initialTextValue });
  }

  const prevModeRef = useRef(mode);
  if (prevModeRef.current !== mode) {
    if (mode === 'menu') {
      setMenuFocusIndex(0);
    } else if (mode === 'selection') {
      setSelectionFocusIndex(0);
    }
    prevModeRef.current = mode;
  }

  const clearText = useCallback(() => {
    dispatchText({ type: 'clear' });
  }, []);

  const setText = useCallback((value: string) => {
    dispatchText({ type: 'set', value });
  }, []);

  useInput(
    (input, key) => {
      if (mode === 'disabled') {
        return;
      }

      if (mode === 'text' && textCallbacks) {
        if (key.ctrl && !key.meta && input === 'd') {
          if (textState.value.trim() === '') {
            process.exit(130);
          }
          return;
        }

        if (key.return) {
          const trimmed = textState.value.trim();
          if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
            process.exit(0);
          }
          if (trimmed) {
            textCallbacks.onSubmit(trimmed);
            dispatchText({ type: 'clear' });
          }
          return;
        }

        if (
          input.toLowerCase() === 'o' &&
          textState.value.trim() === '' &&
          textCallbacks.onToggleOutput &&
          textCallbacks.hasHistory
        ) {
          textCallbacks.onToggleOutput();
          return;
        }

        if (key.leftArrow) {
          dispatchText({ type: 'move-left' });
          return;
        }
        if (key.rightArrow) {
          dispatchText({ type: 'move-right' });
          return;
        }

        if (key.backspace || key.delete) {
          dispatchText({ type: 'delete' });
          return;
        }

        if (key.ctrl || key.meta || key.escape) {
          return;
        }

        if (key.tab) {
          return;
        }

        if (input && input.length > 0) {
          dispatchText({ type: 'insert', text: input });
        }
        return;
      }

      if (mode === 'menu' && menuCallbacks) {
        if (key.leftArrow) {
          setMenuFocusIndex((prev) => (prev - 1 + 5) % 5);
          return;
        }
        if (key.rightArrow) {
          setMenuFocusIndex((prev) => (prev + 1) % 5);
          return;
        }

        if (key.return) {
          const actions = ['execute', 'copy', 'edit', 'alternatives', 'cancel'] as const;
          const action = actions[menuFocusIndex];
          switch (action) {
            case 'execute': menuCallbacks.onExecute(); break;
            case 'copy': menuCallbacks.onCopy(); break;
            case 'edit': menuCallbacks.onEdit(); break;
            case 'alternatives': menuCallbacks.onAlternatives(); break;
            case 'cancel': menuCallbacks.onCancel(); break;
          }
          return;
        }

        if (input >= '1' && input <= '5') {
          const index = parseInt(input, 10) - 1;
          const actions = ['execute', 'copy', 'edit', 'alternatives', 'cancel'] as const;
          const action = actions[index];
          switch (action) {
            case 'execute': menuCallbacks.onExecute(); break;
            case 'copy': menuCallbacks.onCopy(); break;
            case 'edit': menuCallbacks.onEdit(); break;
            case 'alternatives': menuCallbacks.onAlternatives(); break;
            case 'cancel': menuCallbacks.onCancel(); break;
          }
          return;
        }

        if (input === '?') {
          menuCallbacks.onExplain();
          return;
        }

        if (input.toLowerCase() === 'o') {
          menuCallbacks.onToggle();
          return;
        }

        if (key.escape) {
          menuCallbacks.onCancel();
          return;
        }
        return;
      }

      if (mode === 'selection' && selectionCallbacks) {
        const count = selectionCallbacks.count;

        if (key.upArrow) {
          setSelectionFocusIndex((prev) => (prev - 1 + count) % count);
          return;
        }
        if (key.downArrow) {
          setSelectionFocusIndex((prev) => (prev + 1) % count);
          return;
        }

        if (key.return) {
          selectionCallbacks.onSelect(selectionFocusIndex);
          return;
        }

        const numKey = parseInt(input, 10);
        if (numKey >= 1 && numKey <= count) {
          selectionCallbacks.onSelect(numKey - 1);
          return;
        }

        if (input === '5' || input.toLowerCase() === 'c' || key.escape) {
          selectionCallbacks.onCancel();
          return;
        }
        return;
      }
    },
    { isActive: mode !== 'disabled' }
  );

  return {
    textState,
    dispatchText,
    clearText,
    setText,
    menuFocusIndex,
    selectionFocusIndex,
  };
}
