import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContent } from '../build-content.mjs';
import { sectionsOf } from './sections.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function setup(files: Record<string, string | Buffer>) {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  const src = join(dir, 'md');
  mkdirSync(src);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(src, name), body);
  return { src, out: join(dir, 'out'), imgOut: join(dir, 'img') };
}
const input = (dirs: ReturnType<typeof setup>, slugs = ['Alpha', 'Beta']) => ({
  ...dirs,
  slugs,
  titles: { Alpha: 'Alpha', Beta: 'Beta' },
  ignored: ['LifeStraw'],
});

test('builds chapters, loaders, images and index', () => {
  const dirs = setup({ 'Alpha.md': '# A\n\nWater [b](Beta) [ls](LifeStraw)\n\n![Fig](pic.png)', 'Beta.md': 'Fire', 'pic.png': PNG });
  const { warnings } = buildContent(input(dirs));
  assert.deepEqual(warnings, []);
  assert.ok(existsSync(join(dirs.out, 'chapters', 'Alpha.json')));
  assert.match(readFileSync(join(dirs.out, 'chapters.ts'), 'utf8'), /"Beta": \(\) => require\("\.\/chapters\/Beta\.json"\)/);
  const images = readFileSync(join(dirs.out, 'images.ts'), 'utf8');
  assert.match(images, /"pic\.png": \{ source: require\(".*pic\.png"\), width: 1, height: 1 \}/);
  assert.ok(existsSync(join(dirs.imgOut, 'pic.png')));
  assert.ok(JSON.parse(readFileSync(join(dirs.out, 'search-index.json'), 'utf8')).documentCount >= 2);
});

test('fails on a missing chapter file, missing image or unknown link', () => {
  const dirs = setup({ 'Alpha.md': '![x](nope.png) [z](Zeta)' });
  assert.throws(() => buildContent(input(dirs)), (e: Error) => {
    assert.match(e.message, /Beta: missing markdown file/);
    assert.match(e.message, /Alpha: missing image "nope\.png"/);
    assert.match(e.message, /Alpha: link to unknown chapter "Zeta"/);
    return true;
  });
});

test('unknown anchors are warnings', () => {
  const dirs = setup({ 'Alpha.md': '[x](Beta#nowhere)', 'Beta.md': 'b' });
  assert.deepEqual(buildContent(input(dirs)).warnings, ['Alpha: link to unknown anchor "Beta#nowhere" (opens at top)']);
});

test('sections split at headings; text before the first heading uses the chapter title', () => {
  const docs = sectionsOf(
    { slug: 'S', anchors: {}, blocks: [
      { type: 'paragraph', children: [{ type: 'text', value: 'lead' }] },
      { type: 'heading', depth: 2, children: [{ type: 'text', value: 'H' }] },
      { type: 'paragraph', children: [{ type: 'text', value: 'one' }] },
      { type: 'paragraph', children: [{ type: 'text', value: 'two' }] },
    ] },
    'Title',
  );
  assert.deepEqual(docs, [
    { id: 'S#0', slug: 'S', block: 0, heading: 'Title', body: 'lead' },
    { id: 'S#1', slug: 'S', block: 1, heading: 'H', body: 'one\ntwo' },
  ]);
});
