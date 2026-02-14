/**
 * Cross-platform clipboard operations
 */
import type { ClipboardResult, Result } from '../types/index.js';

/**
 * Lazily loads clipboardy on first use.
 * Clipboard is only needed when user explicitly presses [2] Copy.
 * The top-level import was adding ~100ms to startup for a feature used <5% of sessions.
 */
async function getClipboard(): Promise<typeof import('clipboardy')> {
  return import('clipboardy');
}

/**
 * Copies text to the system clipboard
 */
export async function copyToClipboard(text: string): Promise<Result<ClipboardResult>> {
  try {
    const clipboard = await getClipboard();
    await clipboard.default.write(text);
    return {
      success: true,
      data: {
        success: true,
        message: 'Copied to clipboard',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Failed to copy to clipboard'),
    };
  }
}

/**
 * Reads text from the system clipboard
 */
export async function readFromClipboard(): Promise<Result<string>> {
  try {
    const clipboard = await getClipboard();
    const text = await clipboard.default.read();
    return { success: true, data: text };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Failed to read from clipboard'),
    };
  }
}
