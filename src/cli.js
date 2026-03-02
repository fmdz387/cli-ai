#!/usr/bin/env node

// CRITICAL: Set production mode BEFORE any imports
// This switches react-reconciler from dev build (19,736 lines) to prod build (11,594 lines)
// Saves ~200-400ms startup time and reduces runtime overhead
process.env.NODE_ENV = 'production';

// ── Node.js version gate ────────────────────────────────────────────────
// Runs before any imports or modern API usage so the error message is
// always reachable. Uses only APIs available since Node 0.x (process.versions,
// parseInt, console, process.exit) so it works on ANY Node version that
// can parse ESM (>= 12). Cross-platform — no OS-specific code.
const MIN_NODE_MAJOR = 20;
const nodeVersion = process.versions.node;
const nodeMajor = parseInt(nodeVersion.split('.')[0], 10);
if (Number.isNaN(nodeMajor) || nodeMajor < MIN_NODE_MAJOR) {
  console.error(
    '\n  CLI AI requires Node.js >= ' + MIN_NODE_MAJOR + '.0.0' +
    '\n  Current version: ' + (nodeVersion || 'unknown') +
    '\n' +
    '\n  Install the latest LTS: https://nodejs.org\n',
  );
  process.exit(1);
}

// Fast-path: handle --help and --version before loading ANY dependencies
// These flags should respond instantly, not after 60-120s of import resolution
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
CLI AI v3 - Natural language to shell commands

Usage:
  s              Start interactive session
  cli-ai         Start interactive session

Options:
  --help, -h     Show this help message
  --version, -v  Show version number

Session Controls:
  [1] Execute    Run the generated command
  [2] Copy       Copy command to clipboard
  [3] Edit       Edit the command
  [4] Alternatives   Show alternative commands
  [5] Cancel     Cancel and start new query
  [?] Explain    Get explanation of the command
  [O] Toggle     Toggle output expansion
  Arrow keys     Navigate menu options
  Enter          Select focused option
  Escape         Cancel current action
  exit, quit     Exit the session
  Ctrl+D         Exit (empty input)
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  // Read version from package.json to avoid hardcoding
  // This is a single synchronous read -- acceptable for a flag that exits immediately
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    console.log(`CLI AI v${pkg.version}`);
  } catch {
    console.log('CLI AI v3');
  }
  process.exit(0);
}

// Suppress experimental warnings for JSON imports from dependencies
const originalEmit = process.emit;
process.emit = function (name, data) {
  if (name === 'warning' && data && data.name === 'ExperimentalWarning') {
    return false;
  }
  return originalEmit.apply(process, arguments);
};

// Import and run the main module
import('./index.js');
