/**
 * Controlled TextInput component - parent handles all input
 */

import { Text } from 'ink';
import chalk from 'chalk';
import { useMemo, type ReactNode } from 'react';

const cursor = chalk.inverse(' ');

export interface ControlledTextInputProps {
  value: string;
  cursorOffset: number;
  placeholder?: string;
  isDisabled?: boolean;
}

export function ControlledTextInput({
  value,
  cursorOffset,
  placeholder = '',
  isDisabled = false,
}: ControlledTextInputProps): ReactNode {
  const renderedPlaceholder = useMemo(() => {
    if (isDisabled) {
      return placeholder ? chalk.dim(placeholder) : '';
    }
    return placeholder && placeholder.length > 0
      ? chalk.inverse(placeholder[0]) + chalk.dim(placeholder.slice(1))
      : cursor;
  }, [isDisabled, placeholder]);

  const renderedValue = useMemo(() => {
    if (isDisabled) {
      return value;
    }

    let index = 0;
    let result = value.length > 0 ? '' : cursor;

    for (const char of value) {
      result += index === cursorOffset ? chalk.inverse(char) : char;
      index++;
    }

    if (value.length > 0 && cursorOffset === value.length) {
      result += cursor;
    }

    return result;
  }, [isDisabled, value, cursorOffset]);

  return <Text>{value.length > 0 ? renderedValue : renderedPlaceholder}</Text>;
}

export interface TextInputState {
  value: string;
  cursorOffset: number;
}

export const initialTextInputState: TextInputState = {
  value: '',
  cursorOffset: 0,
};

export function createTextInputState(defaultValue: string = ''): TextInputState {
  return {
    value: defaultValue,
    cursorOffset: defaultValue.length,
  };
}

export type TextInputAction =
  | { type: 'insert'; text: string }
  | { type: 'delete' }
  | { type: 'move-left' }
  | { type: 'move-right' }
  | { type: 'clear' }
  | { type: 'set'; value: string };

export function textInputReducer(
  state: TextInputState,
  action: TextInputAction
): TextInputState {
  switch (action.type) {
    case 'insert': {
      const newValue =
        state.value.slice(0, state.cursorOffset) +
        action.text +
        state.value.slice(state.cursorOffset);
      return {
        value: newValue,
        cursorOffset: state.cursorOffset + action.text.length,
      };
    }
    case 'delete': {
      if (state.cursorOffset === 0) return state;
      const newCursorOffset = state.cursorOffset - 1;
      return {
        value:
          state.value.slice(0, newCursorOffset) +
          state.value.slice(newCursorOffset + 1),
        cursorOffset: newCursorOffset,
      };
    }
    case 'move-left': {
      return {
        ...state,
        cursorOffset: Math.max(0, state.cursorOffset - 1),
      };
    }
    case 'move-right': {
      return {
        ...state,
        cursorOffset: Math.min(state.value.length, state.cursorOffset + 1),
      };
    }
    case 'clear': {
      return initialTextInputState;
    }
    case 'set': {
      return {
        value: action.value,
        cursorOffset: action.value.length,
      };
    }
    default:
      return state;
  }
}
