/**
 * file_write tool - Write content to a file
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { defineTool } from '../types.js';
import { isWithinProjectRoot } from './path-utils.js';

const inputSchema = z.object({
  filePath: z.string().describe('Absolute path to write'),
  content: z.string().describe('Content to write to the file'),
});

function isEnvFile(filePath: string): boolean {
  const base = path.basename(filePath);
  return base === '.env' || base.startsWith('.env.');
}

export const fileWriteTool = defineTool({
  name: 'file_write',
  description: `Write content to a file, creating parent directories as needed.

Usage notes:
- filePath must be an absolute path, not a relative path.
- Creates parent directories automatically if they do not exist.
- Overwrites the file if it already exists.

Safety:
- Writing to .env files is blocked to prevent accidental secret exposure.
- Paths outside the project root are rejected.
- ALWAYS use file_read first to understand existing file content before overwriting. Do not blindly overwrite files.

When to use:
- Creating new files
- Replacing entire file contents when file_edit is impractical (e.g., too many changes)

When NOT to use:
- For small, targeted edits to existing files -- use file_edit instead.`,
  inputSchema,
  defaultPermission: 'ask',
  async execute(input, context) {
    const resolved = path.resolve(input.filePath);
    if (!isWithinProjectRoot(resolved, context.projectRoot)) {
      return { kind: 'error', error: 'Path is outside project root' };
    }

    if (isEnvFile(resolved)) {
      return { kind: 'error', error: 'Writing .env files is not allowed' };
    }

    try {
      await mkdir(path.dirname(resolved), { recursive: true });
      await writeFile(resolved, input.content, 'utf-8');
      const bytes = Buffer.byteLength(input.content, 'utf-8');
      return { kind: 'success', output: `Wrote ${bytes} bytes to ${input.filePath}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { kind: 'error', error: msg };
    }
  },
});
