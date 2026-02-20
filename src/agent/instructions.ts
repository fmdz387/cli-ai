/**
 * Instruction file discovery for AGENTS.md and CLAUDE.md files
 */

import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const INSTRUCTION_FILENAMES = ['AGENTS.md', 'CLAUDE.md'];

/**
 * Discover instruction files by walking up from cwd to the filesystem root
 * or a directory containing .git, then also checking global config.
 */
export async function discoverInstructions(cwd: string): Promise<string[]> {
  const seen = new Set<string>();
  const results: string[] = [];

  // Walk up from cwd
  let current = path.resolve(cwd);
  const root = path.parse(current).root;
  let searching = true;

  while (searching) {
    for (const filename of INSTRUCTION_FILENAMES) {
      const filePath = path.join(current, filename);
      await tryReadInstruction(filePath, seen, results);
    }

    // Stop if we found a .git directory
    if (await directoryExists(path.join(current, '.git'))) {
      searching = false;
    } else {
      const parent = path.dirname(current);
      if (parent === current || current === root) {
        searching = false;
      } else {
        current = parent;
      }
    }
  }

  // Check global config directory
  const globalDir = path.join(os.homedir(), '.cli_ai_assistant');
  for (const filename of INSTRUCTION_FILENAMES) {
    const filePath = path.join(globalDir, filename);
    await tryReadInstruction(filePath, seen, results);
  }

  return results;
}

async function tryReadInstruction(
  filePath: string,
  seen: Set<string>,
  results: string[],
): Promise<void> {
  try {
    const resolved = path.resolve(filePath);
    if (seen.has(resolved)) return;
    seen.add(resolved);

    const content = await readFile(resolved, 'utf-8');
    if (content.trim()) {
      results.push(`Instructions from ${resolved}:\n${content}`);
    }
  } catch {
    // Skip unreadable files (permission denied, not found, etc.)
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
