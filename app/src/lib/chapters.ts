import { chapterLoaders } from '@/content/chapters';
import { blockText } from '@/lib/blockText';
import type { LastPosition } from '@/store/reading';
import { tocBySlug } from '@/toc';
import type { Chapter } from '@/types/content';

export function loadChapter(slug: string | undefined): Chapter | null {
  if (!slug) return null;
  const load = chapterLoaders[slug];
  return load ? load() : null;
}

export function chapterTitle(slug: string, t: (key: string) => string): string {
  const entry = tocBySlug.get(slug);
  return entry ? t(entry.titleKey) : slug;
}

export function nearestHeading(chapter: Chapter, index: number): string | undefined {
  for (let i = Math.min(index, chapter.blocks.length - 1); i >= 0; i--) {
    const b = chapter.blocks[i];
    if (b.type === 'heading') return blockText(b);
  }
  return undefined;
}

export function resolveInitialBlock(chapter: Chapter, params: { block?: string; anchor?: string }, last: LastPosition | null): number {
  const max = chapter.blocks.length - 1;
  if (params.block != null && /^\d+$/.test(params.block)) {
    const n = Number(params.block);
    if (n <= max) return n;
  }
  if (params.anchor && chapter.anchors[params.anchor] !== undefined) return chapter.anchors[params.anchor];
  if (last?.slug === chapter.slug) return Math.max(0, Math.min(last.blockIndex, max));
  return 0;
}
