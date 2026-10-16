import { fireEvent, render, screen } from '@testing-library/react-native';
import { BlockView } from '@/render/BlockView';
import { RenderProvider, type RenderCtx } from '@/render/RenderContext';
import { palettes } from '@/theme';
import type { Block } from '@/types/content';

jest.mock('@/content/images', () => require('@/test-utils/fixtures').imagesModule);

const ctx = (over: Partial<RenderCtx> = {}): RenderCtx => ({ fontSize: 16, colors: palettes.day, terms: [], onLink: jest.fn(), onImage: jest.fn(), ...over });
const show = (block: Block, value = ctx()) => {
  render(
    <RenderProvider value={value}>
      <BlockView block={block} />
    </RenderProvider>,
  );
  return value;
};
const text = (value: string) => ({ type: 'text' as const, value });

it('renders headings as headers', () => {
  show({ type: 'heading', depth: 2, children: [text('Water')] });
  expect(screen.getByRole('header')).toHaveTextContent('Water');
});

it('renders inline formatting', () => {
  show({ type: 'paragraph', children: [text('Some '), { type: 'strong', children: [text('bold')] }, text(' and '), { type: 'emphasis', children: [text('em')] }] });
  expect(screen.getByText('bold')).toHaveStyle({ fontWeight: 'bold' });
  expect(screen.getByText('em')).toHaveStyle({ fontStyle: 'italic' });
});

it('calls onLink with the href', () => {
  const c = show({ type: 'paragraph', children: [{ type: 'link', href: '/chapter/Beta', children: [text('Beta')] }] });
  fireEvent.press(screen.getByText('Beta'));
  expect(c.onLink).toHaveBeenCalledWith('/chapter/Beta');
});

it('numbers ordered lists from start', () => {
  show({ type: 'list', ordered: true, start: 3, items: [[{ type: 'paragraph', children: [text('a')] }], [{ type: 'paragraph', children: [text('b')] }]] });
  expect(screen.getByText('3.')).toBeVisible();
  expect(screen.getByText('4.')).toBeVisible();
});

it('renders blockquotes, tables and code', () => {
  show({ type: 'blockquote', children: [{ type: 'paragraph', children: [text('quoted')] }] });
  expect(screen.getByText('quoted')).toBeVisible();
  show({ type: 'table', header: true, rows: [[[{ type: 'paragraph', children: [text('h')] }]], [[{ type: 'paragraph', children: [text('cell')] }]]] });
  expect(screen.getByText('cell')).toBeVisible();
  show({ type: 'code', value: 'x = 1' });
  expect(screen.getByText('x = 1')).toBeVisible();
});

it('opens known images and skips unknown ones', () => {
  const c = show({ type: 'image', src: 'a.png', alt: 'Figure 1' });
  fireEvent.press(screen.getByLabelText('Figure 1'));
  expect(c.onImage).toHaveBeenCalledWith('a.png');
  show({ type: 'image', src: 'missing.png', alt: 'Gone' });
  expect(screen.queryByLabelText('Gone')).toBeNull();
});

it('highlights search terms', () => {
  show({ type: 'paragraph', children: [text('Boil Water now')] }, ctx({ terms: ['water'] }));
  expect(screen.getAllByTestId('hl').map((n) => n.props.children)).toEqual(['Water']);
});

it('scales the list marker column with font size', () => {
  const items = Array.from({ length: 12 }, (_, i) => [{ type: 'paragraph' as const, children: [text(`item${i}`)] }]);
  show({ type: 'list', ordered: true, start: 1, items }, ctx({ fontSize: 24 }));
  expect(screen.getByText('12.')).toHaveStyle({ width: 48 });
});
