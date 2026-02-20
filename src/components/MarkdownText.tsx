/**
 * Markdown rendering component - renders markdown string as ANSI-styled terminal output
 */
import { useTheme } from '../theme/index.js';
import { createMarkdownRenderer } from '../lib/markdown.js';

import { Text } from 'ink';
import { useMemo, type ReactNode } from 'react';

interface MarkdownTextProps {
  children: string;
}

export function MarkdownText({ children }: MarkdownTextProps): ReactNode {
  const theme = useTheme();

  const renderer = useMemo(() => createMarkdownRenderer(theme), [theme]);

  const rendered = useMemo(() => renderer(children), [renderer, children]);

  return <Text>{rendered}</Text>;
}
