/**
 * CLI AI v3 - Entry point
 * Natural language to shell commands with persistent REPL session
 */
import { App } from './app.js';
import { VERSION } from './constants.js';

import { render } from 'ink';

const CLEAR_SCREEN = '\x1bc';
const SET_TITLE = '\x1b]0;CLI AI\x07';

/**
 * Handles --help flag
 */
function showHelp(): void {
  console.log(`
CLI AI v${VERSION} - Natural language to shell commands

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

  // Start interactive session
  process.stdout.write(CLEAR_SCREEN + SET_TITLE);

  const { waitUntilExit } = render(<App />, {
    // Enable incremental rendering to reduce flickering - only updates changed lines
    incrementalRendering: true,
  });

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
