/**
 * CLI AI v3 - Entry point
 * Natural language to shell commands with persistent REPL session
 */

import { render } from 'ink';
import { createInterface } from 'node:readline';

import { App } from './app.js';
import { VERSION } from './constants.js';
import { createSessionContext, generateCommand } from './lib/ai-client.js';
import { detectShell } from './lib/platform.js';

const CLEAR_SCREEN = '\x1bc';
const SET_TITLE = '\x1b]0;CLI AI\x07';

/**
 * Reads all input from stdin (for piped input)
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on('line', (line) => {
      data += line + '\n';
    });

    rl.on('close', () => {
      resolve(data.trim());
    });
  });
}

/**
 * Handles piped input mode (non-interactive)
 */
async function handlePipedInput(): Promise<void> {
  const query = await readStdin();

  if (!query) {
    console.error('Error: No input provided');
    process.exit(1);
  }

  const shell = detectShell();
  const context = createSessionContext(shell);
  const result = await generateCommand(query, context);

  if (result.success) {
    // Output just the command for easy piping
    console.log(result.data.command);
    process.exit(0);
  } else {
    console.error('Error:', result.error.message);
    process.exit(1);
  }
}

/**
 * Handles --help flag
 */
function showHelp(): void {
  console.log(`
CLI AI v${VERSION} - Natural language to shell commands

Usage:
  s                     Start interactive session
  s [query]            Generate command for query (non-interactive)
  echo "query" | s     Pipe query to CLI AI

Options:
  --help, -h           Show this help message
  --version, -v        Show version number

Interactive Commands:
  [1] Execute          Run the generated command
  [2] Copy             Copy command to clipboard
  [3] Edit             Edit the command
  [4] Alternatives     Show alternative commands
  [5] Cancel           Cancel and start new query
  [?] Explain          Get explanation of the command
  [O] Toggle           Toggle output expansion
  ↑↓ Arrow keys        Navigate menu options
  Enter                Select focused option
  Escape               Cancel
  exit, quit           Exit the session
  Ctrl+D               Exit (empty input)

Examples:
  s "list all files modified today"
  s "find large files over 100MB"
  echo "show git status" | s
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle --help
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Handle --version
  if (args.includes('--version') || args.includes('-v')) {
    console.log(`CLI AI v${VERSION}`);
    process.exit(0);
  }

  // Check if input is piped (non-TTY stdin)
  if (!process.stdin.isTTY) {
    await handlePipedInput();
    return;
  }

  // Check for command-line query argument
  if (args.length > 0) {
    const query = args.join(' ');
    const shell = detectShell();
    const context = createSessionContext(shell);
    const result = await generateCommand(query, context);

    if (result.success) {
      console.log(result.data.command);
      process.exit(0);
    } else {
      console.error('Error:', result.error.message);
      process.exit(1);
    }
    return;
  }

  process.stdout.write(CLEAR_SCREEN + SET_TITLE);

  const { waitUntilExit } = render(<App />);

  // Handle process signals
  process.on('SIGINT', () => {
    // Let the app handle Ctrl+C internally
  });

  process.on('SIGTERM', () => {
    process.exit(0);
  });

  await waitUntilExit();
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
