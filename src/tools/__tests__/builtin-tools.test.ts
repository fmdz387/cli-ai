/**
 * Unit tests for all 7 built-in tools
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ToolContext } from '../types.js';
import { bashExecuteTool } from '../builtin/bash-execute.js';
import { directoryListTool } from '../builtin/directory-list.js';
import { fileEditTool } from '../builtin/file-edit.js';
import { fileReadTool } from '../builtin/file-read.js';
import { fileWriteTool } from '../builtin/file-write.js';
import { globSearchTool } from '../builtin/glob-search.js';
import { grepSearchTool } from '../builtin/grep-search.js';

let testDir: string;
let ctx: ToolContext;

beforeEach(async () => {
  testDir = path.join(tmpdir(), `cli-ai-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
  ctx = {
    projectRoot: testDir,
    cwd: testDir,
    shell: 'bash',
    signal: new AbortController().signal,
  };
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('file_read', () => {
  it('should read a file', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await writeFile(filePath, 'line1\nline2\nline3');
    const result = await fileReadTool.execute({ filePath }, ctx);
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.output).toContain('line1');
      expect(result.output).toContain('line2');
    }
  });

  it('should reject paths outside project root', async () => {
    const result = await fileReadTool.execute({ filePath: '/etc/passwd' }, ctx);
    expect(result.kind).toBe('error');
  });

  it('should handle missing files', async () => {
    const filePath = path.join(testDir, 'nonexistent.txt');
    const result = await fileReadTool.execute({ filePath }, ctx);
    expect(result.kind).toBe('error');
  });

  it('should reject binary files', async () => {
    const filePath = path.join(testDir, 'bin.dat');
    const buffer = Buffer.alloc(100);
    buffer[50] = 0;
    buffer[0] = 65;
    await writeFile(filePath, buffer);
    const result = await fileReadTool.execute({ filePath }, ctx);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error).toContain('binary');
    }
  });

  it('should read with line range', async () => {
    const filePath = path.join(testDir, 'lines.txt');
    await writeFile(filePath, 'a\nb\nc\nd\ne');
    const result = await fileReadTool.execute(
      { filePath, startLine: 2, endLine: 4 },
      ctx,
    );
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.output).toContain('b');
      expect(result.output).toContain('d');
    }
  });
});

describe('file_write', () => {
  it('should write a file', async () => {
    const filePath = path.join(testDir, 'output.txt');
    const result = await fileWriteTool.execute(
      { filePath, content: 'hello world' },
      ctx,
    );
    expect(result.kind).toBe('success');
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('hello world');
  });

  it('should reject paths outside project root', async () => {
    const result = await fileWriteTool.execute(
      { filePath: '/tmp/outside.txt', content: 'test' },
      ctx,
    );
    expect(result.kind).toBe('error');
  });

  it('should reject .env files', async () => {
    const filePath = path.join(testDir, '.env');
    const result = await fileWriteTool.execute(
      { filePath, content: 'SECRET=x' },
      ctx,
    );
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error).toContain('.env');
    }
  });

  it('should create parent directories', async () => {
    const filePath = path.join(testDir, 'deep', 'nested', 'file.txt');
    const result = await fileWriteTool.execute(
      { filePath, content: 'nested' },
      ctx,
    );
    expect(result.kind).toBe('success');
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('nested');
  });
});

describe('file_edit', () => {
  it('should replace unique occurrence', async () => {
    const filePath = path.join(testDir, 'edit.txt');
    await writeFile(filePath, 'hello world');
    const result = await fileEditTool.execute(
      { filePath, oldString: 'world', newString: 'earth' },
      ctx,
    );
    expect(result.kind).toBe('success');
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('hello earth');
  });

  it('should error when oldString not found', async () => {
    const filePath = path.join(testDir, 'edit2.txt');
    await writeFile(filePath, 'hello world');
    const result = await fileEditTool.execute(
      { filePath, oldString: 'xyz', newString: 'abc' },
      ctx,
    );
    expect(result.kind).toBe('error');
  });

  it('should error when oldString appears multiple times', async () => {
    const filePath = path.join(testDir, 'edit3.txt');
    await writeFile(filePath, 'aa bb aa');
    const result = await fileEditTool.execute(
      { filePath, oldString: 'aa', newString: 'cc' },
      ctx,
    );
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error).toContain('2');
    }
  });
});

describe('bash_execute', () => {
  it('should run a simple command', async () => {
    const result = await bashExecuteTool.execute({ command: 'echo hello' }, ctx);
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.output).toContain('hello');
    }
  });

  it('should include exit code in output', async () => {
    const result = await bashExecuteTool.execute({ command: 'echo ok' }, ctx);
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.output).toContain('[exit code: 0]');
    }
  });
});

describe('glob_search', () => {
  it('should find files by pattern', async () => {
    await writeFile(path.join(testDir, 'a.ts'), '');
    await writeFile(path.join(testDir, 'b.ts'), '');
    await writeFile(path.join(testDir, 'c.js'), '');
    const result = await globSearchTool.execute({ pattern: '*.ts' }, ctx);
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.output).toContain('a.ts');
      expect(result.output).toContain('b.ts');
      expect(result.output).not.toContain('c.js');
    }
  });
});

describe('grep_search', () => {
  it('should find content in files', async () => {
    await writeFile(path.join(testDir, 'search.txt'), 'foo bar baz\nhello world');
    const result = await grepSearchTool.execute({ pattern: 'hello' }, ctx);
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.output).toContain('search.txt');
      expect(result.output).toContain('hello world');
    }
  });
});

describe('directory_list', () => {
  it('should list directory contents', async () => {
    await writeFile(path.join(testDir, 'file1.txt'), 'content');
    await mkdir(path.join(testDir, 'subdir'));
    const result = await directoryListTool.execute({ dirPath: testDir }, ctx);
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.output).toContain('file1.txt');
      expect(result.output).toContain('subdir');
    }
  });

  it('should reject paths outside project root', async () => {
    const result = await directoryListTool.execute({ dirPath: '/etc' }, ctx);
    expect(result.kind).toBe('error');
  });
});
