#!/usr/bin/env node

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
