import { chapterLoaders } from '@/content/chapters';
import { currentLanguage } from '@/i18n';
import { blockText } from '@/lib/blockText';
import type { LastPosition } from '@/store/reading';
import { tocBySlug } from '@/toc';
import type { Chapter } from '@/types/content';

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function loadChapter(slug: string | undefined, lang = currentLanguage()): Chapter | null {
  if (!slug) return null;
  const set = has(chapterLoaders, lang) ? chapterLoaders[lang] : chapterLoaders.en;
  return has(set, slug) ? set[slug]() : null;
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
  if (params.anchor && has(chapter.anchors, params.anchor)) {
    const a = chapter.anchors[params.anchor];
    if (typeof a === 'number') return a;
  }
  if (last?.slug === chapter.slug) return Math.max(0, Math.min(last.blockIndex, max));
  return 0;
}
