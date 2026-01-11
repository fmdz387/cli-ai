/**
 * Command execution output display component
 */

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

import { DEFAULT_CONFIG } from '../constants.js';
import type { ExecutionResult, HistoryEntry } from '../types/index.js';

interface CommandOutputProps {
  result: ExecutionResult;
  expanded?: boolean;
  maxLines?: number;
}

function formatOutput(output: string, maxLines: number): { lines: string[]; hiddenCount: number } {
  const lines = output.split('\n').filter(line => line.length > 0);

  if (lines.length <= maxLines) {
    return { lines, hiddenCount: 0 };
  }

  const truncatedLines = lines.slice(0, maxLines);
  return { lines: truncatedLines, hiddenCount: lines.length - maxLines };
}

export function CommandOutput({
  result,
  expanded = false,
  maxLines = DEFAULT_CONFIG.maxOutputLines,
}: CommandOutputProps): ReactNode {
  const effectiveMaxLines = expanded ? 500 : maxLines;
  const hasOutput = result.stdout || result.stderr;

  if (!hasOutput) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>$ {result.command}</Text>
        </Box>
        <Box>
          <Text dimColor italic>
            (no output)
          </Text>
        </Box>
        <ExitCodeDisplay exitCode={result.exitCode} />
      </Box>
    );
  }

  const stdout = result.stdout ? formatOutput(result.stdout, effectiveMaxLines) : { lines: [], hiddenCount: 0 };
  const stderr = result.stderr ? formatOutput(result.stderr, effectiveMaxLines) : { lines: [], hiddenCount: 0 };
  const totalHidden = stdout.hiddenCount + stderr.hiddenCount;

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>$ {result.command}</Text>
      </Box>

      {stdout.lines.length > 0 && (
        <Box flexDirection="column">
          {stdout.lines.map((line, i) => (
            <Text key={`stdout-${i}`}>{line}</Text>
          ))}
        </Box>
      )}

      {stderr.lines.length > 0 && (
        <Box flexDirection="column">
          {stderr.lines.map((line, i) => (
            <Text key={`stderr-${i}`} color="red">
              {line}
            </Text>
          ))}
        </Box>
      )}

      {totalHidden > 0 && !expanded && (
        <Box>
          <Text dimColor>... ({totalHidden} more lines, press </Text>
          <Text color="blue">[O]</Text>
          <Text dimColor> to expand)</Text>
        </Box>
      )}

      <ExitCodeDisplay exitCode={result.exitCode} />
    </Box>
  );
}

function ExitCodeDisplay({ exitCode }: { exitCode: number }): ReactNode {
  if (exitCode === 0) {
    return (
      <Box>
        <Text color="green" dimColor>✓</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color="red">✗ exit {exitCode}</Text>
    </Box>
  );
}

interface HistoryItemProps {
  entry: HistoryEntry;
  expanded: boolean;
  isLatest: boolean;
}

function HistoryItem({ entry, expanded, isLatest }: HistoryItemProps): ReactNode {
  const result: ExecutionResult = {
    command: entry.command,
    stdout: entry.output || '',
    stderr: '',
    exitCode: entry.exitCode ?? 0,
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color="cyan" bold>❯ </Text>
        <Text color="cyan">{entry.query}</Text>
      </Box>

      <Box flexDirection="column" marginLeft={2}>
        <CommandOutput result={result} expanded={expanded} maxLines={isLatest ? 10 : 3} />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{'─'.repeat(50)}</Text>
      </Box>
    </Box>
  );
}

interface OutputHistoryProps {
  history: HistoryEntry[];
  expanded: boolean;
}

export function OutputHistory({ history, expanded }: OutputHistoryProps): ReactNode {
  const lastEntry = history[history.length - 1];

  if (!lastEntry) {
    return null;
  }

  return (
    <Box flexDirection="column">
      <HistoryItem entry={lastEntry} expanded={expanded} isLatest={true} />
    </Box>
  );
}

interface LiveOutputProps {
  lines: string[];
  command: string;
}

export function LiveOutput({ lines, command }: LiveOutputProps): ReactNode {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text dimColor>$ {command}</Text>
      </Box>

      <Box flexDirection="column">
        {lines.map((line, i) => {
          const isError = line.startsWith('[ERR]');
          return (
            <Text key={i} color={isError ? 'red' : undefined}>
              {isError ? line.slice(6) : line}
            </Text>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color="yellow">⏳ Running...</Text>
      </Box>
    </Box>
  );
}
