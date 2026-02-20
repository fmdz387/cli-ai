/**
 * Tests for instruction file discovery
 */
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { discoverInstructions } from '../instructions.js';

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cli-ai-test-'));
  tempDirs.push(dir);
  return dir;
}

afterAll(async () => {
  for (const dir of tempDirs) {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
});

describe('discoverInstructions', () => {
  it('returns empty array when no instruction files exist', async () => {
    const tempDir = await createTempDir();
    const result = await discoverInstructions(tempDir);
    expect(result).toEqual([]);
  });

  it('handles permission errors gracefully', async () => {
    const result = await discoverInstructions('/nonexistent/path/that/does/not/exist');
    expect(Array.isArray(result)).toBe(true);
  });
});
