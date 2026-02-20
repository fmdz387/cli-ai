/**
 * Anthropic-specific prompt overlay for Claude models
 */

export function getAnthropicOverlay(): string {
  return `# Task management
Plan complex tasks by breaking them into steps. Track your progress as you work through multi-step tasks. Mark each step as complete when finished before moving to the next.

# Search guidance
When exploring a codebase to gather context or answer broad questions, prefer breaking the work into focused searches rather than reading entire large files. Use grep_search for targeted content discovery and glob_search for file discovery.`;
}
