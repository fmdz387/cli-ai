/**
 * Markdown rendering pipeline using marked v15 custom renderer + cli-highlight
 */
import type { Theme } from '../theme/types.js';

import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import { Marked } from 'marked';

/**
 * Decode HTML entities that marked escapes internally.
 * Since we render to terminal (not HTML), we must unescape.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

export function createMarkdownRenderer(theme: Theme): (text: string) => string {
  const marked = new Marked();

  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        return '\n' + chalk.hex(theme.markdownHeading).bold(decodeEntities(text)) + '\n';
      },

      paragraph({ tokens }) {
        return decodeEntities(this.parser.parseInline(tokens)) + '\n';
      },

      strong({ tokens }) {
        return chalk.bold(decodeEntities(this.parser.parseInline(tokens)));
      },

      em({ tokens }) {
        return chalk.italic(decodeEntities(this.parser.parseInline(tokens)));
      },

      del({ tokens }) {
        return chalk.strikethrough(decodeEntities(this.parser.parseInline(tokens)));
      },

      codespan({ text }) {
        return chalk.hex(theme.markdownCode)(decodeEntities(text));
      },

      code({ text, lang }) {
        const decoded = decodeEntities(text);
        let highlighted: string;
        try {
          highlighted = lang
            ? highlight(decoded, { language: lang, ignoreIllegals: true })
            : highlight(decoded, { ignoreIllegals: true });
        } catch {
          highlighted = decoded;
        }
        return '\n' + highlighted + '\n';
      },

      blockquote({ tokens }) {
        const text = this.parser.parse(tokens);
        return chalk.hex(theme.markdownBlockquote).italic('\u2502 ' + decodeEntities(text).trim()) + '\n';
      },

      list({ items, ordered, start }) {
        // Render each item directly here using parser.parse on item tokens
        const lines: string[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i]!;
          const content = decodeEntities(this.parser.parse(item.tokens)).trim();
          if (ordered) {
            const num = (start || 1) + i;
            lines.push('  ' + chalk.hex(theme.primary)(`${num}.`) + ' ' + content);
          } else {
            lines.push('  ' + chalk.hex(theme.primary)('\u2022') + ' ' + content);
          }
        }
        return lines.join('\n') + '\n';
      },

      listitem({ tokens }) {
        // Fallback - list() handles items directly, but marked may still call this
        return decodeEntities(this.parser.parse(tokens)).trim();
      },

      link({ tokens, href }) {
        const text = this.parser.parseInline(tokens);
        return chalk.hex(theme.markdownLink).underline(decodeEntities(text));
      },

      hr() {
        return chalk.hex(theme.border)('\u2500'.repeat(50)) + '\n';
      },

      br() {
        return '\n';
      },

      html({ text }) {
        // Strip HTML tags for terminal output
        return decodeEntities(text.replace(/<[^>]*>/g, ''));
      },

      text(token) {
        if ('tokens' in token && token.tokens) {
          return decodeEntities(this.parser.parseInline(token.tokens));
        }
        return decodeEntities(token.text);
      },
    },
  });

  return (text: string): string => {
    try {
      const result = marked.parse(text) as string;
      return result.replace(/\n+$/, '');
    } catch {
      return text;
    }
  };
}
