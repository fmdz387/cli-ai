/**
 * Help panel display component - shows keyboard shortcuts and usage info
 */
import { useTheme } from '../../theme/index.js';

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

import { APP_NAME, VERSION } from '../../constants.js';

export interface HelpPanelDisplayProps {
  visible: boolean;
}

interface ShortcutItem {
  key: string;
  description: string;
}

const INPUT_SHORTCUTS: ShortcutItem[] = [
  { key: '/', description: 'Open command palette' },
  { key: 'Enter', description: 'Submit query' },
  { key: 'Ctrl+D', description: 'Exit (when input is empty)' },
  { key: 'O', description: 'Toggle output expansion (when input is empty)' },
];

const PROPOSAL_SHORTCUTS: ShortcutItem[] = [
  { key: '1 / Enter', description: 'Execute command' },
  { key: '2', description: 'Copy to clipboard' },
  { key: '3', description: 'Edit command' },
  { key: '4', description: 'Show alternatives' },
  { key: '5 / Esc', description: 'Cancel' },
  { key: '?', description: 'Explain command' },
  { key: 'O', description: 'Toggle output' },
];

const PALETTE_SHORTCUTS: ShortcutItem[] = [
  { key: 'Up/Down', description: 'Navigate commands' },
  { key: 'Enter', description: 'Select command' },
  { key: 'Esc', description: 'Close palette' },
  { key: '1-9', description: 'Quick select' },
];

const CONFIG_SHORTCUTS: ShortcutItem[] = [
  { key: 'Tab', description: 'Next section' },
  { key: 'Shift+Tab', description: 'Previous section' },
  { key: 'Up/Down', description: 'Navigate items' },
  { key: 'Enter/Space', description: 'Toggle/Select' },
  { key: 'Esc', description: 'Close panel' },
];

function ShortcutSection({ title, shortcuts }: { title: string; shortcuts: ShortcutItem[] }): ReactNode {
  const theme = useTheme();

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.warning} bold>{title}</Text>
      {shortcuts.map((shortcut) => (
        <Box key={shortcut.key}>
          <Box width={16}>
            <Text color={theme.primary}>{shortcut.key}</Text>
          </Box>
          <Text color={theme.textMuted}>{shortcut.description}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function HelpPanelDisplay({ visible }: HelpPanelDisplayProps): ReactNode {
  const theme = useTheme();

  if (!visible) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border}
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text color={theme.primary} bold>
            Help - {APP_NAME} v{VERSION}
          </Text>
        </Box>
        <Box>
          <Text color={theme.textMuted}>[Esc] Close</Text>
        </Box>
      </Box>

      {/* Description */}
      <Box marginBottom={1}>
        <Text color={theme.text}>
          Natural language to shell command translator. Describe what you want
          in plain English and get executable commands.
        </Text>
      </Box>

      {/* Shortcuts Grid */}
      <Box>
        <Box flexDirection="column" marginRight={4}>
          <ShortcutSection title="Input Mode" shortcuts={INPUT_SHORTCUTS} />
          <ShortcutSection title="Command Palette" shortcuts={PALETTE_SHORTCUTS} />
        </Box>
        <Box flexDirection="column">
          <ShortcutSection title="Proposal Mode" shortcuts={PROPOSAL_SHORTCUTS} />
          <ShortcutSection title="Config Panel" shortcuts={CONFIG_SHORTCUTS} />
        </Box>
      </Box>

      {/* Commands */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.warning} bold>Available Commands</Text>
        <Box>
          <Box width={16}><Text color={theme.primary}>/config</Text></Box>
          <Text color={theme.textMuted}>Open settings panel</Text>
        </Box>
        <Box>
          <Box width={16}><Text color={theme.primary}>/help</Text></Box>
          <Text color={theme.textMuted}>Show this help</Text>
        </Box>
        <Box>
          <Box width={16}><Text color={theme.primary}>/clear</Text></Box>
          <Text color={theme.textMuted}>Clear command history</Text>
        </Box>
        <Box>
          <Box width={16}><Text color={theme.primary}>/exit</Text></Box>
          <Text color={theme.textMuted}>Exit application</Text>
        </Box>
      </Box>
    </Box>
  );
}
