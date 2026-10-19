import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertMarkdown } from './convert.mjs';

const conv = (md: string, slug = 'Cur') => convertMarkdown(slug, md);

test('headings get anchors and are indexed', () => {
  const { chapter } = conv('# Water Sources\n\nSome text');
  assert.deepEqual(chapter.blocks[0], { type: 'heading', depth: 1, anchor: 'water-sources', children: [{ type: 'text', value: 'Water Sources' }] });
  assert.equal(chapter.anchors['water-sources'], 0);
  assert.equal(chapter.blocks[1].type, 'paragraph');
});

test('soft line breaks collapse to spaces', () => {
  const { chapter } = conv('a\nb');
  assert.deepEqual(chapter.blocks, [{ type: 'paragraph', children: [{ type: 'text', value: 'a b' }] }]);
});

test('inline formatting', () => {
  const { chapter } = conv('**b** _e_ ~~d~~ `c`');
  const p = chapter.blocks[0];
  assert.equal(p.type, 'paragraph');
  if (p.type !== 'paragraph') return;
  assert.deepEqual(p.children.map((n) => n.type), ['strong', 'text', 'emphasis', 'text', 'delete', 'text', 'inlineCode']);
});

test('nested and ordered lists', () => {
  const { chapter } = conv('3. one\n4. two\n\n* a\n  * b');
  const [ol, ul] = chapter.blocks;
  assert.equal(ol.type === 'list' && ol.ordered && ol.start, 3);
  assert.ok(ul.type === 'list' && !ul.ordered);
  if (ul.type !== 'list') return;
  assert.equal(ul.items[0][0].type, 'paragraph');
  assert.equal(ul.items[0][1].type, 'list');
});

test('gfm table', () => {
  const { chapter } = conv('| h1 | h2 |\n|----|----|\n| a | b |');
  const t = chapter.blocks[0];
  assert.ok(t.type === 'table' && t.header);
  if (t.type !== 'table') return;
  assert.equal(t.rows.length, 2);
  assert.deepEqual(t.rows[1][0], [{ type: 'paragraph', children: [{ type: 'text', value: 'a' }] }]);
});

test('raw HTML table with a list in a cell', () => {
  const { chapter } = conv('<table><tr><td><ul><li>x</li></ul></td></tr></table>');
  const t = chapter.blocks[0];
  assert.ok(t.type === 'table' && !t.header);
  if (t.type !== 'table') return;
  assert.equal(t.rows[0][0][0].type, 'list');
});

test('standalone <a name> anchors point at the next block; image-only paragraphs become image blocks', () => {
  const { chapter, images } = conv('Intro\n\n<a name="fig7-4"></a>\n\n![Figure 7-4\\. Thing](fig07-04.png) ![Second](b.png)');
  assert.deepEqual(chapter.blocks.slice(1), [
    { type: 'image', src: 'fig07-04.png', alt: 'Figure 7-4. Thing' },
    { type: 'image', src: 'b.png', alt: 'Second' },
  ]);
  assert.equal(chapter.anchors['fig7-4'], 1);
  assert.deepEqual(images.sort(), ['b.png', 'fig07-04.png']);
});

test('inline anchors point at their own block', () => {
  const { chapter } = conv('First\n\nText <a name="x"></a> more');
  assert.equal(chapter.anchors.x, 1);
});

test('links: internal, same-page anchor, external, image', () => {
  const { chapter, links } = conv('[Food](Food) [f](#fig8-24) [w](https://x.org) [img](pic.png)');
  const p = chapter.blocks[0];
  if (p.type !== 'paragraph') return assert.fail('expected paragraph');
  const hrefs = p.children.flatMap((n) => (n.type === 'link' ? [n.href] : []));
  assert.deepEqual(hrefs, ['/chapter/Food', '/chapter/Cur?anchor=fig8-24', 'https://x.org', '/image/pic.png']);
  assert.deepEqual(links, [{ slug: 'Food', anchor: undefined }, { slug: 'Cur', anchor: 'fig8-24' }]);
});

test('wrapper elements are unwrapped', () => {
  const { chapter } = conv('<center><font color="#fff">Hi</font></center>');
  assert.deepEqual(chapter.blocks, [{ type: 'paragraph', children: [{ type: 'text', value: 'Hi' }] }]);
});

test('blockquote, code and rule', () => {
  const { chapter } = conv('> quoted\n\n```\nx = 1\n```\n\n---');
  assert.deepEqual(chapter.blocks.map((b) => b.type), ['blockquote', 'code', 'thematicBreak']);
  assert.deepEqual(chapter.blocks[1], { type: 'code', value: 'x = 1' });
});
