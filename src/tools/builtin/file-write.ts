/**
 * file_write tool - Write content to a file
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { defineTool } from '../types.js';

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
  description: 'Write content to a file, creating parent directories if needed',
  inputSchema,
  defaultPermission: 'ask',
  async execute(input, context) {
    const resolved = path.resolve(input.filePath);
    if (!resolved.startsWith(context.projectRoot)) {
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
