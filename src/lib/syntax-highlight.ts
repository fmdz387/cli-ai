/**
 * Chalk-based syntax highlighting for shell commands with theme support
 */

import chalk from 'chalk';

import { COMMAND_KEYWORDS } from '../constants.js';
import type { Theme } from '../theme/types.js';

type TokenType = 'keyword' | 'flag' | 'string' | 'pipe' | 'path' | 'variable' | 'default';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(command: string): Token[] {
  const tokens: Token[] = [];
  const parts = command.split(/(\s+)/);

  for (const part of parts) {
    if (!part) continue;

    // Whitespace
    if (/^\s+$/.test(part)) {
      tokens.push({ type: 'default', value: part });
      continue;
    }

    // Pipes and redirects
    if (/^[|><&;]+$/.test(part) || part === '&&' || part === '||') {
      tokens.push({ type: 'pipe', value: part });
      continue;
    }

    // Flags (--flag or -f)
    if (/^-{1,2}[\w-]+=?/.test(part)) {
      tokens.push({ type: 'flag', value: part });
      continue;
    }

    // Environment variables ($VAR or ${VAR})
    if (/^\$[\w{}]+/.test(part)) {
      tokens.push({ type: 'variable', value: part });
      continue;
    }

    // Quoted strings
    if (/^["'].*["']$/.test(part)) {
      tokens.push({ type: 'string', value: part });
      continue;
    }

    // Paths (contains /)
    if (part.includes('/') || part.includes('\\')) {
      tokens.push({ type: 'path', value: part });
      continue;
    }

    // Keywords
    if (COMMAND_KEYWORDS.includes(part.toLowerCase() as (typeof COMMAND_KEYWORDS)[number])) {
      tokens.push({ type: 'keyword', value: part });
      continue;
    }

    // Default
    tokens.push({ type: 'default', value: part });
  }

  return tokens;
}

function colorToken(token: Token, theme?: Theme): string {
  if (theme) {
    switch (token.type) {
      case 'keyword':
        return chalk.hex(theme.syntaxKeyword).bold(token.value);
      case 'flag':
        return chalk.hex(theme.syntaxFlag)(token.value);
      case 'string':
        return chalk.hex(theme.syntaxString)(token.value);
      case 'pipe':
        return chalk.hex(theme.syntaxPipe)(token.value);
      case 'path':
        return chalk.hex(theme.syntaxPath)(token.value);
      case 'variable':
        return chalk.hex(theme.syntaxVariable)(token.value);
      default:
        return token.value;
    }
  }

  switch (token.type) {
    case 'keyword':
      return chalk.cyan.bold(token.value);
    case 'flag':
      return chalk.yellow(token.value);
    case 'string':
      return chalk.green(token.value);
    case 'pipe':
      return chalk.magenta(token.value);
    case 'path':
      return chalk.blue(token.value);
    case 'variable':
      return chalk.cyan(token.value);
    default:
      return token.value;
  }
}

export function highlightCommand(command: string, theme?: Theme): string {
  const tokens = tokenize(command);
  return tokens.map((t) => colorToken(t, theme)).join('');
}

export interface StyledSegment {
  text: string;
  color?: string;
  bold?: boolean;
}

function tokenToSegment(token: Token, theme?: Theme): StyledSegment {
  if (theme) {
    switch (token.type) {
      case 'keyword':
        return { text: token.value, color: theme.syntaxKeyword, bold: true };
      case 'flag':
        return { text: token.value, color: theme.syntaxFlag };
      case 'string':
        return { text: token.value, color: theme.syntaxString };
      case 'pipe':
        return { text: token.value, color: theme.syntaxPipe };
      case 'path':
        return { text: token.value, color: theme.syntaxPath };
      case 'variable':
        return { text: token.value, color: theme.syntaxVariable };
      default:
        return { text: token.value };
    }
  }

  switch (token.type) {
    case 'keyword':
      return { text: token.value, color: 'cyan', bold: true };
    case 'flag':
      return { text: token.value, color: 'yellow' };
    case 'string':
      return { text: token.value, color: 'green' };
    case 'pipe':
      return { text: token.value, color: 'magenta' };
    case 'path':
      return { text: token.value, color: 'blue' };
    case 'variable':
      return { text: token.value, color: 'cyan' };
    default:
      return { text: token.value };
  }
}

export function getCommandSegments(command: string, theme?: Theme): StyledSegment[] {
  const tokens = tokenize(command);
  return tokens.map((t) => tokenToSegment(t, theme));
}
