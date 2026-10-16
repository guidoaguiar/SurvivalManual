import MiniSearch from 'minisearch';
import { fold } from './options';

export type Run = { text: string; match: boolean };

const tokenize: (text: string) => string[] = MiniSearch.getDefault('tokenize');

export function queryTerms(q: string): string[] {
  return tokenize(q).filter(Boolean);
}

export function splitHighlights(text: string, terms: string[]): Run[] {
  const folded = terms.map(fold).filter(Boolean);
  if (!folded.length || !text) return [{ text, match: false }];
  // Build the folded text plus a map from folded index to original index.
  let haystack = '';
  const map: number[] = [];
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    const f = fold(ch);
    for (let k = 0; k < f.length; k++) map.push(i);
    haystack += f;
    i += ch.length;
  }
  map.push(text.length);
  const ranges: [number, number][] = [];
  for (const term of folded) {
    for (let at = haystack.indexOf(term); at !== -1; at = haystack.indexOf(term, at + term.length)) {
      ranges.push([map[at], map[at + term.length]]);
    }
  }
  if (!ranges.length) return [{ text, match: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const runs: Run[] = [];
  let pos = 0;
  for (const [s, e] of ranges) {
    if (e <= pos) continue;
    const start = Math.max(s, pos);
    if (start > pos) runs.push({ text: text.slice(pos, start), match: false });
    runs.push({ text: text.slice(start, e), match: true });
    pos = e;
  }
  if (pos < text.length) runs.push({ text: text.slice(pos), match: false });
  return runs;
}

export function excerpt(text: string, terms: string[], size = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= size) return flat;
  const f = fold(flat);
  let at = -1;
  for (const t of terms.map(fold).filter(Boolean)) {
    const i = f.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) at = 0;
  let start = Math.max(0, at - Math.floor(size / 3));
  let end = Math.min(flat.length, start + size);
  start = Math.max(0, end - size);
  if (start > 0) {
    const sp = flat.indexOf(' ', start);
    if (sp !== -1 && sp < at) start = sp + 1;
  }
  if (end < flat.length) {
    const sp = flat.lastIndexOf(' ', end);
    if (sp > at) end = sp;
  }
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}
