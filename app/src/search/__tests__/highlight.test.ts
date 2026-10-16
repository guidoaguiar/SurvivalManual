import { excerpt, queryTerms, splitHighlights } from '@/search/highlight';

const marked = (text: string, terms: string[]) =>
  splitHighlights(text, terms).map((r) => (r.match ? `[${r.text}]` : r.text)).join('');

describe('splitHighlights', () => {
  it('matches case-insensitively', () => expect(marked('Boil Water now', ['water'])).toBe('Boil [Water] now'));
  it('matches accents both ways', () => {
    expect(marked('Café au lait', ['cafe'])).toBe('[Café] au lait');
    expect(marked('Cafe', ['café'])).toBe('[Cafe]');
  });
  it('merges overlapping terms', () => expect(marked('waterproof', ['water', 'terpro'])).toBe('[water][pro]of'));
  it('returns one plain run without terms', () => expect(splitHighlights('abc', [])).toEqual([{ text: 'abc', match: false }]));
  it('handles empty text', () => expect(splitHighlights('', ['a'])).toEqual([{ text: '', match: false }]));
  it('treats regex characters literally', () => expect(marked('use c++ (rarely)', ['c++', '('])).toBe('use [c++] [(]rarely)'));
  it('preserves the original text', () => {
    const text = 'Ñandú und Größe';
    expect(splitHighlights(text, ['nandu', 'grosse']).map((r) => r.text).join('')).toBe(text);
  });
});

describe('excerpt', () => {
  const long = `${'lorem '.repeat(60)}purification of water ${'ipsum '.repeat(60)}`;
  it('centres on the first match and adds ellipses', () => {
    const e = excerpt(long, ['purification'], 80);
    expect(e).toContain('purification');
    expect(e.startsWith('…')).toBe(true);
    expect(e.endsWith('…')).toBe(true);
    expect(e.length).toBeLessThanOrEqual(82);
  });
  it('returns short text unchanged', () => expect(excerpt('short text', ['x'])).toBe('short text'));
  it('starts at the beginning without a match', () => expect(excerpt(long, ['zzz'], 40).startsWith('lorem')).toBe(true));
});

describe('queryTerms', () => {
  it('splits on spaces and punctuation', () => expect(queryTerms('  water, fire  ')).toEqual(['water', 'fire']));
  it('returns nothing for punctuation only', () => expect(queryTerms(' ( ) ')).toEqual([]));
});
