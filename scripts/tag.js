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

function getPackageTag() {
  const pkgPath = join(ROOT_DIR, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return `v${pkg.version}`;
}

function tagExists(tag) {
  const result = git(`tag -l ${tag}`, { silent: true });
  return result && result.trim() === tag;
}

function remoteTagExists(tag) {
  const result = git(`ls-remote --tags origin refs/tags/${tag}`, { silent: true, ignoreError: true });
  return result && result.includes(tag);
}

function createTag(tag, autoRepush = false) {
  const version = tag.slice(1);

  // Check if tag already exists
  const localExists = tagExists(tag);
  const remoteExists = remoteTagExists(tag);

  if (localExists || remoteExists) {
    if (autoRepush) {
      console.log(`Tag ${tag} already exists, re-pushing...`);
      return repushTag(tag);
    }
    console.error(`\n✗ Tag ${tag} already exists${localExists ? ' locally' : ''}${remoteExists ? (localExists ? ' and' : '') + ' on remote' : ''}`);
    console.error(`\nTo overwrite, run: pnpm tag --force ${tag}`);
    process.exit(1);
  }

  console.log(`Creating tag ${tag}...`);
  git(`tag -a ${tag} -m "Release ${version}"`);
  console.log(`✓ Tag ${tag} created locally`);

  console.log(`Pushing tag ${tag} to origin...`);
  git(`push origin refs/tags/${tag}`);
  console.log(`✓ Tag ${tag} pushed to origin`);

  return tag;
}

function repushTag(tag) {
  console.log(`Re-pushing tag ${tag}...`);

  console.log(`Deleting local tag ${tag}...`);
  git(`tag -d ${tag}`, { ignoreError: true, silent: true });
  console.log(`✓ Local tag deleted (or didn't exist)`);

  console.log(`Deleting remote tag ${tag}...`);
  git(`push origin --delete refs/tags/${tag}`, { ignoreError: true, silent: true });
  console.log(`✓ Remote tag deleted (or didn't exist)`);

  return createTag(tag);
}

function showUsage() {
  console.log(`
Usage: node scripts/tag.js [options] [tag]

Creates and pushes a git tag for the specified version.
If no tag is provided, uses the version from package.json.

Options:
  --repush, --force    Delete existing tag (local & remote) before creating
  --help, -h           Show this help message

Examples:
  node scripts/tag.js              # Tag current package.json version
  node scripts/tag.js v3.0.5       # Tag specific version
  node scripts/tag.js --repush     # Re-push current version tag
  node scripts/tag.js --force v3.0.5  # Re-push specific version tag
`);
}

function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let repush = false;
  let tag = null;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      showUsage();
      process.exit(0);
    } else if (arg === '--repush' || arg === '--force') {
      repush = true;
    } else if (!arg.startsWith('-')) {
      tag = arg;
    }
  }

  // Use package.json version if not specified
  if (!tag) {
    tag = getPackageTag();
  }

  // Validate tag format (vX.X.X with optional prerelease/build metadata)
  if (!/^v\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(tag)) {
    console.error(`Invalid tag format: ${tag}`);
    console.error(`Expected format: vX.X.X (e.g., v3.0.5)`);
    process.exit(1);
  }

  console.log(`\nTag: ${tag}`);
  console.log(`Mode: ${repush ? 're-push (delete + create)' : 'create new'}\n`);

  try {
    const result = repush ? repushTag(tag) : createTag(tag);
    console.log(`\n✓ Successfully ${repush ? 're-pushed' : 'created'} tag ${result}`);
  } catch (error) {
    console.error(`\n✗ Failed to ${repush ? 're-push' : 'create'} tag:`, error.message);
    process.exit(1);
  }
}

main();
