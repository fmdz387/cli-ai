/**
 * file_edit tool - Find and replace exact string in a file
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { defineTool } from '../types.js';

const inputSchema = z.object({
  filePath: z.string().describe('Absolute path to the file'),
  oldString: z.string().describe('Exact string to find'),
  newString: z.string().describe('Replacement string'),
});

export const fileEditTool = defineTool({
  name: 'file_edit',
  description: 'Find and replace an exact string occurrence in a file',
  inputSchema,
  defaultPermission: 'ask',
  async execute(input, context) {
    const resolved = path.resolve(input.filePath);
    if (!resolved.startsWith(context.projectRoot)) {
      return { kind: 'error', error: 'Path is outside project root' };
    }

    try {
      const content = await readFile(resolved, 'utf-8');

      const occurrences = content.split(input.oldString).length - 1;
      if (occurrences === 0) {
        return { kind: 'error', error: 'oldString not found in file' };
      }
      if (occurrences > 1) {
        return {
          kind: 'error',
          error: `oldString found ${occurrences} times; must be unique (found ${occurrences})`,
        };
      }

      const updated = content.replace(input.oldString, input.newString);
      await writeFile(resolved, updated, 'utf-8');

      return { kind: 'success', output: `Replaced 1 occurrence in ${input.filePath}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { kind: 'error', error: msg };
    }
  },
});
