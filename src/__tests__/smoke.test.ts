/**
 * Smoke tests for CLI AI
 * Basic sanity checks that the package exports and utilities work
 */
import { VERSION, APP_NAME, DEFAULT_MODEL } from '../constants.js';
import { generateDirectoryTree } from '../lib/directory-tree.js';
import { detectShell } from '../lib/platform.js';
import { assessCommandRisk } from '../lib/risk-assessment.js';

import { describe, expect, it } from 'vitest';

describe('Constants', () => {
  it('should export VERSION', () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should export APP_NAME', () => {
    expect(APP_NAME).toBe('CLI AI');
  });

  it('should export DEFAULT_MODEL', () => {
    expect(DEFAULT_MODEL).toBeDefined();
    expect(DEFAULT_MODEL).toContain('claude');
  });
});

describe('Platform Detection', () => {
  it('should detect a valid shell type', () => {
    const shell = detectShell();
    expect(['bash', 'zsh', 'fish', 'powershell', 'pwsh', 'cmd']).toContain(shell);
  });
});

describe('Risk Assessment', () => {
  it('should assess safe commands as low risk', () => {
    expect(assessCommandRisk('ls -la')).toBe('low');
    expect(assessCommandRisk('pwd')).toBe('low');
    expect(assessCommandRisk('cat file.txt')).toBe('low');
  });

  it('should assess write operations as medium risk', () => {
    expect(assessCommandRisk('npm install express')).toBe('medium');
    expect(assessCommandRisk('mv file.txt backup/')).toBe('medium');
  });

  it('should assess dangerous commands as high risk', () => {
    expect(assessCommandRisk('rm -rf /')).toBe('high');
    expect(assessCommandRisk('sudo rm -rf /tmp')).toBe('high');
    expect(assessCommandRisk('chmod 777 /etc/passwd')).toBe('high');
  });
});

describe('Directory Tree', () => {
  it('should generate a directory tree string', () => {
    const tree = generateDirectoryTree(process.cwd());
    expect(typeof tree).toBe('string');
    expect(tree.length).toBeGreaterThan(0);
  });

  it('should not include node_modules in tree', () => {
    const tree = generateDirectoryTree(process.cwd());
    expect(tree).not.toContain('node_modules');
  });
});
