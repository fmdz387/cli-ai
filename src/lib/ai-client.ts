/**
 * Anthropic API client wrapper with retry logic
 */
import { AI_RETRY_CONFIG, DEFAULT_MODEL, MAX_AI_TOKENS } from '../constants.js';
import type {
  CommandProposal,
  HistoryEntry,
  Result,
  SessionContext,
  ShellType,
} from '../types/index.js';
import { generateDirectoryTree } from './directory-tree.js';
import { combineRiskAssessment } from './risk-assessment.js';
import { getApiKey } from './secure-storage.js';
import Anthropic from '@anthropic-ai/sdk';

function buildSystemPrompt(shell: ShellType): string {
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

function buildUserPrompt(query: string, context: SessionContext): string {
  const parts: string[] = [];

  // Add current directory and tree
  parts.push(`Current directory: ${context.cwd}`);
  parts.push(`\nDirectory structure:\n${context.directoryTree}`);

  // Add recent command history if available
  if (context.history.length > 0) {
    parts.push('\nRecent commands:');
    for (const entry of context.history.slice(-5)) {
      parts.push(`- ${entry.command}`);
      if (entry.output) {
        const trimmedOutput = entry.output.split('\n').slice(0, 3).join('\n');
        parts.push(`  Output: ${trimmedOutput}`);
      }
    }
  }

  // Add the user's query
  parts.push(`\nUser request: ${query}`);

  return parts.join('\n');
}

function parseResponse(content: string): CommandProposal {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as { command?: string; risk?: string };

  if (!parsed.command || typeof parsed.command !== 'string') {
    throw new Error('Invalid response: missing command');
  }

  const risk = parsed.risk as 'low' | 'medium' | 'high' | undefined;
  const validRisk = risk && ['low', 'medium', 'high'].includes(risk) ? risk : 'medium';

  return {
    command: parsed.command.trim(),
    risk: combineRiskAssessment(validRisk, parsed.command),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateCommand(
  query: string,
  context: SessionContext,
): Promise<Result<CommandProposal>> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      success: false,
      error: new Error('No API key configured'),
    };
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;

  for (let attempt = 0; attempt < AI_RETRY_CONFIG.maxAttempts; attempt++) {
    try {
    const response = await client.messages.create({
        model,
        max_tokens: MAX_AI_TOKENS,
        system: buildSystemPrompt(context.shell),
        messages: [{ role: 'user', content: buildUserPrompt(query, context) }],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in AI response');
      }

      const proposal = parseResponse(textContent.text);
      return { success: true, data: proposal };
    } catch (error) {
      const isLastAttempt = attempt === AI_RETRY_CONFIG.maxAttempts - 1;

      if (isLastAttempt) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }

      const delay = Math.min(
        AI_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
        AI_RETRY_CONFIG.maxDelayMs,
      );
      await sleep(delay);
    }
  }

  return {
    success: false,
    error: new Error('Unexpected error in AI request'),
  };
}

export async function generateAlternatives(
  query: string,
  context: SessionContext,
  excludeCommand: string,
  count: number = 3,
): Promise<Result<CommandProposal[]>> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      success: false,
      error: new Error('No API key configured'),
    };
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;

  const altPrompt = `${buildUserPrompt(query, context)}

Generate ${count} ALTERNATIVE commands (different approaches).
Exclude: ${excludeCommand}

Output JSON array: [{ "command": "...", "risk": "low|medium|high" }, ...]`;

  try {
  const response = await client.messages.create({
      model,
      max_tokens: MAX_AI_TOKENS * 2,
      system: buildSystemPrompt(context.shell),
      messages: [{ role: 'user', content: altPrompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in AI response');
    }

    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ command?: string; risk?: string }>;

    const proposals: CommandProposal[] = parsed
      .filter((p) => p.command && typeof p.command === 'string')
      .map((p) => {
        const risk = p.risk as 'low' | 'medium' | 'high' | undefined;
        const validRisk = risk && ['low', 'medium', 'high'].includes(risk) ? risk : 'medium';
        return {
          command: p.command!.trim(),
          risk: combineRiskAssessment(validRisk, p.command!),
        };
      });

    return { success: true, data: proposals };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export async function explainCommand(command: string): Promise<Result<string>> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      success: false,
      error: new Error('No API key configured'),
    };
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: MAX_AI_TOKENS,
      messages: [
        {
          role: 'user',
          content: `Explain this command briefly (2-3 sentences max):\n${command}`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in AI response');
    }

    return { success: true, data: textContent.text.trim() };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export function createSessionContext(
  shell: ShellType,
  history: HistoryEntry[] = [],
): SessionContext {
  const cwd = process.cwd();

  return {
    shell,
    cwd,
    platform: process.platform,
    directoryTree: generateDirectoryTree(cwd),
    history,
  };
}
