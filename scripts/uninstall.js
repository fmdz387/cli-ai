#!/usr/bin/env node

/**
 * CLI AI Uninstall Script
 * Safely removes all cli-ai components from the system
 *
 * Usage: node scripts/uninstall.js [--force]
 *
 * Components removed:
 * - API key from system keyring
 * - Config directory (~/.cli_ai_assistant)
 * - Global npm/pnpm link (optional)
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, rmSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const CONFIG_DIR_NAME = '.cli_ai_assistant';
const KEYRING_SERVICE = 'cli-ai';
const KEYRING_ACCOUNT = 'anthropic';

const isWindows = platform() === 'win32';
const isMac = platform() === 'darwin';
const isLinux = platform() === 'linux';

const forceMode = process.argv.includes('--force') || process.argv.includes('-f');

/**
 * Print colored output
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    warn: '\x1b[33m',    // yellow
    error: '\x1b[31m',   // red
    reset: '\x1b[0m',
  };

  const prefix = {
    info: 'ℹ',
    success: '✓',
    warn: '⚠',
    error: '✗',
  };

  console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
}

/**
 * Prompt user for confirmation
 */
async function confirm(question) {
  if (forceMode) return true;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Remove API key from system keyring
 */
async function removeKeyringEntry() {
  log('Removing API key from system keyring...');

  try {
    // Try using @napi-rs/keyring first (if available)
    try {
      const { Entry } = await import('@napi-rs/keyring');
      const entry = new Entry(KEYRING_SERVICE, KEYRING_ACCOUNT);
      entry.deleteCredential();
      log('API key removed from keyring (via @napi-rs/keyring)', 'success');
      return true;
    } catch {
      // Fall through to platform-specific methods
    }

    // Platform-specific fallbacks
    if (isWindows) {
      // Windows Credential Manager
      const result = spawnSync('cmdkey', ['/delete:cli-ai'], {
        encoding: 'utf-8',
        shell: true,
      });
      if (result.status === 0) {
        log('API key removed from Windows Credential Manager', 'success');
        return true;
      }
    } else if (isMac) {
      // macOS Keychain
      const result = spawnSync('security', [
        'delete-generic-password',
        '-s', KEYRING_SERVICE,
        '-a', KEYRING_ACCOUNT,
      ], { encoding: 'utf-8' });
      if (result.status === 0) {
        log('API key removed from macOS Keychain', 'success');
        return true;
      }
    } else if (isLinux) {
      // Linux secret-tool (GNOME Keyring)
      const result = spawnSync('secret-tool', [
        'clear',
        'service', KEYRING_SERVICE,
        'account', KEYRING_ACCOUNT,
      ], { encoding: 'utf-8' });
      if (result.status === 0) {
        log('API key removed from Linux keyring', 'success');
        return true;
      }
    }

    log('No API key found in keyring (may not have been stored there)', 'warn');
    return true;
  } catch (error) {
    log(`Could not remove keyring entry: ${error.message}`, 'warn');
    return false;
  }
}

/**
 * Remove config directory
 */
function removeConfigDirectory() {
  const configDir = join(homedir(), CONFIG_DIR_NAME);

  if (!existsSync(configDir)) {
    log(`Config directory not found: ${configDir}`, 'warn');
    return true;
  }

  log(`Removing config directory: ${configDir}`);

  try {
    rmSync(configDir, { recursive: true, force: true });
    log('Config directory removed', 'success');
    return true;
  } catch (error) {
    log(`Failed to remove config directory: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Remove global package link
 */
function removeGlobalLink() {
  log('Checking for global package installation...');

  // Try pnpm first
  try {
    const pnpmResult = spawnSync('pnpm', ['list', '-g', '--depth=0'], {
      encoding: 'utf-8',
      shell: true,
    });

    if (pnpmResult.stdout && pnpmResult.stdout.includes('cli-ai')) {
      log('Found pnpm global link, removing...');
      const unlinkResult = spawnSync('pnpm', ['unlink', '--global', '@fmdz387/cli-ai'], {
        encoding: 'utf-8',
        shell: true,
      });
      if (unlinkResult.status === 0) {
        log('Removed pnpm global link', 'success');
        return true;
      }
    }
  } catch {
    // pnpm not available
  }

  // Try npm
  try {
    const npmResult = spawnSync('npm', ['list', '-g', '--depth=0'], {
      encoding: 'utf-8',
      shell: true,
    });

    if (npmResult.stdout && npmResult.stdout.includes('cli-ai')) {
      log('Found npm global link, removing...');
      const unlinkResult = spawnSync('npm', ['unlink', '-g', '@fmdz387/cli-ai'], {
        encoding: 'utf-8',
        shell: true,
      });
      if (unlinkResult.status === 0) {
        log('Removed npm global link', 'success');
        return true;
      }
    }
  } catch {
    // npm not available
  }

  log('No global package link found', 'info');
  return true;
}

/**
 * Remove shell alias from config files
 */
function removeShellAliases() {
  log('Checking for shell aliases...');

  const shellConfigs = [];

  if (isWindows) {
    // PowerShell profile locations
    const psProfile = join(homedir(), 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
    const pwshProfile = join(homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
    if (existsSync(psProfile)) shellConfigs.push(psProfile);
    if (existsSync(pwshProfile)) shellConfigs.push(pwshProfile);
  } else {
    // Unix shell configs
    const bashrc = join(homedir(), '.bashrc');
    const zshrc = join(homedir(), '.zshrc');
    const fishConfig = join(homedir(), '.config', 'fish', 'config.fish');

    if (existsSync(bashrc)) shellConfigs.push(bashrc);
    if (existsSync(zshrc)) shellConfigs.push(zshrc);
    if (existsSync(fishConfig)) shellConfigs.push(fishConfig);
  }

  let aliasesRemoved = 0;

  for (const configPath of shellConfigs) {
    try {
      const content = readFileSync(configPath, 'utf-8');

      // Look for cli-ai related aliases
      const aliasPatterns = [
        /^.*alias\s+s\s*=.*cli[_-]?ai.*$/gm,
        /^.*Set-Alias.*cli[_-]?ai.*$/gm,
        /^.*function\s+s\s*\(\).*cli[_-]?ai.*$/gm,
        /^# CLI AI.*$/gm,
      ];

      let newContent = content;
      let hasChanges = false;

      for (const pattern of aliasPatterns) {
        if (pattern.test(newContent)) {
          hasChanges = true;
          newContent = newContent.replace(pattern, '');
        }
      }

      if (hasChanges) {
        // Create backup
        const backupPath = `${configPath}.cli-ai-backup`;
        copyFileSync(configPath, backupPath);
        log(`Created backup: ${backupPath}`, 'info');

        // Clean up empty lines
        newContent = newContent.replace(/\n{3,}/g, '\n\n').trim() + '\n';
        writeFileSync(configPath, newContent);
        log(`Removed alias from: ${configPath}`, 'success');
        aliasesRemoved++;
      }
    } catch (error) {
      log(`Could not process ${configPath}: ${error.message}`, 'warn');
    }
  }

  if (aliasesRemoved === 0) {
    log('No shell aliases found', 'info');
  }

  return true;
}

/**
 * Main uninstall flow
 */
async function main() {
  console.log('\n\x1b[1m\x1b[35m🗑️  CLI AI Uninstaller\x1b[0m\n');

  if (!forceMode) {
    console.log('This will remove:');
    console.log('  • API key from system keyring');
    console.log(`  • Config directory (~/${CONFIG_DIR_NAME})`);
    console.log('  • Global package link (if exists)');
    console.log('  • Shell aliases (if configured)\n');

    const proceed = await confirm('Do you want to proceed?');
    if (!proceed) {
      log('Uninstall cancelled', 'info');
      process.exit(0);
    }
    console.log();
  }

  const results = {
    keyring: await removeKeyringEntry(),
    config: removeConfigDirectory(),
    globalLink: removeGlobalLink(),
    aliases: removeShellAliases(),
  };

  console.log('\n\x1b[1m--- Summary ---\x1b[0m\n');

  const allSuccess = Object.values(results).every(Boolean);

  if (allSuccess) {
    log('CLI AI has been completely removed from your system!', 'success');
    console.log('\nNote: If you installed via npm/pnpm globally, you may also want to run:');
    console.log('  npm uninstall -g @fmdz387/cli-ai');
    console.log('  # or');
    console.log('  pnpm uninstall -g @fmdz387/cli-ai\n');
  } else {
    log('Uninstall completed with some warnings (see above)', 'warn');
  }

  // Remind about shell restart
  console.log('\x1b[33mRestart your terminal for changes to take effect.\x1b[0m\n');
}

main().catch((error) => {
  log(`Uninstall failed: ${error.message}`, 'error');
  process.exit(1);
});
