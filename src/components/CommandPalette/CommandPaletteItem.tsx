/**
 * Individual command item in the palette list
 */

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
  return (
    <Box>
      <Text color={isSelected ? 'cyan' : 'gray'} bold={isSelected}>
        {isSelected ? '> ' : '  '}
      </Text>
      <Text color={isSelected ? 'cyan' : 'blue'} bold={isSelected}>
        [{index + 1}]
      </Text>
      <Text> </Text>
      <Text color={isSelected ? 'white' : 'gray'} bold={isSelected}>
        /{command.name}
      </Text>
      <Text>  </Text>
      <Text dimColor={!isSelected}>{command.description}</Text>
      {command.shortcut ? (
        <>
          <Text>  </Text>
          <Text dimColor color="yellow">
            {command.shortcut}
          </Text>
        </>
      ) : null}
    </Box>
  );
}
