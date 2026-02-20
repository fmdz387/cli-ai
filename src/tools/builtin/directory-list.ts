/**
 * directory_list tool - List directory contents with metadata
 */

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { defineTool } from '../types.js';
import { isWithinProjectRoot } from './path-utils.js';

const inputSchema = z.object({
  dirPath: z.string().describe('Absolute path to directory'),
  showHidden: z.boolean().optional().describe('Show hidden files'),
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
}

export const directoryListTool = defineTool({
  name: 'directory_list',
  description: `List directory contents with file metadata (size, modification date, type).

Usage notes:
- dirPath must be an absolute path.
- Shows file size (formatted: B, KB, MB) and last modified timestamp.
- Directories are marked as "dir", files as "file".
- Hidden files (starting with .) are excluded by default. Set showHidden to true to include them.
- Paths outside the project root are rejected.

When to use:
- Getting a quick overview of a directory's contents
- Checking what files exist before other operations
- Understanding project directory structure`,
  inputSchema,
  defaultPermission: 'allow',
  async execute(input, context) {
    const resolved = path.resolve(input.dirPath);
    if (!isWithinProjectRoot(resolved, context.projectRoot)) {
      return { kind: 'error', error: 'Path is outside project root' };
    }

    try {
      const entries = await readdir(resolved, { withFileTypes: true });
      const lines: string[] = [];

      for (const entry of entries) {
        if (!input.showHidden && entry.name.startsWith('.')) continue;

        const fullPath = path.join(resolved, entry.name);
        try {
          const stats = await stat(fullPath);
          const type = entry.isDirectory() ? 'dir ' : 'file';
          const size = entry.isDirectory() ? '    -' : formatSize(stats.size).padStart(5);
          const modified = formatDate(stats.mtimeMs);
          lines.push(`${type}  ${size}  ${modified}  ${entry.name}`);
        } catch {
          lines.push(`????  ${entry.name}`);
        }
      }

      if (lines.length === 0) {
        return { kind: 'success', output: '(empty directory)' };
      }

      return { kind: 'success', output: lines.join('\n') };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { kind: 'error', error: msg };
    }
  },
});
