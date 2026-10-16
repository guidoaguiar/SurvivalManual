import type { Options, SearchOptions } from 'minisearch';
import type { SearchDoc } from '@/types/content';

// Case- and accent-insensitive comparison key. Shared by indexing, querying and highlighting.
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const indexOptions: Options<SearchDoc> = {
  idField: 'id',
  fields: ['heading', 'body'],
  storeFields: ['slug', 'block', 'heading', 'body'],
  processTerm: (term) => fold(term),
};

export const queryOptions: SearchOptions = { prefix: true, fuzzy: 0.2, boost: { heading: 2 } };
