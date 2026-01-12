# CLI AI

[![npm version](https://img.shields.io/npm/v/@fmdzc/cli-ai)](https://www.npmjs.com/package/@fmdzc/cli-ai)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

**Natural language to shell commands. Powered by Claude AI.**

Describe what you want in plain English. Get the right command. Review, execute, or copy.

![CLI AI Demo](assets/cli-ai.png)

## Features

- **Natural language** - Just describe what you want to do
- **Cross-platform** - Windows (PowerShell, CMD, Git Bash), macOS, Linux
- **Shell-aware** - Commands tailored to your detected shell
- **Interactive** - Execute, copy, edit, or request alternatives
- **Context-aware** - Remembers your conversation history for smarter suggestions
- **Secure** - API keys stored in system keyring, never in plain text
- **Risk assessment** - Color-coded safety levels for every command

## Quick Start

```bash
# Install globally
npm install -g @fmdzc/cli-ai

# Run
s
# or
cli-ai
```

On first run, you'll be prompted for your [Anthropic API key](https://console.anthropic.com/settings/keys).

## Usage

Type what you want in natural language:

```
> find files larger than 100MB

$ find . -size +100M -type f
Risk: low

[1] Execute  [2] Copy  [3] Edit  [4] Alternatives  [5] Cancel
```

### Slash Commands

Type `/` to access commands:

| Command | Description |
|---------|-------------|
| `/config` | Open settings panel |
| `/help` | Show help and shortcuts |
| `/clear` | Clear command history |
| `/exit` | Exit application |

### Keyboard Shortcuts

**Input Mode**
| Key | Action |
|-----|--------|
| `/` | Open command palette |
| `Enter` | Submit query |
| `O` | Toggle output expansion |
| `Ctrl+D` | Exit (when empty) |

**Command Proposal**
| Key | Action |
|-----|--------|
| `1` / `Enter` | Execute command |
| `2` | Copy to clipboard |
| `3` | Edit command |
| `4` | Show alternatives |
| `5` / `Esc` | Cancel |
| `?` | Explain command |

**Settings Panel**
| Key | Action |
|-----|--------|
| `Tab` | Next section |
| `Up/Down` | Navigate items |
| `Enter` | Toggle/Select |
| `Esc` | Close |

## Settings

Access settings with `/config`:

### API Key
- View masked key and storage method
- Change or remove API key

### Model Selection
| Model | Description |
|-------|-------------|
| Claude Sonnet 4.5 | Fast and capable (default) |
| Claude Opus 4.5 | Most capable |
| Claude Haiku 4.5 | Fastest |

### Options
| Setting | Description |
|---------|-------------|
| Context | Pass conversation history to AI for smarter suggestions |
| Show explanations | Display command explanations |
| Syntax highlighting | Colorize command output |
| Simple mode | Minimal UI mode |

## Risk Assessment

| Level | Color | Meaning |
|-------|-------|---------|
| Low | Green | Safe, read-only commands |
| Medium | Yellow | Modifies files or system state |
| High | Red | Potentially destructive |

## Security

### API Key Storage

Your Anthropic API key is stored securely using industry-standard methods:

**Primary: System Keyring**

| Platform | Storage Backend |
|----------|-----------------|
| macOS | Keychain |
| Windows | Credential Manager |
| Linux | Secret Service API (GNOME Keyring, KWallet) |

The system keyring provides OS-level encryption and access control. Your API key is never stored in plain text or environment variables.

**Fallback: Encrypted File**

If the system keyring is unavailable, the key is stored in an encrypted file at `~/.cli_ai_assistant/`. The encryption key is derived from your machine's unique identifiers (hostname + username), making the encrypted file non-portable and machine-specific.

### Key Management

- **View**: See masked key (`sk-ant-***...****`) and storage method in `/config`
- **Change**: Update your API key anytime through settings
- **Remove**: Delete your stored key completely

## Requirements

- **Node.js 20+**
- **Build tools** for native modules:

| Platform | Command |
|----------|---------|
| Windows | `npm install -g windows-build-tools` (Admin) |
| macOS | `xcode-select --install` |
| Ubuntu/Debian | `sudo apt install build-essential libsecret-1-dev` |
| Fedora | `sudo dnf install gcc-c++ libsecret-devel` |
| Arch | `sudo pacman -S base-devel libsecret` |

## Development

```bash
git clone https://github.com/fmdz387/cli-ai.git
cd cli-ai
pnpm install
pnpm dev        # Watch mode
pnpm build      # Production build
```

## License

ISC
