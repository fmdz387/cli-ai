/**
 * Path validation utilities for tool security
 */

import path from 'node:path';

interface ProjectRootOptions {
  bypass?: boolean;
}

/**
 * Check if a resolved path is within the project root.
 * Uses case-insensitive comparison on Windows and macOS.
 */
export function isWithinProjectRoot(
  resolvedPath: string,
  projectRoot: string,
  options?: ProjectRootOptions,
): boolean {
  if (options?.bypass) {
    return true;
  }

  const relative = path.relative(projectRoot, resolvedPath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return false;
  }

  if (process.platform === 'win32' || process.platform === 'darwin') {
    const normalizedPath = resolvedPath.toLowerCase();
    const normalizedRoot = projectRoot.toLowerCase();
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot + path.sep);
  }

  return resolvedPath === projectRoot || resolvedPath.startsWith(projectRoot + path.sep);
}
