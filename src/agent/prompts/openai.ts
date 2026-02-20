/**
 * OpenAI-specific prompt overlay for GPT and o-series models
 */

export function getOpenAIOverlay(): string {
  return `# Workflow
Keep going until the problem is completely solved before ending your turn. Do not stop partway through.

Follow this structured workflow:
1. Understand the problem deeply
2. Investigate the codebase thoroughly
3. Develop a step-by-step plan
4. Implement incrementally
5. Debug as needed
6. Test frequently
7. Iterate until all tests pass

Plan extensively before each tool call. Reflect on the outcomes of previous tool calls before proceeding.`;
}
