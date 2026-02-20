/**
 * Individual command item in the palette list
 */
import { useTheme } from '../../theme/index.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

import type { SlashCommand } from '../../commands/types.js';

export interface CommandPaletteItemProps {
  command: SlashCommand;
  index: number;
  isSelected: boolean;
}

export function CommandPaletteItem({
  command,
  index,
  isSelected,
}: CommandPaletteItemProps): ReactNode {
  const theme = useTheme();

  return (
    <Box>
      <Text color={isSelected ? theme.primary : theme.textMuted} bold={isSelected}>
        {isSelected ? '> ' : '  '}
      </Text>
      <Text color={isSelected ? theme.primary : theme.secondary} bold={isSelected}>
        [{index + 1}]
      </Text>
      <Text> </Text>
      <Text color={isSelected ? theme.text : theme.textMuted} bold={isSelected}>
        /{command.name}
      </Text>
      <Text>  </Text>
      <Text color={isSelected ? theme.text : theme.textMuted}>{command.description}</Text>
      {command.shortcut ? (
        <>
          <Text>  </Text>
          <Text color={theme.warning}>
            {command.shortcut}
          </Text>
        </>
      ) : null}
    </Box>
  );
}
