/**
 * Command registry with fuzzy filtering for slash commands
 */

import type { CommandRegistry, SlashCommand } from './types.js';

/**
 * Calculate fuzzy match score between query and target
 * Higher score = better match
 */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact prefix match = highest score
  if (t.startsWith(q)) {
    return 100 + (100 - t.length);
  }

  // Contains match = medium score
  if (t.includes(q)) {
    return 50 + (50 - t.indexOf(q));
  }

  // Character-by-character fuzzy match
  let score = 0;
  let queryIndex = 0;

  for (let targetIndex = 0; targetIndex < t.length && queryIndex < q.length; targetIndex++) {
    if (t[targetIndex] === q[queryIndex]) {
      score += 10;
      queryIndex++;
    }
  }

  // Only count as match if all query chars found
  return queryIndex === q.length ? score : 0;
}

/**
 * Get best fuzzy score for a command (checks name, description, and aliases)
 */
function getCommandScore(query: string, command: SlashCommand): number {
  const nameScore = fuzzyScore(query, command.name);
  const descScore = fuzzyScore(query, command.description);
  const aliasScores = (command.aliases ?? []).map((alias) => fuzzyScore(query, alias));

  return Math.max(nameScore, descScore, ...aliasScores);
}

/**
 * Create a new command registry instance
 */
export function createCommandRegistry(): CommandRegistry {
  const commands: SlashCommand[] = [];
  const aliasMap = new Map<string, SlashCommand>();

  function updateAliasMap(): void {
    aliasMap.clear();
    for (const cmd of commands) {
      aliasMap.set(cmd.name.toLowerCase(), cmd);
      for (const alias of cmd.aliases ?? []) {
        aliasMap.set(alias.toLowerCase(), cmd);
      }
    }
  }

  return {
    get commands(): readonly SlashCommand[] {
      return commands;
    },

    get(nameOrAlias: string): SlashCommand | undefined {
      return aliasMap.get(nameOrAlias.toLowerCase());
    },

    filter(query: string): SlashCommand[] {
      if (!query) {
        return [...commands];
      }

      const scored = commands
        .map((cmd) => ({
          cmd,
          score: getCommandScore(query, cmd),
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score);

      return scored.map(({ cmd }) => cmd);
    },

    register(command: SlashCommand): void {
      // Prevent duplicate registration
      const existing = aliasMap.get(command.name.toLowerCase());
      if (existing) {
        return;
      }

      commands.push(command);
      updateAliasMap();
    },
  };
}

/**
 * Global command registry singleton
 */
export const commandRegistry = createCommandRegistry();
