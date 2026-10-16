import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildContent, findLanguages } from '../build-content.mjs';
import { sectionsOf } from './sections.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function setup(files: Record<string, string | Buffer>) {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  const src = join(dir, 'md');
  mkdirSync(src);
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(dirname(join(src, name)), { recursive: true });
    writeFileSync(join(src, name), body);
  }
  return { src, out: join(dir, 'out'), imgOut: join(dir, 'img') };
}
const input = (dirs: ReturnType<typeof setup>, slugs = ['Alpha', 'Beta']) => ({
  ...dirs,
  slugs,
  titles: { en: { Alpha: 'Alpha', Beta: 'Beta' }, 'pt-BR': { Alpha: 'Alfa', Beta: 'Beta' } },
  ignored: ['LifeStraw'],
});
const read = (p: string) => readFileSync(p, 'utf8');

test('builds English chapters, loaders, images and index', () => {
  const dirs = setup({ 'Alpha.md': '# A\n\nWater [b](Beta) [ls](LifeStraw)\n\n![Fig](pic.png)', 'Beta.md': 'Fire', 'pic.png': PNG });
  const { warnings, languages } = buildContent(input(dirs));
  assert.deepEqual(warnings, []);
  assert.deepEqual(languages, ['en']);
  assert.ok(existsSync(join(dirs.out, 'en', 'chapters', 'Alpha.json')));
  assert.match(read(join(dirs.out, 'chapters.ts')), /"en": \{[^}]*"Beta": \(\) => require\("\.\/en\/chapters\/Beta\.json"\)/s);
  assert.match(read(join(dirs.out, 'search-indexes.ts')), /"en": \(\) => require\("\.\/en\/search-index\.json"\)/);
  assert.match(read(join(dirs.out, 'manifest.ts')), /contentLanguages: string\[\] = \["en"\]/);
  assert.match(read(join(dirs.out, 'images.ts')), /"pic\.png": \{ source: require\(".*pic\.png"\), width: 1, height: 1 \}/);
  assert.ok(existsSync(join(dirs.imgOut, 'pic.png')));
  assert.ok(JSON.parse(read(join(dirs.out, 'en', 'search-index.json'))).documentCount >= 2);
});

test('builds translations with English fallback and shared root images', () => {
  const dirs = setup({
    'Alpha.md': '# A\n\n<a name="fig1"></a>![F](pic.png)\n\nWater',
    'Beta.md': 'Fire',
    'pic.png': PNG,
    'pt-BR/Alpha.md': '# A\n\n<a name="fig1"></a>![F](pic.png)\n\nÁgua',
  });
  const { warnings, languages } = buildContent(input(dirs));
  assert.deepEqual(warnings, []);
  assert.deepEqual(languages, ['en', 'pt-BR']);
  assert.match(read(join(dirs.out, 'pt-BR', 'chapters', 'Alpha.json')), /Água/);
  assert.ok(!existsSync(join(dirs.out, 'pt-BR', 'chapters', 'Beta.json')), 'fallback chapters are not copied');
  const loaders = read(join(dirs.out, 'chapters.ts'));
  assert.match(loaders, /"pt-BR": \{[^}]*"Alpha": \(\) => require\("\.\/pt-BR\/chapters\/Alpha\.json"\)/s);
  assert.match(loaders, /"pt-BR": \{[^}]*"Beta": \(\) => require\("\.\/en\/chapters\/Beta\.json"\)/s);
  assert.match(read(join(dirs.out, 'manifest.ts')), /translated: Record<string, string\[\]> = \{"pt-BR":\["Alpha"\]\}/);
  const ptIndex = read(join(dirs.out, 'pt-BR', 'search-index.json'));
  assert.match(ptIndex, /Água/);
  assert.match(ptIndex, /Fire/, 'fallback chapters are searchable in the translated index');
});

test('validates translations with a language prefix and warns on dropped figure anchors', () => {
  const dirs = setup({
    'Alpha.md': '<a name="fig1"></a>![F](pic.png)',
    'Beta.md': 'Fire',
    'pic.png': PNG,
    'pt-BR/Alpha.md': '![F](nope.png) [x](Beta#nowhere)',
  });
  assert.throws(() => buildContent(input(dirs)), (e: Error) => {
    assert.match(e.message, /pt-BR\/Alpha: missing image "nope\.png"/);
    assert.doesNotMatch(e.message, /^Alpha: missing image/m);
    return true;
  });
  const ok = setup({ 'Alpha.md': '<a name="fig1"></a>![F](pic.png)', 'Beta.md': 'Fire', 'pic.png': PNG, 'pt-BR/Alpha.md': 'Sem figura [x](Beta#nowhere)' });
  assert.deepEqual(buildContent(input(ok)).warnings, [
    'pt-BR/Alpha: missing figure anchors present in English: fig1',
    'pt-BR/Alpha: link to unknown anchor "Beta#nowhere" (opens at top)',
  ]);
});

test('only language-shaped folders with markdown count as languages', () => {
  const dirs = setup({
    'Alpha.md': 'a',
    'pt-BR/Alpha.md': 'a',
    'fr/Alpha.md': 'a',
    'images/x.md': 'not a language',
    'xx/readme.txt': 'no markdown',
    'Pt-br/Alpha.md': 'wrong case',
  });
  assert.deepEqual(findLanguages(dirs.src), ['fr', 'pt-BR']);
});

test('fails on a missing English chapter file or unknown link', () => {
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

test('generates a locales module from the locales folder', () => {
  const dirs = setup({ 'Alpha.md': 'a', 'Beta.md': 'b' });
  const localesDir = join(dirname(dirs.src), 'locales');
  mkdirSync(localesDir);
  writeFileSync(join(localesDir, 'en.json'), '{"language_name":"English"}');
  writeFileSync(join(localesDir, 'pt-BR.json'), '{"language_name":"Português (Brasil)"}');
  writeFileSync(join(localesDir, 'notes.txt'), 'ignored');
  buildContent({ ...input(dirs), localesDir });
  const mod = read(join(dirs.out, 'locales.ts'));
  assert.match(mod, /"en": require\(".*locales\/en\.json"\)/);
  assert.match(mod, /"pt-BR": require\(".*locales\/pt-BR\.json"\)/);
  assert.doesNotMatch(mod, /notes/);
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
