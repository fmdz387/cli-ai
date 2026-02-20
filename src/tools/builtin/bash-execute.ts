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
  description: 'Execute a shell command and return its output',
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
