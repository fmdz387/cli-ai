/**
 * grep_search tool - Search file contents with regex
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { defineTool } from '../types.js';
import { isWithinProjectRoot } from './path-utils.js';

const DEFAULT_MAX_RESULTS = 100;
const BINARY_CHECK_BYTES = 512;
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__',
  '.venv', 'venv', 'coverage', '.cache', '.next',
]);

const inputSchema = z.object({
  pattern: z.string().describe('Regex pattern to search for'),
  path: z.string().optional().describe('Directory or file to search'),
  filePattern: z.string().optional().describe('File name filter (e.g. "*.ts")'),
  maxResults: z.number().optional().describe('Maximum results to return'),
});

function hasNestedQuantifiers(pattern: string): boolean {
  const quantifiers = new Set(['+', '*', '?']);
  let depth = 0;
  let hasInnerQuantifier = false;
  let escaped = false;

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '(') { depth++; hasInnerQuantifier = false; }
    else if (ch === ')') {
      if (depth > 0 && hasInnerQuantifier) {
        const next = pattern[i + 1];
        if (next && (quantifiers.has(next) || next === '{')) return true;
      }
      depth = Math.max(0, depth - 1);
      hasInnerQuantifier = false;
    } else if (depth > 0 && quantifiers.has(ch)) {
      hasInnerQuantifier = true;
    }
  }
  return false;
}

function matchesFilePattern(name: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`).test(name);
}

interface SearchFileOptions {
  filePath: string;
  rootDir: string;
  regex: RegExp;
  results: string[];
  maxResults: number;
}

async function searchFile(options: SearchFileOptions): Promise<void> {
  if (options.results.length >= options.maxResults) return;

  try {
    const buffer = await readFile(options.filePath);
    if (buffer.subarray(0, BINARY_CHECK_BYTES).includes(0)) return;

    const content = buffer.toString('utf-8');
    const lines = content.split('\n');
    const relPath = path.relative(options.rootDir, options.filePath)
      .split(path.sep).join('/');

    for (let i = 0; i < lines.length; i++) {
      if (options.results.length >= options.maxResults) break;
      if (options.regex.test(lines[i]!)) {
        options.results.push(`${relPath}:${i + 1}:${lines[i]}`);
      }
    }
  } catch {
    // Skip unreadable files
  }
}

interface WalkSearchOptions {
  dir: string;
  rootDir: string;
  regex: RegExp;
  filePattern?: string;
  results: string[];
  maxResults: number;
  signal?: AbortSignal;
}

async function walkAndSearch(options: WalkSearchOptions): Promise<void> {
  if (options.results.length >= options.maxResults) return;
  if (options.signal?.aborted) return;

  let entries;
  try {
    entries = await readdir(options.dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (options.results.length >= options.maxResults) break;
    if (options.signal?.aborted) break;
    const fullPath = path.join(options.dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      await walkAndSearch({ ...options, dir: fullPath });
    } else {
      if (options.filePattern && !matchesFilePattern(entry.name, options.filePattern)) {
        continue;
      }
      await searchFile({
        filePath: fullPath,
        rootDir: options.rootDir,
        regex: options.regex,
        results: options.results,
        maxResults: options.maxResults,
      });
    }
  }
}

export const grepSearchTool = defineTool({
  name: 'grep_search',
  description: `Search file contents using a regex pattern across the project.

Usage notes:
- pattern uses JavaScript regex syntax.
- Searches from the project root by default, or from the specified path.
- Use filePattern to filter by filename (e.g., "*.ts" to search only TypeScript files).
- Default limit is 100 results. Use maxResults to adjust.
- Automatically excludes: node_modules, .git, dist, build, __pycache__, .venv, coverage, .cache, .next
- Results include file path, line number, and matching line content.
- Binary files are automatically skipped.

When to use:
- Finding where a function, variable, or pattern is used
- Searching for specific code patterns across the codebase
- Locating import statements, string literals, or error messages

When NOT to use:
- Finding files by name -- use glob_search instead.`,
  inputSchema,
  defaultPermission: 'allow',
  async execute(input, context) {
    const searchDir = input.path
      ? path.resolve(input.path)
      : context.projectRoot;

    if (!isWithinProjectRoot(searchDir, context.projectRoot)) {
      return { kind: 'error', error: 'Path is outside project root' };
    }

    if (hasNestedQuantifiers(input.pattern)) {
      return { kind: 'error', error: 'Regex rejected: nested quantifiers can cause catastrophic backtracking' };
    }

    let regex: RegExp;
    try {
      regex = new RegExp(input.pattern);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { kind: 'error', error: `Invalid regex: ${msg}` };
    }

    const maxResults = input.maxResults ?? DEFAULT_MAX_RESULTS;
    const results: string[] = [];

    await walkAndSearch({
      dir: searchDir,
      rootDir: context.projectRoot,
      regex,
      filePattern: input.filePattern,
      results,
      maxResults,
      signal: context.signal,
    });

    if (results.length === 0) {
      return { kind: 'success', output: 'No matches found.' };
    }

    const suffix = results.length >= maxResults
      ? `\n(results truncated at ${maxResults})`
      : '';
    return { kind: 'success', output: results.join('\n') + suffix };
  },
});
