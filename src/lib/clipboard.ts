/**
 * Cross-platform clipboard operations
 */
import type { ClipboardResult, Result } from '../types/index.js';

import clipboard from 'clipboardy';

/**
 * Copies text to the system clipboard
 */
export async function copyToClipboard(text: string): Promise<Result<ClipboardResult>> {
  try {
    await clipboard.write(text);
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
    const text = await clipboard.read();
    return { success: true, data: text };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Failed to read from clipboard'),
    };
  }
}
