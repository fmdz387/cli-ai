/**
 * CLI AI v3 - Entry point
 * Natural language to shell commands with persistent REPL session
 */
import { App } from './app.js';

import { render } from 'ink';

const CLEAR_SCREEN = '\x1bc';
const SET_TITLE = '\x1b]0;CLI AI\x07';

/**
 * Main entry point
 */
async function main(): Promise<void> {
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
