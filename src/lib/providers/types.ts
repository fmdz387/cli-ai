import { AI_RETRY_CONFIG, MAX_CONTEXT_HISTORY, MAX_CONTEXT_OUTPUT_CHARS } from '../../constants.js';
import type { AgentMessage } from '../../agent/types.js';
import type {
  CommandProposal,
  Result,
  RiskLevel,
  SessionContext,
  ShellType,
} from '../../types/index.js';
import { combineRiskAssessment } from '../risk-assessment.js';

export interface SendWithToolsOptions {
  maxTokens: number;
  signal?: AbortSignal;
}

export interface Provider {
  generateCommand(query: string, context: SessionContext): Promise<Result<CommandProposal>>;
  generateAlternatives(
    query: string,
    context: SessionContext,
    exclude: string,
    count: number,
  ): Promise<Result<CommandProposal[]>>;
  explainCommand(command: string): Promise<Result<string>>;
  sendWithTools(
    messages: AgentMessage[],
    tools: unknown,
    options: SendWithToolsOptions,
  ): Promise<unknown>;
}

export function buildSystemPrompt(shell: ShellType): string {
  return `You are a CLI command generator for ${shell}.
You translate natural language requests into shell commands.

IMPORTANT: Output ONLY valid JSON, no markdown, no explanation text.
Format: { "command": "...", "risk": "low|medium|high" }

Risk levels:
- low: Safe reads, common commands (ls, cat, pwd, git status, etc.)
- medium: Writes files, installs packages, modifies state
- high: Destructive operations, sudo, system changes, recursive deletes

Rules:
1. Generate ONLY the command, no explanations in the command itself
2. Use appropriate flags for the target shell
3. Prefer safe alternatives when possible
4. For destructive operations, include safety flags (-i for interactive, etc.)
5. Never include placeholder values - ask for specifics if needed`;
}

function truncateOutput(output: string, maxChars: number): string {
  if (!output || output.length <= maxChars) return output;
  const truncated = output.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf('\n');
  if (lastNewline > maxChars * 0.5) {
    return truncated.slice(0, lastNewline) + '\n... (truncated)';
  }
  return truncated + '... (truncated)';
}

export function buildUserPrompt(query: string, context: SessionContext): string {
  const parts: string[] = [];
  parts.push(`Current directory: ${context.cwd}`);
  parts.push(`\nDirectory structure:\n${context.directoryTree}`);

  if (context.history.length > 0) {
    parts.push('\nConversation context (recent queries and results):');
    const historySlice = context.history.slice(-MAX_CONTEXT_HISTORY);
    for (const entry of historySlice) {
      parts.push(`\nQuery: "${entry.query}"`);
      parts.push(`Command: ${entry.command}`);
      if (entry.exitCode !== undefined) {
        parts.push(`Exit code: ${entry.exitCode}`);
      }
      if (entry.output) {
        const truncatedOutput = truncateOutput(entry.output, MAX_CONTEXT_OUTPUT_CHARS);
        parts.push(`Output:\n${truncatedOutput}`);
      }
    }
  }

  parts.push(`\nUser request: ${query}`);
  return parts.join('\n');
}

export function parseCommandResponse(content: string): CommandProposal {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as { command?: string; risk?: string };
  if (!parsed.command || typeof parsed.command !== 'string') {
    throw new Error('Invalid response: missing command');
  }

  const risk = parsed.risk as RiskLevel | undefined;
  const validRisk = risk && ['low', 'medium', 'high'].includes(risk) ? risk : 'medium';

  return {
    command: parsed.command.trim(),
    risk: combineRiskAssessment(validRisk, parsed.command),
  };
}

export function parseAlternativesResponse(content: string): CommandProposal[] {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as Array<{ command?: string; risk?: string }>;
  return parsed
    .filter((p) => p.command && typeof p.command === 'string')
    .map((p) => {
      const risk = p.risk as RiskLevel | undefined;
      const validRisk = risk && ['low', 'medium', 'high'].includes(risk) ? risk : 'medium';
      return {
        command: p.command!.trim(),
        risk: combineRiskAssessment(validRisk, p.command!),
      };
    });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { AI_RETRY_CONFIG };
