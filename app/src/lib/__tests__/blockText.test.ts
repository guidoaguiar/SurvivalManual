import { blockText, inlineText } from '@/lib/blockText';
import type { Block } from '@/types/content';

it('flattens inline formatting', () => {
  expect(
    inlineText([
      { type: 'text', value: 'Boil ' },
      { type: 'strong', children: [{ type: 'text', value: 'water' }] },
      { type: 'break' },
      { type: 'link', href: '/chapter/Fire', children: [{ type: 'text', value: 'fire' }] },
      { type: 'image', src: 'a.png', alt: 'Figure' },
    ]),
  ).toBe('Boil water\nfireFigure');
});

it('flattens nested blocks', () => {
  const list: Block = {
    type: 'list',
    ordered: false,
    start: 1,
    items: [[{ type: 'paragraph', children: [{ type: 'text', value: 'a' }] }], [{ type: 'code', value: 'b' }]],
  };
  const table: Block = {
    type: 'table',
    header: true,
    rows: [[[{ type: 'paragraph', children: [{ type: 'text', value: 'x' }] }], [{ type: 'paragraph', children: [{ type: 'text', value: 'y' }] }]]],
  };
  expect(blockText(list)).toBe('a\nb');
  expect(blockText(table)).toBe('x | y');
  expect(blockText({ type: 'thematicBreak' })).toBe('');
  expect(blockText({ type: 'image', src: 'a.png', alt: 'Alt' })).toBe('Alt');
});
