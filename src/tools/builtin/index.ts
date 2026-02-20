/**
 * Barrel file for all built-in tools
 */

import type { ToolRegistry } from '../registry.js';
import type { ToolDefinition } from '../types.js';

import { bashExecuteTool } from './bash-execute.js';
import { directoryListTool } from './directory-list.js';
import { fileEditTool } from './file-edit.js';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { globSearchTool } from './glob-search.js';
import { grepSearchTool } from './grep-search.js';

export const builtinTools: ToolDefinition[] = [
  fileReadTool,
  bashExecuteTool,
  globSearchTool,
  grepSearchTool,
  directoryListTool,
  fileWriteTool,
  fileEditTool,
];

export function registerBuiltinTools(registry: ToolRegistry): void {
  for (const tool of builtinTools) {
    registry.register(tool);
  }
}

export {
  bashExecuteTool,
  directoryListTool,
  fileEditTool,
  fileReadTool,
  fileWriteTool,
  globSearchTool,
  grepSearchTool,
};
