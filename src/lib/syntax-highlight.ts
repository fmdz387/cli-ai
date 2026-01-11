/**
 * Chalk-based syntax highlighting for shell commands
 */

import chalk from 'chalk';

import { COMMAND_KEYWORDS } from '../constants.js';

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

function colorToken(token: Token): string {
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

export function highlightCommand(command: string): string {
  const tokens = tokenize(command);
  return tokens.map(colorToken).join('');
}

export interface StyledSegment {
  text: string;
  color?: string;
  bold?: boolean;
}

export function getCommandSegments(command: string): StyledSegment[] {
  const tokens = tokenize(command);

  return tokens.map((token): StyledSegment => {
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
  });
}
