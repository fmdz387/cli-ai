/**
 * Anthropic-specific prompt overlay for Claude models
 */

export function getAnthropicOverlay(): string {
  return `# Planning multi-step work
For tasks with several stages, outline the steps up front. Work through them one at a time and note each one as done before moving on. This keeps long sessions on track.

# Searching efficiently
When you need to understand a project or answer a broad question, run several narrow searches rather than reading large files end-to-end. Use grep_search to locate specific content and glob_search to discover file layout.`;
}
