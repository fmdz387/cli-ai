/**
 * Debug logging utility - writes to file to avoid Ink screen clearing
 *
 * Enable with environment variable:
 *   PowerShell: $env:DEBUG="1"; pnpm dev
 *   CMD:        set DEBUG=1 && pnpm dev
 *   Git Bash:   DEBUG=1 pnpm dev
 *
 * View logs in another terminal:
 *   PowerShell: Get-Content -Wait debug.log
 *   CMD/Bash:   tail -f debug.log
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const isDebug = process.env['DEBUG'] === '1' || process.env['DEBUG'] === 'true';
const logFile = join(process.cwd(), 'debug.log');

// Clear log file on startup
if (isDebug) {
  try {
    writeFileSync(logFile, `=== Debug session started: ${new Date().toISOString()} ===\n`);
  } catch {
    // Ignore
  }
}

export function debug(message: string, data?: unknown): void {
  if (!isDebug) return;

  const time = new Date().toISOString().slice(11, 23);
  let line = `[${time}] ${message}`;

  if (data !== undefined) {
    line += `: ${JSON.stringify(data)}`;
  }

  try {
    appendFileSync(logFile, line + '\n');
  } catch {
    // Ignore write errors
  }
}
