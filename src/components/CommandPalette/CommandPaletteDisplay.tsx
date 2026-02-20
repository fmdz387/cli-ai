/**
 * Command palette display component - pure rendering, no input handling
 */
import { useTheme } from '../../theme/index.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

import type { SlashCommand } from '../../commands/types.js';
import { CommandPaletteItem } from './CommandPaletteItem.js';

export interface CommandPaletteDisplayProps {
  query: string;
  filteredCommands: SlashCommand[];
  selectedIndex: number;
  visible: boolean;
}

export function CommandPaletteDisplay({
  query,
  filteredCommands,
  selectedIndex,
  visible,
}: CommandPaletteDisplayProps): ReactNode {
  const theme = useTheme();

  if (!visible) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border}
      paddingX={1}
      marginTop={1}
    >
      {/* Query input display */}
      <Box>
        <Text color={theme.secondary} bold>
          /
        </Text>
        <Text color={theme.text}>{query}</Text>
        <Text color={theme.primary}>_</Text>
      </Box>

      {/* Separator */}
      <Box marginY={0}>
        <Text color={theme.border}>{'─'.repeat(50)}</Text>
      </Box>

      {/* Command list */}
      {filteredCommands.length > 0 ? (
        <Box flexDirection="column">
          {filteredCommands.slice(0, 9).map((cmd, index) => (
            <CommandPaletteItem
              key={cmd.name}
              command={cmd}
              index={index}
              isSelected={index === selectedIndex}
            />
          ))}
        </Box>
      ) : (
        <Box>
          <Text color={theme.textMuted}>No matching commands</Text>
        </Box>
      )}

      {/* Help hint */}
      <Box marginTop={1}>
        <Text color={theme.textMuted}>
          [Enter] Select  [1-9] Quick select  [Esc] Close
        </Text>
      </Box>
    </Box>
  );
}
