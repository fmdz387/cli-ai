# 🤖 CLI AI Assistant

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

![image](https://github.com/user-attachments/assets/46837c45-ad5a-48f3-92f0-a1cf9872c918)

A simple command-line AI assistant that translates natural language into shell commands.
Supports all Windows and Unix-based systems (Linux, MacOS).

## Note
- API key is stored securely in your system's keyring and is not shared outside of this machine.
- This is a lightweight CLI AI assistant for personal use.
- Currently, assistant uses Anthropic as an AI provider.

## Installation

### Windows

```powershell
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/setup.ps1' -OutFile 'setup.ps1'; .\setup.ps1"
```

### Unix-based systems (Linux, MacOS)

```bash
curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/setup.sh -o setup.sh && bash setup.sh
```

## Usage

After installation, you can use the CLI AI Assistant by typing `s` followed by your natural language command. Here are some examples:

1. Basic usage:
   ```
   s list all files in the current directory
   ```
   This will translate to: `ls -la`

2. Complex commands:
   ```
   s find all python files modified in the last 7 days
   ```
   This might translate to: `find . -name "*.py" -mtime -7`

3. System information:
   ```
   s show system memory usage
   ```
   This could translate to: `free -h`

4. Package management:
   ```
   s update all installed packages
   ```
   On Ubuntu/Debian, this might translate to: `sudo apt update && sudo apt upgrade -y`

5. Help command:
   ```
   s help
   ```
   This will display the help message.

6. Config command:
   ```
   s config-set AI_ASSISTANT_SKIP_CONFIRM=true
   ```
   This will update the configuration with the specified key-value pair.

## Default Configuration

- `AI_ASSISTANT_SKIP_CONFIRM`: Default to `true`. If set to `false`, the assistant will ask for confirmation before executing commands.
- `AI_DIRECTORY_TREE_CONTEXT`: Default to `true`. If set to `true`, the assistant will provide directory tree as a context for AI command generation. NOTE: Disable this if you don't want to share your directory structure with the AI provider.

## Edge Cases and Notes:

- If the AI doesn't understand your request, it will try to provide the closest matching command or ask for clarification.
- Keep requests focused on a single task for optimal results.
- Remember that the generated commands are executed in your current shell environment. Be cautious with commands that might affect your system globally.
- By default, the assistant will regularly wait for your interaction before executing commands.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.
