# Local Development Setup

Guide for setting up, testing, and running cli-ai during development.

## Prerequisites

- **Node.js**: v20 or higher
- **pnpm**: v10.10.0+ (specified in `packageManager`)
- **Git**: For version control

### Installing pnpm

```bash
# Using npm
npm install -g pnpm

# Using corepack (recommended)
corepack enable
corepack prepare pnpm@10.10.0 --activate
```

## Initial Setup

### 1. Clone and Install

```bash
git clone https://github.com/fmdz387/cli-ai.git
cd cli-ai
pnpm install
```

### 2. Configure API Key

The application requires an Anthropic API key stored securely via keytar:

```bash
# After building, run the CLI to configure
pnpm build
node dist/cli.js --setup  # Follow prompts to add API key
```

Alternatively, set the environment variable for development:

```bash
# Windows PowerShell
$env:ANTHROPIC_API_KEY = "your-api-key"

# Windows CMD
set ANTHROPIC_API_KEY=your-api-key

# Linux/macOS
export ANTHROPIC_API_KEY="your-api-key"
```

## Running `s` and `cli-ai` Commands

This is the main setup to make the CLI commands available in your terminal.

### Option 1: Global Link (Recommended for Development)

This registers the `s` and `cli-ai` commands globally so you can use them from any directory:

```bash
# Build and link globally in one step
pnpm link:global
```

Now you can run from any terminal:

```bash
s "find large files"
cli-ai "list running processes"
```

To remove the global link:

```bash
pnpm unlink:global
```

### Option 2: Run Directly with Node

If you don't want to link globally, run the CLI directly:

```bash
# First build
pnpm build

# Then run with node
node dist/cli.js "your prompt here"
```

### Option 3: Use npm link (Alternative)

```bash
pnpm build
npm link

# Now s and cli-ai are available globally
s "show disk usage"
```

To unlink:

```bash
npm unlink -g @fmdz387/cli-ai
```

### Verify Installation

Check that the commands are available:

```bash
# Check if s command exists
which s        # Linux/macOS
where s        # Windows CMD
Get-Command s  # PowerShell

# Test the command
s --help
```

## Development Workflow

### Running in Development Mode

```bash
# Watch mode - rebuilds on file changes
pnpm dev
```

This uses `tsup --watch` to continuously rebuild on source changes.

**Tip**: Run `pnpm dev` in one terminal, and test your changes with `s` or `cli-ai` in another terminal. Changes are rebuilt automatically.

### Building for Production

```bash
pnpm build
```

Output is generated in the `dist/` directory.

### Quick Development Cycle

```bash
# Terminal 1: Start watch mode
pnpm dev

# Terminal 2: Link globally once, then test changes
pnpm link:global
s "your test prompt"

# After making code changes, just re-run s - it uses the rebuilt dist/
s "another test"
```

## Testing

### Run Tests

```bash
# Run all tests once
pnpm test

# Watch mode for TDD
pnpm test:watch
```

Tests use [Vitest](https://vitest.dev/) - a fast Vite-native testing framework.

### Writing Tests

Place test files in:
- `src/**/*.test.ts` - Unit tests alongside source
- `src/**/*.spec.ts` - Alternative naming

Example test:

```typescript
import { describe, it, expect } from 'vitest'
import { yourFunction } from './your-module'

describe('yourFunction', () => {
  it('should handle basic input', () => {
    expect(yourFunction('input')).toBe('expected')
  })
})
```

## Code Quality

### Linting

```bash
# Check for issues
pnpm lint

# ESLint covers .ts and .tsx files in src/
```

### Formatting

```bash
# Format all source files
pnpm format
```

Uses Prettier with import sorting via `@trivago/prettier-plugin-sort-imports`.

### Type Checking

```bash
# Run TypeScript type checking
pnpm typecheck
```

## Project Structure

```
cli-ai/
├── src/
│   ├── index.ts          # Library entry point
│   ├── cli.ts            # CLI entry point
│   ├── app.tsx           # Main Ink application
│   ├── components/       # React/Ink UI components
│   └── lib/              # Core utilities
│       ├── config.ts     # Configuration management
│       ├── shell.ts      # Shell detection & execution
│       ├── clipboard.ts  # Cross-platform clipboard
│       └── api.ts        # Claude API integration
├── dist/                 # Build output
├── docs/                 # Documentation
└── package.json
```

## Configuration

User configuration is stored at `~/.cli_ai_assistant/config.json`.

For development, you can create a test config:

```json
{
  "model": "claude-sonnet-4-5-20250929",
  "simpleMode": false,
  "safetyLevel": "medium",
  "showExplanations": true,
  "maxAlternatives": 3
}
```

## Debugging

### VS Code Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CLI",
      "program": "${workspaceFolder}/dist/cli.js",
      "args": ["your test prompt"],
      "preLaunchTask": "pnpm: build",
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

### Debug Logging

Add debug output using standard console methods - they work with Ink:

```typescript
console.error('Debug info:', variable)  // stderr, won't break UI
```

## Common Issues

### Windows: Native Module Errors (keytar)

```bash
# Install build tools
npm install -g windows-build-tools

# Or install Visual Studio Build Tools manually
```

### Git Bash: Simple Mode Auto-Enabled

Git Bash/MSYS2 defaults to simple mode due to terminal limitations. Override in config:

```json
{
  "simpleMode": false
}
```

### WSL: Clipboard Issues

Ensure `clip.exe` is accessible from WSL path.

## Useful Development Tips

1. **Fast iteration**: Use `pnpm dev` in one terminal, test in another
2. **Global linking**: Use `pnpm link:global` to test as installed CLI
3. **Type safety**: Run `pnpm typecheck` before committing
4. **Clean builds**: Delete `dist/` if you encounter stale build issues

## Dependencies Overview

| Package | Purpose |
|---------|---------|
| `ink` | React-based CLI rendering |
| `@inkjs/ui` | Pre-built Ink components |
| `@anthropic-ai/sdk` | Claude API client |
| `keytar` | Secure credential storage |
| `clipboardy` | Cross-platform clipboard |
| `execa` | Shell command execution |
| `conf` | Configuration management |
| `zod` | Runtime type validation |
| `chalk` | Terminal styling |
