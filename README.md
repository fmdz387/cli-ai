# 🤖 CLI AI Assistant v2

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python 3.8+](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org)
[![Cross Platform](https://img.shields.io/badge/Platform-Windows%20|%20Linux%20|%20macOS-green.svg)](https://github.com/fmdz387/cli-ai)

![CLI AI Assistant Demo](https://github.com/user-attachments/assets/46837c45-ad5a-48f3-92f0-a1cf9872c918)

Lightweight, powerful and intelligent command-line assistant that translates natural language into precise shell commands. Featuring an advanced interactive interface, gesture controls, real-time syntax highlighting, and cross-platform compatibility.

## ✨ What's New in v2

- **🎯 Interactive Command Interface**: Gesture-based controls with real-time preview
- **🎨 Advanced Terminal UI**: Syntax highlighting, Unicode support
- **⚡ Smart Command Suggestions**: AI-powered alternatives and explanations
- **🔒 Enhanced Security**: Risk assessment and safety warnings
- **🚀 Cross-Platform Excellence**: Optimized for Windows, Linux and macOS
- **📋 Smart Clipboard Integration**: One-click command copying and pasting
- **⌨️ Advanced Keyboard Shortcuts**: Vim-inspired editing with history navigation

## 🚀 Quick Start

### One-Line Installation

**Windows:**
```powershell
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/setup.ps1' -OutFile 'setup.ps1'; .\setup.ps1"
```

**Linux/macOS:**
```bash
curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/setup.sh -o setup.sh && bash setup.sh
```

### Basic Usage

After installation, use `s` followed by your natural language command:

```bash
s find all Python files modified in the last week
s show docker containers with high memory usage
s compress this directory into a tar.gz file
```

## 🎛️ Interactive Interface

The v2 interface provides an intuitive command interaction experience:

### Primary Actions
- **`↵ Enter`** - Execute command immediately
- **`⇥ Tab`** - Accept command and paste to active terminal
- **`📋 Ctrl+C`** - Copy command to clipboard

### Advanced Controls
- **`⚡ Ctrl+A`** - Show alternative commands
- **`❓ ?`** - Show help and keyboard shortcuts
- **`✗ Esc`** - Cancel and exit

## 📊 Command Examples

### File Operations
```bash
s list all files larger than 100MB sorted by size
# → find . -type f -size +100M -exec ls -lh {} + | sort -k5 -hr

s find duplicate files in this directory
# → fdupes -r .

s backup my home directory to external drive
# → rsync -av --progress ~/ /media/backup/
```

### System Monitoring
```bash
s show top 10 processes using most CPU
# → ps aux --sort=-%cpu | head -n 11

s monitor network connections in real time
# → netstat -tulnp | watch -n 1

s check disk usage for each mounted filesystem
# → df -h
```

### Development Tasks
```bash
s find all TODO comments in Python files
# → grep -rn "TODO" --include="*.py" .

s start a local HTTP server on port 8080
# → python -m http.server 8080

s show git commits from last month with stats
# → git log --since="1 month ago" --stat
```

## ⚙️ Configuration

### Core Settings

The assistant uses a configuration file located at `~/.cli_ai_assistant/config`:

```ini
# Execution behavior
AI_ASSISTANT_SKIP_CONFIRM=true

# Context and privacy
AI_DIRECTORY_TREE_CONTEXT=true

# Enhanced UI features
AI_ASSISTANT_SAFETY_LEVEL=medium
AI_ASSISTANT_SHOW_EXPLANATIONS=true
AI_ASSISTANT_MAX_ALTERNATIVES=3
AI_ASSISTANT_ENABLE_SYNTAX_HIGHLIGHTING=true
AI_ASSISTANT_ENABLE_COMMAND_HISTORY=true
```

### Configuration Management

**View Configuration:**
```bash
# Display all configuration settings
s config-show

# Display specific setting with details
s config-show AI_ASSISTANT_SAFETY_LEVEL
s config-show AI_ASSISTANT_MAX_ALTERNATIVES
```

**Update Configuration:**
```bash
s config-set AI_ASSISTANT_SAFETY_LEVEL=high
s config-set AI_ASSISTANT_MAX_ALTERNATIVES=5
s config-set AI_ASSISTANT_SHOW_EXPLANATIONS=false
```

### Configuration Commands

| Command | Description |
|---------|-------------|
| `s config-show` | Display all configuration settings with descriptions |
| `s config-show <key>` | Display detailed information about a specific setting |
| `s config-set <key>=<value>` | Update a configuration setting |

### Configuration Options

| Setting | Values | Description |
|---------|--------|-------------|
| `AI_ASSISTANT_SKIP_CONFIRM` | `true/false` | Skip confirmation prompts (default: `true`) |
| `AI_DIRECTORY_TREE_CONTEXT` | `true/false` | Include directory structure in AI context (default: `true`) |
| `AI_ASSISTANT_SAFETY_LEVEL` | `low/medium/high` | Command risk assessment level (default: `medium`) |
| `AI_ASSISTANT_SHOW_EXPLANATIONS` | `true/false` | Display command explanations (default: `true`) |
| `AI_ASSISTANT_MAX_ALTERNATIVES` | `0-5` | Number of alternative commands to generate (default: `3`) |
| `AI_ASSISTANT_ENABLE_SYNTAX_HIGHLIGHTING` | `true/false` | Colorize command syntax (default: `true`) |
| `AI_ASSISTANT_ENABLE_COMMAND_HISTORY` | `true/false` | Enable command history navigation (default: `true`) |

## 🔐 Security & Privacy

### API Key Security
- **Secure Storage**: API keys are stored in your system's secure keyring
- **Local Processing**: Keys never leave your machine
- **No Logging**: Sensitive information is never logged or cached

### Command Safety
- **Risk Assessment**: Commands are automatically analyzed for potential dangers
- **Safety Warnings**: High-risk operations display clear warnings
- **User Control**: All commands require explicit user confirmation or execution

### Privacy Controls
- **Optional Context**: Directory tree sharing can be disabled
- **Local Operation**: All processing happens on your machine
- **No Telemetry**: No usage data is collected or transmitted

## 🖥️ Cross-Platform Support

### Optimized for Your Environment

The assistant automatically detects and optimizes for:

**Windows:**
- Command Prompt, PowerShell, Windows Terminal
- WSL (Windows Subsystem for Linux)
- MSYS2/Git Bash environments

**Linux:**
- Bash, Zsh, Fish shells
- X11 and Wayland display servers
- Various distributions (Ubuntu, Debian, Fedora, Arch, etc.)

**macOS:**
- Terminal.app, iTerm2, and third-party terminals
- Homebrew package management integration
- System theme detection

### Terminal Features
- **Unicode Support**: Beautiful icons and symbols where supported
- **Color Themes**: Automatic light/dark theme detection
- **Responsive Layout**: Adapts to terminal size and capabilities
- **Accessibility**: Fallback modes for limited terminals

## 🛠️ Advanced Features

### Smart Command Generation
- **Context Awareness**: Uses directory structure and command history
- **Multi-Platform**: Generates appropriate commands for your OS/shell
- **Error Recovery**: Provides alternatives when commands fail

### Enhanced User Experience
- **Loading Animations**: Visual feedback during AI processing
- **Progress Indicators**: Clear status for long-running operations
- **Error Handling**: Graceful degradation and helpful error messages

### Developer Experience
- **Command History**: Navigate through previously generated commands
- **Syntax Validation**: Real-time command validation and highlighting
- **Alternative Suggestions**: Multiple approaches to accomplish tasks

## 🎯 Use Cases

### System Administration
```bash
s monitor system resources and alert if CPU usage exceeds 80%
s create a cron job to backup database daily at 2 AM
s find all files owned by user john and change ownership to admin
```

### Development Workflow
```bash
s run tests and generate coverage report
s deploy application to staging environment
s revert last 3 git commits
```

### Data Processing
```bash
s merge all CSV files in data directory and remove duplicates
```

### DevOps Tasks
```bash
s build Docker image and push to registry with latest tag
s show kubernetes pods that are not in running state
s update all npm packages and commit changes
```

## 🔧 Troubleshooting

### Common Issues

**Command not recognized:**
```bash
# Refresh shell configuration
s help  # Test basic functionality
source ~/.bashrc  # Linux/macOS
# or restart terminal
```

**API key issues:**
```bash
# Reconfigure API key
s config-set ANTHROPIC_API_KEY=your_key_here
# or run setup again
```

**Permission errors:**
```bash
# Check installation
python --version  # Ensure Python 3.8+
pip list | grep anthropic  # Verify dependencies
```

### Performance Optimization

**View current configuration:**
```bash
# See all settings with their current values
s config-show

# Check specific settings
s config-show AI_ASSISTANT_SAFETY_LEVEL
```

**Disable context features for faster responses:**
```bash
s config-set AI_DIRECTORY_TREE_CONTEXT=false
s config-set AI_ASSISTANT_MAX_ALTERNATIVES=0
```

**Reduce UI features for slower terminals:**
```bash
s config-set AI_ASSISTANT_ENABLE_SYNTAX_HIGHLIGHTING=false
s config-set AI_ASSISTANT_SHOW_EXPLANATIONS=false
```

## 📚 Technical Architecture

### Core Components
- **AI Engine**: Claude 3.5 Sonnet integration with optimized prompts
- **Command Parser**: Natural language to shell command translation
- **UI Framework**: Cross-platform terminal interface with gesture support
- **Security Layer**: Command risk assessment and user protection

### Dependencies
- **anthropic**: Claude API client
- **keyring**: Secure credential storage
- **Cross-platform utilities**: Terminal optimization and clipboard integration

## 🤝 Contributing

We welcome contributions!

### Development Setup
```bash
git clone https://github.com/fmdz387/cli-ai.git
cd cli-ai
pip install -r requirements.txt
python assistant.py "test command"
```

## 📄 License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [X/Twitter](https://x.com/fylornx)

---

*Transform your command line experience with the power of AI*