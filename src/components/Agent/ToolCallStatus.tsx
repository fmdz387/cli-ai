/**
 * Tool call status - compact single-line display with smart result summaries
 */
import { useTheme } from '../../theme/index.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export type ToolCallStatusType =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'denied';

interface ToolCallStatusProps {
  call: { name: string; input: Record<string, unknown> };
  status: ToolCallStatusType;
  result?: string;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}

const TOOL_ICONS: Record<string, string> = {
  bash_execute: '$',
  file_read: '\u2192',
  file_write: '\u2190',
  file_edit: '\u2190',
  glob_search: '\u2731',
  grep_search: '\u2731',
  directory_list: '\u2731',
};

function getToolIcon(toolName: string): string {
  return TOOL_ICONS[toolName] ?? '\u2699';
}

/**
 * Build a compact description for the tool call based on its name and input
 */
function formatToolDesc(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'file_read': {
      const p = typeof input['filePath'] === 'string' ? input['filePath'] : '';
      return shortPath(p);
    }
    case 'file_write':
    case 'file_edit': {
      const p = typeof input['filePath'] === 'string' ? input['filePath'] : '';
      return shortPath(p);
    }
    case 'bash_execute': {
      const cmd = typeof input['command'] === 'string' ? input['command'] : '';
      return truncate(cmd, 50);
    }
    case 'directory_list': {
      const p = typeof input['dirPath'] === 'string' ? input['dirPath'] : '.';
      return shortPath(p);
    }
    case 'glob_search': {
      const pattern = typeof input['pattern'] === 'string' ? input['pattern'] : '';
      return pattern;
    }
    case 'grep_search': {
      const pattern = typeof input['pattern'] === 'string' ? input['pattern'] : '';
      const path = typeof input['path'] === 'string' ? input['path'] : '';
      return path ? `${pattern} in ${shortPath(path)}` : pattern;
    }
    default: {
      const entries = Object.entries(input);
      if (entries.length === 0) return '';
      const first = entries[0];
      if (!first) return '';
      const val = typeof first[1] === 'string' ? first[1] : JSON.stringify(first[1]);
      return truncate(val, 50);
    }
  }
}

function shortPath(path: string): string {
  // Show last 2 segments of path
  const parts = path.replace(/\\/g, '/').split('/');
  if (parts.length <= 2) return path;
  return '.../' + parts.slice(-2).join('/');
}

/**
 * Build a compact result summary based on tool type and result content
 */
function formatResultSummary(name: string, result: string, status: ToolCallStatusType): string | null {
  if (status === 'error') {
    // Show first line of error
    const firstLine = result.split('\n')[0] ?? result;
    return truncate(firstLine, 60);
  }
  if (status === 'denied') {
    return 'denied';
  }
  if (!result) return null;

  switch (name) {
    case 'directory_list': {
      const lines = result.split('\n').filter(Boolean);
      const count = lines.length;
      return `${count} entries`;
    }
    case 'file_read': {
      const lines = result.split('\n');
      const count = lines.length;
      return `${count} lines`;
    }
    case 'glob_search': {
      const lines = result.split('\n').filter(Boolean);
      return `${lines.length} files`;
    }
    case 'grep_search': {
      const lines = result.split('\n').filter(Boolean);
      return `${lines.length} matches`;
    }
    case 'bash_execute': {
      // Check for exit code in result
      if (result.includes('[exit code:')) {
        const match = result.match(/\[exit code: (\d+)\]/);
        if (match && match[1] !== '0') {
          return `exit ${match[1]}`;
        }
      }
      const lines = result.split('\n').filter(Boolean);
      if (lines.length === 0) return null;
      if (lines.length === 1) return truncate(lines[0]!, 50);
      return `${lines.length} lines`;
    }
    default:
      return null;
  }
}

export function ToolCallStatus({
  call,
  status,
  result,
}: ToolCallStatusProps): ReactNode {
  const theme = useTheme();

  const statusColorMap: Record<ToolCallStatusType, string> = {
    pending: theme.textMuted,
    running: theme.warning,
    success: theme.success,
    error: theme.error,
    denied: theme.error,
  };

  const iconColor = statusColorMap[status];
  const icon = getToolIcon(call.name);
  const desc = formatToolDesc(call.name, call.input);
  const summary = result ? formatResultSummary(call.name, result, status) : null;

  return (
    <Box marginLeft={2}>
      <Text color={iconColor}>{icon}</Text>
      <Text color={theme.textMuted}> </Text>
      <Text color={theme.secondary}>{call.name}</Text>
      {desc && (
        <>
          <Text color={theme.textMuted}>  </Text>
          <Text color={theme.text}>{desc}</Text>
        </>
      )}
      {summary && (
        <>
          <Text color={theme.textMuted}>  </Text>
          <Text color={status === 'error' ? theme.error : theme.textMuted}>{summary}</Text>
        </>
      )}
    </Box>
  );
}
