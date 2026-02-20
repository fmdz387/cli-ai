/**
 * Single Input Controller Hook - the ONLY useInput in the entire application
 * Prevents Ink stdin race conditions by centralizing all input handling
 */
import {
  textInputReducer,
  createTextInputState,
  type TextInputState,
  type TextInputAction,
} from '../components/ControlledTextInput.js';

import { useInput } from 'ink';
import { useCallback, useReducer, useRef, useState } from 'react';

export type InputMode =
  | 'disabled' // No input handling (loading, executing)
  | 'text' // Text input mode (typing queries, with agent permission intercepts)
  | 'palette' // Command palette (filter, navigate, select)
  | 'config' // Config panel (navigate sections/items)
  | 'help'; // Help panel (just Escape to close)

export interface TextCallbacks {
  onSubmit: (value: string) => void;
  onTextChange?: (value: string) => void;
  onNavigateInlinePalette?: (direction: 'up' | 'down') => void;
  onCloseInlinePalette?: () => void;
  hasInlinePalette?: boolean;
}

export interface AgenticCallbacks {
  onAbort: () => void;
  onApprove: () => void;
  onDeny: () => void;
  onApproveSession: () => void;
  hasPendingPermission: boolean;
  isAgentRunning: boolean;
}

export interface PaletteCallbacks {
  onQueryChange: (query: string) => void;
  onSelect: () => void;
  onNavigate: (direction: 'up' | 'down') => void;
  onClose: () => void;
  filteredCount: number;
}

export interface ConfigCallbacks {
  onNavigateSection: (direction: 'next' | 'prev') => void;
  onNavigateItem: (direction: 'up' | 'down') => void;
  onToggle: () => void;
  onClose: () => void;
  sectionCount: number;
  itemCount: number;
  isEditingCustomModel?: boolean;
  onCustomModelSubmit?: (value: string) => void;
  onCustomModelCancel?: () => void;
}

export interface HelpCallbacks {
  onClose: () => void;
}

export interface UseInputControllerOptions {
  mode: InputMode;
  textCallbacks?: TextCallbacks;
  agenticCallbacks?: AgenticCallbacks;
  paletteCallbacks?: PaletteCallbacks;
  configCallbacks?: ConfigCallbacks;
  helpCallbacks?: HelpCallbacks;
  /** Initial value for text input */
  initialTextValue?: string;
  /** Current palette query for text state sync */
  paletteQuery?: string;
}

export interface UseInputControllerReturn {
  textState: TextInputState;
  dispatchText: React.Dispatch<TextInputAction>;
  clearText: () => void;
  setText: (value: string) => void;
  paletteFocusIndex: number;
  configSectionIndex: number;
  configItemIndex: number;
  customModelState: TextInputState;
  dispatchCustomModel: React.Dispatch<TextInputAction>;
}

