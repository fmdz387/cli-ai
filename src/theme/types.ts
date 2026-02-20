/**
 * Theme type definitions with semantic color tokens
 */
export interface Theme {
  // Backgrounds
  background: string;
  backgroundPanel: string;
  backgroundElement: string;

  // Text
  text: string;
  textMuted: string;

  // Accent colors
  primary: string;
  secondary: string;
  accent: string;

  // Status colors
  error: string;
  warning: string;
  success: string;
  info: string;

  // Borders
  border: string;
  borderActive: string;

  // Syntax highlighting
  syntaxKeyword: string;
  syntaxString: string;
  syntaxVariable: string;
  syntaxFlag: string;
  syntaxPipe: string;
  syntaxPath: string;

  // Markdown
  markdownHeading: string;
  markdownLink: string;
  markdownCode: string;
  markdownBlockquote: string;
}
