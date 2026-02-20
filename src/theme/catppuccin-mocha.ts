/**
 * Catppuccin Mocha theme - default theme
 * https://github.com/catppuccin/catppuccin
 */
import type { Theme } from './types.js';

export const catppuccinMocha: Theme = {
  // Backgrounds
  background: '#1e1e2e',       // Base
  backgroundPanel: '#313244',  // Surface0
  backgroundElement: '#45475a', // Surface1

  // Text
  text: '#cdd6f4',             // Text
  textMuted: '#6c7086',        // Overlay0

  // Accent colors
  primary: '#cba6f7',          // Mauve
  secondary: '#89b4fa',        // Blue
  accent: '#f5c2e7',           // Pink

  // Status colors
  error: '#f38ba8',            // Red
  warning: '#fab387',          // Peach
  success: '#a6e3a1',          // Green
  info: '#89dceb',             // Sky

  // Borders
  border: '#585b70',           // Surface2
  borderActive: '#cba6f7',     // Mauve

  // Syntax highlighting
  syntaxKeyword: '#cba6f7',    // Mauve
  syntaxString: '#a6e3a1',     // Green
  syntaxVariable: '#89dceb',   // Sky
  syntaxFlag: '#fab387',       // Peach
  syntaxPipe: '#f5c2e7',       // Pink
  syntaxPath: '#89b4fa',       // Blue

  // Markdown
  markdownHeading: '#cba6f7',  // Mauve
  markdownLink: '#89b4fa',     // Blue
  markdownCode: '#a6e3a1',     // Green
  markdownBlockquote: '#6c7086', // Overlay0
};
