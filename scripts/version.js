#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;

const FILES = [
  {
    path: join(ROOT_DIR, 'package.json'),
    update: (content, version) => {
      const pkg = JSON.parse(content);
      pkg.version = version;
      return JSON.stringify(pkg, null, 2) + '\n';
    },
  },
  {
    path: join(ROOT_DIR, 'src', 'constants.ts'),
    update: (content, version) =>
      content.replace(/export const VERSION = '[^']+';/, `export const VERSION = '${version}';`),
  },
];

function main() {
  const version = process.argv[2];

  if (!version) {
    console.error('Usage: node scripts/version.js <version>');
    console.error('Example: node scripts/version.js 1.0.0');
    process.exit(1);
  }

  if (!SEMVER_REGEX.test(version)) {
    console.error(`Invalid semver version: ${version}`);
    process.exit(1);
  }

  for (const file of FILES) {
    const content = readFileSync(file.path, 'utf8');
    const updated = file.update(content, version);
    writeFileSync(file.path, updated);
    console.log(`Updated ${file.path}`);
  }

  console.log(`Version updated to ${version}`);
}

main();
