#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

function git(args, options = {}) {
  const cmd = `git ${args}`;
  try {
    return execSync(cmd, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
  } catch (error) {
    if (options.ignoreError) return null;
    throw error;
  }
}

function getPackageVersion() {
  const pkgPath = join(ROOT_DIR, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

function createTag(version) {
  const tag = `v${version}`;
  console.log(`Creating tag ${tag}...`);

  git(`tag -a ${tag} -m "Release ${version}"`);
  console.log(`✓ Tag ${tag} created locally`);

  console.log(`Pushing tag ${tag} to origin...`);
  git(`push origin ${tag}`);
  console.log(`✓ Tag ${tag} pushed to origin`);

  return tag;
}

function repushTag(version) {
  const tag = `v${version}`;
  console.log(`Re-pushing tag ${tag}...`);

  console.log(`Deleting local tag ${tag}...`);
  git(`tag -d ${tag}`, { ignoreError: true, silent: true });
  console.log(`✓ Local tag deleted (or didn't exist)`);

  console.log(`Deleting remote tag ${tag}...`);
  git(`push origin --delete ${tag}`, { ignoreError: true, silent: true });
  console.log(`✓ Remote tag deleted (or didn't exist)`);

  return createTag(version);
}

function showUsage() {
  console.log(`
Usage: node scripts/tag.js [options] [version]

Creates and pushes a git tag for the specified version.
If no version is provided, uses the version from package.json.

Options:
  --repush, --force    Delete existing tag (local & remote) before creating
  --help, -h           Show this help message

Examples:
  node scripts/tag.js              # Tag current package.json version
  node scripts/tag.js 3.0.5        # Tag specific version
  node scripts/tag.js --repush     # Re-push current version tag
  node scripts/tag.js --force 3.0.5  # Re-push specific version tag
`);
}

function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let repush = false;
  let version = null;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      showUsage();
      process.exit(0);
    } else if (arg === '--repush' || arg === '--force') {
      repush = true;
    } else if (!arg.startsWith('-')) {
      version = arg;
    }
  }

  // Use package.json version if not specified
  if (!version) {
    version = getPackageVersion();
  }

  // Validate version format
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(version)) {
    console.error(`Invalid version format: ${version}`);
    process.exit(1);
  }

  console.log(`\nVersion: ${version}`);
  console.log(`Mode: ${repush ? 're-push (delete + create)' : 'create new'}\n`);

  try {
    const tag = repush ? repushTag(version) : createTag(version);
    console.log(`\n✓ Successfully ${repush ? 're-pushed' : 'created'} tag ${tag}`);
  } catch (error) {
    console.error(`\n✗ Failed to ${repush ? 're-push' : 'create'} tag:`, error.message);
    process.exit(1);
  }
}

main();
