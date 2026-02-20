/**
 * bash_execute tool - Execute shell commands
 */

import { z } from 'zod';

import { getShellCommand } from '../../lib/platform.js';
import { defineTool } from '../types.js';

const DEFAULT_TIMEOUT = 120_000;
const MAX_OUTPUT_BYTES = 50 * 1024;

const inputSchema = z.object({
  command: z.string().describe('Shell command to execute'),
  timeout: z.number().optional().describe('Timeout in milliseconds'),
});

function truncateOutput(text: string): string {
  if (Buffer.byteLength(text, 'utf-8') <= MAX_OUTPUT_BYTES) {
    return text;
  }
  const buf = Buffer.from(text, 'utf-8');
  const truncated = buf.subarray(0, MAX_OUTPUT_BYTES).toString('utf-8');
  return truncated + '\n...(output truncated)';
}

export const bashExecuteTool = defineTool({
  name: 'bash_execute',
  description: `Execute a shell command in the user's terminal with optional timeout.

All commands run in the project working directory by default.

IMPORTANT: This tool is for terminal operations ONLY (git, npm, docker, builds, tests, etc.).
DO NOT use it for file operations -- use the specialized tools instead:
- File search: Use glob_search (NOT find or ls)
- Content search: Use grep_search (NOT grep or rg)
- Read files: Use file_read (NOT cat, head, or tail)
- Edit files: Use file_edit (NOT sed or awk)
- Write files: Use file_write (NOT echo > or cat <<EOF)
- Communicate: Output text directly (NOT echo or printf)

Usage notes:
- The command parameter is required.
- Timeout defaults to 120000ms (2 minutes). Set a longer timeout for slow operations.
- Output exceeding 50KB will be truncated from the middle.
- When issuing multiple independent commands, make multiple bash_execute calls in a single response to run them in parallel.
- For sequential dependencies, chain with && in a single call.

Git safety:
- NEVER use destructive git commands (force push, reset --hard) unless explicitly requested.
- NEVER commit changes unless the user explicitly asks you to commit.
- NEVER skip git hooks (--no-verify) unless explicitly requested.
- When creating commits, write clear, descriptive commit messages.`,
  inputSchema,
  defaultPermission: 'ask',
  async execute(input, context) {
    const { cmd, args } = getShellCommand(context.shell, input.command);
    const timeout = input.timeout ?? DEFAULT_TIMEOUT;

    try {
      const { execa } = await import('execa');
      const result = await execa(cmd, args, {
        reject: false,
        all: true,
        buffer: true,
        cwd: context.cwd,
        timeout,
        cancelSignal: context.signal,
      });

      const stdout = result.stdout ?? '';
      const stderr = result.stderr ?? '';
      const exitCode = result.exitCode ?? 0;
      const combined = [
        stdout ? truncateOutput(stdout) : '',
        stderr ? `[stderr]\n${truncateOutput(stderr)}` : '',
        `[exit code: ${exitCode}]`,
      ]
        .filter(Boolean)
        .join('\n');

      return { kind: 'success', output: combined };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { kind: 'error', error: msg };
    }
  },
});
