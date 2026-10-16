import MiniSearch from 'minisearch';
import { searchIndexes } from '@/content/search-indexes';
import type { SearchDoc } from '@/types/content';
import { excerpt, queryTerms } from './highlight';
import { indexOptions, queryOptions } from './options';

export type SectionHit = { slug: string; block: number; heading: string; excerpt: string };
export type ChapterHits = { slug: string; sections: SectionHit[] };

const cache = new Map<string, MiniSearch<SearchDoc>>();

export function loadIndex(lang = 'en'): MiniSearch<SearchDoc> {
  const key = Object.prototype.hasOwnProperty.call(searchIndexes, lang) ? lang : 'en';
  let idx = cache.get(key);
  if (!idx) {
    idx = MiniSearch.loadJSON<SearchDoc>(JSON.stringify(searchIndexes[key]()), indexOptions);
    cache.set(key, idx);
  }
  return idx;
}

export function searchManual(q: string, index?: MiniSearch<SearchDoc>): ChapterHits[] {
  const terms = queryTerms(q);
  if (!terms.length) return [];
  const idx = index ?? loadIndex();
  let results = idx.search(q, { ...queryOptions, combineWith: 'AND' });
  if (!results.length) results = idx.search(q, { ...queryOptions, combineWith: 'OR' });
  const groups = new Map<string, ChapterHits>();
  for (const r of results) {
    const slug = r.slug as string;
    let g = groups.get(slug);
    if (!g) {
      g = { slug, sections: [] };
      groups.set(slug, g);
    }
    g.sections.push({ slug, block: r.block as number, heading: r.heading as string, excerpt: excerpt(r.body as string, terms) });
  }
  return [...groups.values()];
}
