/**
 * Gemini-specific prompt overlay for Google Gemini models
 */

export function getGeminiOverlay(): string {
  return `# Project conventions
Before writing or modifying any file, examine neighbouring files to learn the project's formatting, naming, and structural patterns. Follow them exactly.

# Brevity
Keep text responses to one or two lines when possible. Answer directly without conversational padding.

# Validation
After making changes, run the project's build, lint, or type-check commands to confirm nothing is broken. Do not assume correctness without running verification.`;
}
