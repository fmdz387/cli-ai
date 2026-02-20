/**
 * directory_list tool - List directory contents with metadata
 */

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { defineTool } from '../types.js';

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
  description: 'List directory contents with file sizes and dates',
  inputSchema,
  defaultPermission: 'allow',
  async execute(input, context) {
    const resolved = path.resolve(input.dirPath);
    if (!resolved.startsWith(context.projectRoot)) {
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