export function useInputController({
  mode,
  textCallbacks,
  agenticCallbacks,
  paletteCallbacks,
  configCallbacks,
  helpCallbacks,
  initialTextValue = '',
  paletteQuery = '',
}: UseInputControllerOptions): UseInputControllerReturn {
  const [textState, dispatchText] = useReducer(
    textInputReducer,
    createTextInputState(initialTextValue),
  );

  const [customModelState, dispatchCustomModel] = useReducer(
    textInputReducer,
    createTextInputState(''),
  );

  const [paletteFocusIndex, setPaletteFocusIndex] = useState(0);
  const [configSectionIndex, setConfigSectionIndex] = useState(0);
  const [configItemIndex, setConfigItemIndex] = useState(0);

  const prevInitialValueRef = useRef(initialTextValue);
  if (prevInitialValueRef.current !== initialTextValue) {
    prevInitialValueRef.current = initialTextValue;
    dispatchText({ type: 'set', value: initialTextValue });
  }

  const prevModeRef = useRef(mode);
  if (prevModeRef.current !== mode) {
    if (mode === 'palette') {
      setPaletteFocusIndex(0);
    } else if (mode === 'config') {
      setConfigSectionIndex(0);
      setConfigItemIndex(0);
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
        // Ctrl+C: abort running agent
        if (key.ctrl && input === 'c' && agenticCallbacks?.isAgentRunning) {
          agenticCallbacks.onAbort();
          return;
        }

        // When a permission prompt is pending, intercept y/n/A
        if (agenticCallbacks?.hasPendingPermission) {
          if (input === 'y') {
            agenticCallbacks.onApprove();
            return;
          }
          if (input === 'n') {
            agenticCallbacks.onDeny();
            return;
          }
          if (input === 'A') {
            agenticCallbacks.onApproveSession();
            return;
          }
          // Block all other input while permission is pending
          return;
        }

        // Don't allow text input while agent is running
        if (agenticCallbacks?.isAgentRunning) {
          return;
        }

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

        // Handle Up/Down arrows for inline palette navigation
        if (textCallbacks.hasInlinePalette && textCallbacks.onNavigateInlinePalette) {
          if (key.upArrow) {
            textCallbacks.onNavigateInlinePalette('up');
            return;
          }
          if (key.downArrow) {
            textCallbacks.onNavigateInlinePalette('down');
            return;
          }
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
          const newValue =
            textState.value.slice(0, textState.cursorOffset - 1) +
            textState.value.slice(textState.cursorOffset);
          textCallbacks.onTextChange?.(newValue);
          return;
        }

        // Handle Escape to close inline palette and clear input
        if (key.escape) {
          if (textCallbacks.hasInlinePalette && textCallbacks.onCloseInlinePalette) {
            textCallbacks.onCloseInlinePalette();
            dispatchText({ type: 'clear' });
          }
          return;
        }

        if (key.ctrl || key.meta) {
          return;
        }

        if (key.tab) {
          return;
        }

        if (input && input.length > 0) {
          dispatchText({ type: 'insert', text: input });
          const newValue =
            textState.value.slice(0, textState.cursorOffset) +
            input +
            textState.value.slice(textState.cursorOffset);
          textCallbacks.onTextChange?.(newValue);
        }
        return;
      }

      // Palette mode: filter commands, navigate, select
      if (mode === 'palette' && paletteCallbacks) {
        const count = paletteCallbacks.filteredCount;

        if (key.upArrow) {
          setPaletteFocusIndex((prev) => {
            if (count === 0) return 0;
            return (prev - 1 + count) % count;
          });
          paletteCallbacks.onNavigate('up');
          return;
        }

        if (key.downArrow) {
          setPaletteFocusIndex((prev) => {
            if (count === 0) return 0;
            return (prev + 1) % count;
          });
          paletteCallbacks.onNavigate('down');
          return;
        }

        if (key.return) {
          paletteCallbacks.onSelect();
          return;
        }

        if (key.escape) {
          paletteCallbacks.onClose();
          return;
        }

        // Backspace on empty query closes palette
        if ((key.backspace || key.delete) && paletteQuery === '') {
          paletteCallbacks.onClose();
          return;
        }

        // Handle text input for filtering
        if (key.backspace || key.delete) {
          const newQuery = paletteQuery.slice(0, -1);
          paletteCallbacks.onQueryChange(newQuery);
          setPaletteFocusIndex(0);
          return;
        }

        if (key.ctrl || key.meta || key.tab) {
          return;
        }

        // Number keys for quick select (1-9)
        const numKey = parseInt(input, 10);
        if (numKey >= 1 && numKey <= 9 && numKey <= count) {
          setPaletteFocusIndex(numKey - 1);
          paletteCallbacks.onSelect();
          return;
        }

        if (input && input.length > 0) {
          const newQuery = paletteQuery + input;
          paletteCallbacks.onQueryChange(newQuery);
          setPaletteFocusIndex(0);
        }
        return;
      }

      // Config mode: navigate sections and items
      if (mode === 'config' && configCallbacks) {
        const sectionCount = configCallbacks.sectionCount;
        const itemCount = configCallbacks.itemCount;

        // Custom model editing mode
        if (configCallbacks.isEditingCustomModel) {
          if (key.escape) {
            dispatchCustomModel({ type: 'clear' });
            configCallbacks.onCustomModelCancel?.();
            return;
          }
          if (key.return) {
            const value = customModelState.value;
            if (value.trim()) {
              configCallbacks.onCustomModelSubmit?.(value.trim());
            } else {
              configCallbacks.onCustomModelCancel?.();
            }
            dispatchCustomModel({ type: 'clear' });
            return;
          }
          if (key.leftArrow) {
            dispatchCustomModel({ type: 'move-left' });
            return;
          }
          if (key.rightArrow) {
            dispatchCustomModel({ type: 'move-right' });
            return;
          }
          if (key.backspace || key.delete) {
            dispatchCustomModel({ type: 'delete' });
            return;
          }
          if (!key.ctrl && !key.meta && !key.tab && input && input.length > 0) {
            dispatchCustomModel({ type: 'insert', text: input });
            return;
          }
          return;
        }

        // Tab navigates between sections
        if (key.tab && !key.shift) {
          setConfigSectionIndex((prev) => (prev + 1) % sectionCount);
          setConfigItemIndex(0);
          configCallbacks.onNavigateSection('next');
          return;
        }

        if (key.tab && key.shift) {
          setConfigSectionIndex((prev) => (prev - 1 + sectionCount) % sectionCount);
          setConfigItemIndex(0);
          configCallbacks.onNavigateSection('prev');
          return;
        }

        // Arrow keys navigate items within section
        if (key.upArrow) {
          setConfigItemIndex((prev) => {
            if (itemCount === 0) return 0;
            return (prev - 1 + itemCount) % itemCount;
          });
          configCallbacks.onNavigateItem('up');
          return;
        }

        if (key.downArrow) {
          setConfigItemIndex((prev) => {
            if (itemCount === 0) return 0;
            return (prev + 1) % itemCount;
          });
          configCallbacks.onNavigateItem('down');
          return;
        }

        // Enter or Space toggles/activates item
        if (key.return || input === ' ') {
          configCallbacks.onToggle();
          return;
        }

        // Escape closes config panel
        if (key.escape) {
          configCallbacks.onClose();
          return;
        }
        return;
      }

      // Help mode: just Escape to close
      if (mode === 'help' && helpCallbacks) {
        if (key.escape) {
          helpCallbacks.onClose();
          return;
        }
        return;
      }
    },
    { isActive: mode !== 'disabled' },
  );

  return {
    textState,
    dispatchText,
    clearText,
    setText,
    paletteFocusIndex,
    configSectionIndex,
    configItemIndex,
    customModelState,
    dispatchCustomModel,
  };
}
