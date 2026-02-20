/**
 * file_read tool - Read file contents with optional line range
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { defineTool } from '../types.js';
import { isWithinProjectRoot } from './path-utils.js';

const MAX_LINES = 2000;
const MAX_LINE_LENGTH = 2000;
const BINARY_CHECK_BYTES = 512;

const inputSchema = z.object({
  filePath: z.string().describe('Absolute path to the file to read'),
  startLine: z.number().optional().describe('1-based start line'),
  endLine: z.number().optional().describe('1-based end line'),
});

function validatePath(filePath: string, projectRoot: string): string | null {
  const resolved = path.resolve(filePath);
  if (!isWithinProjectRoot(resolved, projectRoot)) {
    return `Path "${filePath}" is outside project root`;
  }
  return null;
}

function isBinary(buffer: Buffer): boolean {
  const check = buffer.subarray(0, BINARY_CHECK_BYTES);
  return check.includes(0);
}

function formatLines(lines: string[], start: number): string {
  return lines
    .map((line, i) => {
      const num = start + i;
      const truncated =
        line.length > MAX_LINE_LENGTH
          ? line.slice(0, MAX_LINE_LENGTH) + '...'
          : line;
      return `${num}\t${truncated}`;
    })
    .join('\n');
}

export const fileReadTool = defineTool({
  name: 'file_read',
  description: `Read the contents of a file with optional line range.

Usage notes:
- filePath must be an absolute path, not a relative path.
- By default, reads up to 2000 lines from the start of the file.
- Use startLine and endLine to read specific ranges of large files.
- Lines longer than 2000 characters are truncated.
- Output uses numbered line format (line_number<tab>content) for easy reference.

When to use:
- Examining source code before making edits
- Checking configuration files
- Verifying file contents after modifications
- Understanding code structure and patterns

Important:
- Binary files are detected and rejected.
- Paths outside the project root are rejected for security.`,
  inputSchema,
  defaultPermission: 'allow',
  async execute(input, context) {
    const pathError = validatePath(input.filePath, context.projectRoot);
    if (pathError) {
      return { kind: 'error', error: pathError };
    }

    try {
      const buffer = await readFile(input.filePath);
      if (isBinary(buffer)) {
        return { kind: 'error', error: 'Cannot read binary file' };
      }

      const allLines = buffer.toString('utf-8').split('\n');
      const start = input.startLine ? Math.max(1, input.startLine) : 1;
      const end = input.endLine
        ? Math.min(allLines.length, input.endLine)
        : Math.min(allLines.length, start + MAX_LINES - 1);

      const lines = allLines.slice(start - 1, end);
      const output = formatLines(lines, start);

      const total = allLines.length;
      const suffix =
        end < total ? `\n(showing lines ${start}-${end} of ${total})` : '';
      return { kind: 'success', output: output + suffix };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { kind: 'error', error: msg };
    }
  },
});
