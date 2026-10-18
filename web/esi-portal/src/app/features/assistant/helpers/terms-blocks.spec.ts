import { toTermsBlocks } from './terms-blocks';

describe('toTermsBlocks', () => {
  it('splits Markdown terms into headings, notes, paragraphs and lists as plain text', () => {
    const blocks = toTermsBlocks(
      '# Terms (draft)\n\n> Draft, not approved.\n\n## 1. Authority\nYou are\nauthorized.\n\n- Read only\n- Local <script>x</script>',
    );

    expect(blocks).toEqual([
      { kind: 'heading', level: 1, text: 'Terms (draft)' },
      { kind: 'note', text: 'Draft, not approved.' },
      { kind: 'heading', level: 2, text: '1. Authority' },
      { kind: 'paragraph', text: 'You are authorized.' },
      { kind: 'list', items: ['Read only', 'Local <script>x</script>'] },
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(toTermsBlocks('')).toEqual([]);
  });
});
