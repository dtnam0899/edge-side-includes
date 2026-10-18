/** A block of the consent terms text; rendered by the template as text (never as HTML). */
export type TermsBlock =
  | { readonly kind: 'heading'; readonly level: 1 | 2 | 3; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'note'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] };

/**
 * Splits the Markdown terms into headings, paragraphs, notes (block quotes) and bullet lists. Inline Markdown is
 * kept as plain text; this is enough for the terms and avoids rendering server text as HTML.
 */
export function toTermsBlocks(markdown: string): TermsBlock[] {
  const blocks: TermsBlock[] = [];
  let paragraph: string[] = [];
  let note: string[] = [];
  let list: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    if (note.length) blocks.push({ kind: 'note', text: note.join(' ') });
    if (list.length) blocks.push({ kind: 'list', items: list });
    paragraph = [];
    note = [];
    list = [];
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({
        kind: 'heading',
        level: Math.min(heading[1].length, 3) as 1 | 2 | 3,
        text: heading[2],
      });
    } else if (line.startsWith('>')) {
      if (paragraph.length || list.length) flush();
      note.push(line.replace(/^>\s?/, ''));
    } else if (bullet) {
      if (paragraph.length || note.length) flush();
      list.push(bullet[1]);
    } else if (list.length && raw.startsWith(' ')) {
      list[list.length - 1] += ` ${line}`;
    } else {
      if (note.length || list.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
