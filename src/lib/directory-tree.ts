/**
 * Smart-filtered directory tree builder for AI context
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Directories to ignore when building the tree
 */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
  'coverage',
  '.cache',
  '.npm',
  '.yarn',
  '.pnpm',
  '.turbo',
  '.nuxt',
  '.output',
  'target',
  'vendor',
  '.angular',
  '.svelte-kit',
]);

/**
 * Files to ignore when building the tree
 */
const IGNORED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.gitignore',
  '.npmrc',
  '.yarnrc',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
]);

/**
 * Maximum depth for directory traversal
 */
const MAX_DEPTH = 3;

/**
 * Maximum entries per directory level
 */
const MAX_ENTRIES_PER_LEVEL = 20;

interface TreeEntry {
  name: string;
  isDirectory: boolean;
  children?: TreeEntry[];
}

function buildTree(dirPath: string, depth: number = 0): TreeEntry[] {
  if (depth >= MAX_DEPTH) {
    return [];
  }

  try {
    const entries = readdirSync(dirPath);
    const result: TreeEntry[] = [];
    let count = 0;

    for (const entry of entries) {
      if (count >= MAX_ENTRIES_PER_LEVEL) {
        result.push({ name: `... (${entries.length - count} more)`, isDirectory: false });
        break;
      }

      if (entry.startsWith('.') && !entry.startsWith('.env')) {
        continue;
      }

      if (IGNORED_FILES.has(entry)) {
        continue;
      }

      const fullPath = join(dirPath, entry);

      try {
        const stats = statSync(fullPath);

        if (stats.isDirectory()) {
          if (IGNORED_DIRS.has(entry)) {
            continue;
          }

          const children = buildTree(fullPath, depth + 1);
          result.push({
            name: entry,
            isDirectory: true,
            children: children.length > 0 ? children : undefined,
          });
        } else {
          result.push({
            name: entry,
            isDirectory: false,
          });
        }

        count++;
      } catch {
        continue;
      }
    }

    return result;
  } catch {
    return [];
  }
}

function formatTree(entries: TreeEntry[], prefix: string = ''): string {
  const lines: string[] = [];

  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    if (entry.isDirectory) {
      lines.push(`${prefix}${connector}${entry.name}/`);
      if (entry.children && entry.children.length > 0) {
        lines.push(formatTree(entry.children, `${prefix}${childPrefix}`));
      }
    } else {
      lines.push(`${prefix}${connector}${entry.name}`);
    }
  });

  return lines.join('\n');
}

export function generateDirectoryTree(rootDir: string): string {
  const tree = buildTree(rootDir);

  if (tree.length === 0) {
    return '(empty or inaccessible directory)';
  }

  const dirName = relative(process.cwd(), rootDir) || '.';
  return `${dirName}/\n${formatTree(tree)}`;
}

export function getDirectorySummary(rootDir: string): string {
  try {
    const entries = readdirSync(rootDir);
    const dirs = entries.filter((e) => {
      if (IGNORED_DIRS.has(e) || e.startsWith('.')) return false;
      try {
        return statSync(join(rootDir, e)).isDirectory();
      } catch {
        return false;
      }
    });

    const files = entries.filter((e) => {
      if (IGNORED_FILES.has(e) || e.startsWith('.')) return false;
      try {
        return statSync(join(rootDir, e)).isFile();
      } catch {
        return false;
      }
    });

    return `Directory contains ${dirs.length} folders and ${files.length} files`;
  } catch {
    return '(unable to read directory)';
  }
}
