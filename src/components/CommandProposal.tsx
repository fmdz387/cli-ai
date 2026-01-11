/**
 * Command proposal display component with syntax highlighting
 */

import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

import type { CommandProposal as CommandProposalType } from '../types/index.js';
import { getCommandSegments } from '../lib/syntax-highlight.js';

interface CommandProposalProps {
  proposal: CommandProposalType;
  showExplanation?: boolean;
}

function HighlightedCommand({ command }: { command: string }): ReactNode {
  const segments = getCommandSegments(command);

  return (
    <Text>
      {segments.map((segment, i) => (
        <Text
          key={i}
          color={segment.color as Parameters<typeof Text>[0]['color']}
          bold={segment.bold}
        >
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

export function CommandProposal({
  proposal,
  showExplanation = false,
}: CommandProposalProps): ReactNode {
  return (
    <Box flexDirection="column">
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={2}
        paddingY={1}
      >
        <HighlightedCommand command={proposal.command} />
      </Box>

      {showExplanation && proposal.explanation && (
        <Box marginTop={1} paddingX={1}>
          <Text dimColor>{proposal.explanation}</Text>
        </Box>
      )}
    </Box>
  );
}

interface CompactCommandProps {
  command: string;
  index: number;
  selected?: boolean;
}

export function CompactCommand({
  command,
  index,
  selected = false,
}: CompactCommandProps): ReactNode {
  return (
    <Box>
      <Text color={selected ? 'cyan' : 'blue'} bold={selected}>
        [{index + 1}]
      </Text>
      <Text> </Text>
      <HighlightedCommand command={command} />
    </Box>
  );
}

interface AlternativesListProps {
  proposals: CommandProposalType[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}

export function AlternativesList({
  proposals,
  selectedIndex = -1,
}: AlternativesListProps): ReactNode {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text bold>Alternative commands:</Text>
      </Box>

      {proposals.map((proposal, i) => (
        <Box key={i} marginBottom={1}>
          <CompactCommand
            command={proposal.command}
            index={i}
            selected={i === selectedIndex}
          />
        </Box>
      ))}

      <Box marginTop={1}>
        <Text dimColor>Press 1-{proposals.length} to select, or [5] Cancel</Text>
      </Box>
    </Box>
  );
}
