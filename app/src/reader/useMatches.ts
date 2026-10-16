import { useMemo } from 'react';
import { blockText } from '@/lib/blockText';
import { fold } from '@/search/options';
import type { Block } from '@/types/content';

export function findMatches(texts: string[], terms: string[]): number[] {
  const folded = terms.map(fold).filter(Boolean);
  if (!folded.length) return [];
  return texts.flatMap((text, i) => {
    const f = fold(text);
    return folded.some((t) => f.includes(t)) ? [i] : [];
  });
}

export function useMatches(blocks: Block[], terms: string[]): number[] {
  const texts = useMemo(() => blocks.map(blockText), [blocks]);
  return useMemo(() => findMatches(texts, terms), [texts, terms]);
}
