# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.0] - 2026-02-21

### Added

- **Agentic mode**: Full tool-use loop with multi-turn reasoning. The AI can now read files, run commands, search code and chain actions autonomously
- **7 built-in tools**: bash_execute, file_read, file_write, file_edit, glob_search, grep_search, list_directory
- **Permission system**: Allow/ask/deny gates per tool with approve-for-session support
- **Chat-first UX**: Replaced the single command-proposal flow with a persistent conversational interface
- **Streaming responses**: Real-time markdown rendering with tool call status indicators
- **Theme system**: Catppuccin Mocha color scheme with semantic tokens
- **Markdown rendering**: Headings, lists, code blocks, links and blockquotes in the terminal
- **Context compaction**: Automatic conversation summarization when context grows large
- **Max-steps summary**: Graceful degradation when the agent hits the turn limit
- **Model-aware prompts**: Multi-layer prompt system tuned per provider and model

### Changed

- **Tabbed settings panel**: Config panel shows one section at a time with horizontal tab bar, arrow key and number key navigation
- **Chat components**: New ChatView, UserBubble, and AssistantBubble replace the old proposal display
- **Prompt system**: Rewritten with original DevOps-focused content

### Fixed

- **Streaming text leak**: Intermediate AI text from tool-call turns no longer bleeds into the final response
- **Duplicate provider/model in input**: Removed redundant info from inside the input border
- **OpenRouter SDK format**: Handle camelCase response format from OpenRouter SDK
- **Memory safety**: Cap message arrays, cache executor deps, optimize streaming deltas
- **Security hardening**: Improved encryption key derivation, path validation and regex safety
- **Process lifecycle**: Replace process.exit with Ink exit, add error boundary

## [3.1.2] - 2026-01-17

### Minor bug fixes

- **Fixed clear command**: Fixed clear command to work
- **Fixed components rendering**: Enhanced components rendering

## [3.1.1] - 2026-01-13

### Minor bug fixes

## [3.1.0] - 2026-01-13

### Added

- Multi-provider support: Anthropic, OpenAI and OpenRouter
- Custom model ID input for any provider
- Provider selection in welcome flow
- Per-provider API key management

## [3.0.4] - 2026-01-12

## [3.0.3] - 2026-01-12

### Minor Changes

## [3.0.2] - 2026-01-12

### Minor Changes

- **Added optional dependencies**: Added optional dependencies for the keyring package

## [3.0.1] - 2026-01-12

### Minor Changes

- **Fixed package name**: Changed from `@fmdz387/cli-ai` to `@fmdzc/cli-ai`

## [3.0.0] - 2026-01-12

### Added

- **Persistent REPL Session**: Full context retention across multiple queries
- **Interactive Command UI**: Execute, copy, edit, or get alternatives
- **Risk Assessment**: Color-coded risk levels (low/medium/high) for commands
- **Syntax Highlighting**: Shell-aware command highlighting with chalk
- **Secure API Key Storage**: System keyring (keytar) with encrypted fallback
- **Live Output Streaming**: Real-time command output display (last 10 lines)
- **Alternative Commands**: AI-generated alternative approaches
- **Command Explanation**: On-demand explanation for any command
- **Cross-Platform**: Windows (PowerShell/cmd), macOS, Linux (bash/zsh/fish)

### Changed

- **Complete TypeScript Rewrite**: Migrated from Python v2 to TypeScript
- **New UI Framework**: Ink (React for CLI) replaces simple output
- **API Provider**: Anthropic Claude only (removed multi-provider support)
- **Default Model**: claude-sonnet-4-5-20250929

### Removed

- Simple Mode (v2 feature) - Single unified interactive mode
- Multi-provider support - Anthropic only for v3
- External shell execution - Commands run inline within Ink

## [2.x] - Previous Python Version

See the [Python v2 repository](https://github.com/fmdz387/cli-ai/tree/v2.0.0) for previous changelog.
