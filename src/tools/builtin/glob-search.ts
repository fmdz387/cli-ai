/**
 * glob_search tool - Find files by glob pattern
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { defineTool } from '../types.js';

const MAX_RESULTS = 200;
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__',
  '.venv', 'venv', 'coverage', '.cache', '.next',
]);

const inputSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files'),
  path: z.string().optional().describe('Directory to search in'),
});

function globToRegex(pattern: string): RegExp {
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i]!;
    if (c === '*' && pattern[i + 1] === '*') {
      regex += '.*';
      i += pattern[i + 2] === '/' ? 3 : 2;
    } else if (c === '*') {
      regex += '[^/]*';
      i++;
    } else if (c === '?') {
      regex += '[^/]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(c)) {
      regex += '\\' + c;
      i++;
    } else {
      regex += c;
      i++;
    }
  }
  return new RegExp(`^${regex}$`);
}

interface WalkOptions {
  dir: string;
  root: string;
  regex: RegExp;
  results: string[];
}

async function walkDir(options: WalkOptions): Promise<void> {
  if (options.results.length >= MAX_RESULTS) return;

  let entries;
  try {
    entries = await readdir(options.dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (options.results.length >= MAX_RESULTS) break;
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(options.dir, entry.name);
    const relPath = path.relative(options.root, fullPath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      await walkDir({ ...options, dir: fullPath });
    } else if (options.regex.test(relPath) || options.regex.test(entry.name)) {
      options.results.push(relPath);
    }
  }
}

export const globSearchTool = defineTool({
  name: 'glob_search',
  description: 'Find files matching a glob pattern',
  inputSchema,
  defaultPermission: 'allow',
  async execute(input, context) {
    const searchDir = input.path
      ? path.resolve(input.path)
      : context.projectRoot;

    if (!searchDir.startsWith(context.projectRoot)) {
      return { kind: 'error', error: 'Path is outside project root' };
    }

    const regex = globToRegex(input.pattern);
    const results: string[] = [];
    await walkDir({ dir: searchDir, root: context.projectRoot, regex, results });

    if (results.length === 0) {
      return { kind: 'success', output: 'No files matched the pattern.' };
    }

    const suffix = results.length >= MAX_RESULTS
      ? `\n(results truncated at ${MAX_RESULTS})`
      : '';
    return { kind: 'success', output: results.join('\n') + suffix };
  },
});
