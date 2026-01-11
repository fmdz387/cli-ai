/**
 * Platform and shell detection utilities
 */

import type { ShellType } from '../types/index.js';

export function detectShell(): ShellType {
  if (process.platform === 'win32') {
    if (process.env.MSYSTEM || process.env.MINGW_PREFIX) {
      return 'bash';
    }
    if (process.env.PSModulePath?.includes('PowerShell\\7')) {
      return 'pwsh';
    }
    if (process.env.PSModulePath) {
      return 'powershell';
    }
    return 'cmd';
  }

  const shell = process.env.SHELL ?? '/bin/bash';

  if (shell.includes('zsh')) {
    return 'zsh';
  }
  if (shell.includes('fish')) {
    return 'fish';
  }

  return 'bash';
}

export function getShellCommand(
  shell: ShellType,
  command: string
): { cmd: string; args: string[] } {
  switch (shell) {
    case 'powershell':
      return { cmd: 'powershell', args: ['-Command', command] };
    case 'pwsh':
      return { cmd: 'pwsh', args: ['-Command', command] };
    case 'cmd':
      return { cmd: 'cmd', args: ['/c', command] };
    case 'bash':
    case 'zsh':
    case 'fish':
    default:
      return { cmd: shell, args: ['-c', command] };
  }
}

export function getPlatformName(): string {
  switch (process.platform) {
    case 'win32':
      return 'Windows';
    case 'darwin':
      return 'macOS';
    case 'linux':
      return 'Linux';
    default:
      return process.platform;
  }
}

export function isGitBash(): boolean {
  return (
    process.platform === 'win32' &&
    (process.env.MSYSTEM !== undefined || process.env.MINGW_PREFIX !== undefined)
  );
}

export function isWSL(): boolean {
  return (
    process.platform === 'linux' &&
    (process.env.WSL_DISTRO_NAME !== undefined ||
      process.env.WSLENV !== undefined)
  );
}
