/**
 * file_edit tool - Find and replace exact string in a file
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { defineTool } from '../types.js';
import { isWithinProjectRoot } from './path-utils.js';

const inputSchema = z.object({
  filePath: z.string().describe('Absolute path to the file'),
  oldString: z.string().describe('Exact string to find'),
  newString: z.string().describe('Replacement string'),
});

export const fileEditTool = defineTool({
  name: 'file_edit',
  description: `Find and replace an exact string occurrence in a file.

Usage notes:
- filePath must be an absolute path.
- oldString must appear exactly once in the file. If it appears multiple times, the edit is rejected to prevent unintended changes.
- The replacement is an exact string match, not regex.
- ALWAYS use file_read first to see the exact content you want to replace. Copy the exact text from the file to use as oldString.

When to use:
- Making precise, targeted edits to existing files
- Changing function signatures, variable names, or specific code blocks
- Updating configuration values

When NOT to use:
- Creating new files -- use file_write instead.
- Replacing the majority of a file's content -- use file_write instead.`,
  inputSchema,
  defaultPermission: 'ask',
  async execute(input, context) {
    const resolved = path.resolve(input.filePath);
    if (!isWithinProjectRoot(resolved, context.projectRoot)) {
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
