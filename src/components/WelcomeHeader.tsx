/**
 * Welcome header component displayed on session start
 */

import { Box, Text } from 'ink';
import { homedir, userInfo } from 'node:os';
import type { ReactNode } from 'react';

import { APP_NAME, VERSION } from '../constants.js';
import type { ShellType } from '../types/index.js';

interface WelcomeHeaderProps {
  shell: ShellType;
  cwd: string;
  model?: string;
}

// ASCII art logo - simple terminal/command prompt icon
const LOGO = [
  '  ╭───────╮  ',
  '  │ ▶ _   │  ',
  '  ╰───────╯  ',
];

export function WelcomeHeader({ shell, cwd, model }: WelcomeHeaderProps): ReactNode {
  const username = userInfo().username || 'user';
  const shortCwd = cwd.replace(homedir(), '~');
  const displayModel = model || 'claude-sonnet-4-5-20250929';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      marginBottom={1}
    >
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {APP_NAME}
        </Text>
        <Text dimColor> v{VERSION}</Text>
      </Box>

      <Box>
        <Box flexDirection="column" marginRight={4}>
          <Box marginBottom={1}>
            <Text>Welcome, </Text>
            <Text color="yellow" bold>{username}</Text>
            <Text>!</Text>
          </Box>

          <Box flexDirection="column">
            {LOGO.map((line, i) => (
              <Text key={i} color="cyan">{line}</Text>
            ))}
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text dimColor>Shell: </Text>
              <Text color="green">{shell}</Text>
            </Box>
            <Box>
              <Text dimColor>Path: </Text>
              <Text>{shortCwd}</Text>
            </Box>
          </Box>
        </Box>

        <Box flexDirection="column" borderStyle="single" borderColor="gray" borderLeft borderRight={false} borderTop={false} borderBottom={false} paddingLeft={2}>
          <Box marginBottom={1}>
            <Text color="yellow" bold>Quick Start</Text>
          </Box>

          <Box flexDirection="column">
            <Text dimColor>Describe what you want in natural language:</Text>
            <Text color="gray" italic>  "list all files modified today"</Text>
            <Text color="gray" italic>  "find large files over 100MB"</Text>
            <Text color="gray" italic>  "show git status"</Text>
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Model: </Text>
            <Text color="magenta">{displayModel.split('-').slice(0, 2).join(' ')}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
