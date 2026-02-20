/**
 * Theme context provider and hook
 */
import { createContext, useContext, type ReactNode } from 'react';

import type { Theme } from './types.js';
import { catppuccinMocha } from './catppuccin-mocha.js';

const ThemeContext = createContext<Theme>(catppuccinMocha);

interface ThemeProviderProps {
  theme?: Theme;
  children: ReactNode;
}

export function ThemeProvider({ theme = catppuccinMocha, children }: ThemeProviderProps): ReactNode {
  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
