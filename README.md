# CLI AI

[![npm version](https://img.shields.io/npm/v/@fmdz387/cli-ai)](https://www.npmjs.com/package/@fmdz387/cli-ai)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

**A lightweight, safe and fast CLI tool that translates natural language to shell commands. Powered by the Anthropic Claude AI models.**

Describe what you want in plain English. Get the right command for your shell. Review, execute, or copy.

![CLI AI Demo](assets/cli-ai.png)

## Highlights

- **Cross-platform** - Works on Windows (PowerShell, CMD, Git Bash), macOS, and Linux
- **Shell-aware** - Generates commands specific to your detected shell
- **Interactive** - Execute, copy, edit, or request alternatives
- **Secure** - API keys stored in system keyring, never in plain text
- **Risk assessment** - Color-coded risk levels for every command

## Quick Start

### 1. Install

```bash
npm install -g @fmdz387/cli-ai
```

### 2. Run

```bash
s
```

On first run, you'll be prompted for your [Anthropic API key](https://console.anthropic.com/settings/keys).

### 3. Use

Type what you want in natural language:

```
> find files larger than 100MB

$ find . -size +100M -type f
Risk: low

[E] Execute  [C] Copy  [A] Alternatives  [?] Explain
```

## Usage

| Command | Description |
|---------|-------------|
| `s` | Start interactive session |
| `s "your request"` | One-shot mode (outputs command directly) |
| `echo "request" \| s` | Piped input |
| `s --help` | Show help |

### Interactive Controls

| Key | Action |
|-----|--------|
| `E` | Execute command |
| `C` | Copy to clipboard |
| `A` | Get alternatives |
| `?` | Explain command |
| `Esc` | Cancel |
| `Ctrl+C` | Exit |

## Requirements

- **Node.js 20+**
- **Build tools** for native module compilation:

| Platform | Command |
|----------|---------|
| Windows | `npm install -g windows-build-tools` (as Admin) |
| macOS | `xcode-select --install` |
| Ubuntu/Debian | `sudo apt-get install build-essential libsecret-1-dev` |
| Fedora | `sudo dnf install gcc-c++ libsecret-devel` |
| Arch | `sudo pacman -S base-devel libsecret` |

## API Key Storage

Your API key is stored securely:

| Platform | Storage |
|----------|---------|
| macOS | Keychain |
| Windows | Credential Manager |
| Linux | Secret Service (GNOME Keyring, KWallet) |

Fallback: encrypted file at `~/.cli_ai_assistant/`

Alternative: set via environment variable:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Risk Assessment

| Level | Meaning |
|-------|---------|
| **Low** (green) | Read-only, safe commands |
| **Medium** (yellow) | Modifies files or system state |
| **High** (red) | Potentially destructive or irreversible |

High-risk patterns: `rm -rf`, `sudo rm`, `chmod 777`, `mkfs`, `dd`, `DROP TABLE`, `curl | bash`

## Configuration

Default model: `claude-sonnet-4-5-20250929`

Override with:
```bash
export AI_MODEL="claude-sonnet-4-5-20250929"
```

Config location: `~/.cli_ai_assistant/`

## Development

```bash
git clone https://github.com/fmdz387/cli-ai.git
cd cli-ai
pnpm install
pnpm dev        # Watch mode
pnpm build      # Production build
pnpm typecheck  # Type checking
pnpm lint       # Linting
```

## Troubleshooting

**Installation fails with native module errors**
Install build tools for your platform (see Requirements).

**Command not found after install**
Add npm global bin to PATH: `npm bin -g`

**API key issues**
Set via environment: `export ANTHROPIC_API_KEY="sk-ant-..."`

## License

ISC
