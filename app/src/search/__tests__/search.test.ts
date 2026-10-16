import MiniSearch from 'minisearch';
import { indexOptions } from '@/search/options';
import { searchManual } from '@/search/search';
import type { SearchDoc } from '@/types/content';

const docs: SearchDoc[] = [
  { id: 'Water#0', slug: 'Water', block: 0, heading: 'Water', body: 'Purification of water by boiling' },
  { id: 'Water#5', slug: 'Water', block: 5, heading: 'Filters', body: 'Improvised water filters' },
  { id: 'Fire#0', slug: 'Fire', block: 0, heading: 'Fire', body: 'Boil water over fire' },
];
const small = () => {
  const m = new MiniSearch<SearchDoc>(indexOptions);
  m.addAll(docs);
  return m;
};

it('groups sections by chapter in score order', () => {
  const res = searchManual('water', small());
  expect(res.map((g) => g.slug)).toEqual(['Water', 'Fire']);
  expect(res[0].sections.map((s) => s.block)).toEqual([0, 5]);
  expect(res[0].sections[0].excerpt).toContain('water');
});

it('falls back to OR when AND finds nothing', () => {
  expect(searchManual('filters fire', small()).map((g) => g.slug).sort()).toEqual(['Fire', 'Water']);
});

it('returns nothing for blank or punctuation-only queries', () => {
  expect(searchManual('   ', small())).toEqual([]);
  expect(searchManual('(', small())).toEqual([]);
  expect(() => searchManual('c++', small())).not.toThrow();
});

it('ranks the Water chapter first for "water purification" in the real manual', () => {
  expect(searchManual('water purification')[0].slug).toBe('Water');
});
