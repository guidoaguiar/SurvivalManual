import { blockText } from '../../src/lib/blockText';
import type { Chapter, SearchDoc } from '../../src/types/content';

export function sectionsOf(chapter: Chapter, title: string): SearchDoc[] {
  const docs: SearchDoc[] = [];
  let cur: SearchDoc | undefined;
  for (let i = 0; i < chapter.blocks.length; i++) {
    const b = chapter.blocks[i];
    if (b.type === 'heading') {
      cur = { id: `${chapter.slug}#${i}`, slug: chapter.slug, block: i, heading: blockText(b), body: '' };
      docs.push(cur);
      continue;
    }
    if (!cur) {
      cur = { id: `${chapter.slug}#0`, slug: chapter.slug, block: 0, heading: title, body: '' };
      docs.push(cur);
    }
    const text = blockText(b).trim();
    if (text) cur.body = cur.body ? `${cur.body}\n${text}` : text;
  }
  return docs;
}
