import { chapterTitle, loadChapter, nearestHeading, resolveInitialBlock } from '@/lib/chapters';
import { alpha } from '@/test-utils/fixtures';

jest.mock('@/content/chapters', () => require('@/test-utils/fixtures').chaptersModule);

it('loads known chapters only', () => {
  expect(loadChapter('Alpha')?.slug).toBe('Alpha');
  expect(loadChapter('Nope')).toBeNull();
  expect(loadChapter(undefined)).toBeNull();
  expect(loadChapter('constructor')).toBeNull();
});

it('titles from the toc, falling back to the slug', () => {
  const t = (k: string) => `T:${k}`;
  expect(chapterTitle('Water', t)).toBe('T:water');
  expect(chapterTitle('Alpha', t)).toBe('Alpha');
});

it('finds the nearest heading at or above a block', () => {
  expect(nearestHeading(alpha, 3)).toBe('Purify');
  expect(nearestHeading(alpha, 1)).toBe('Alpha intro');
  expect(nearestHeading(alpha, 99)).toBe('Purify');
});

describe('resolveInitialBlock', () => {
  it('prefers a valid block param', () => expect(resolveInitialBlock(alpha, { block: '4' }, null)).toBe(4));
  it('ignores malformed or out-of-range block params', () => {
    expect(resolveInitialBlock(alpha, { block: 'abc' }, null)).toBe(0);
    expect(resolveInitialBlock(alpha, { block: '-3' }, null)).toBe(0);
    expect(resolveInitialBlock(alpha, { block: '99' }, null)).toBe(0);
  });
  it('uses named anchors, ignoring unknown ones', () => {
    expect(resolveInitialBlock(alpha, { anchor: 'purify' }, null)).toBe(2);
    expect(resolveInitialBlock(alpha, { anchor: 'nope' }, null)).toBe(0);
    expect(resolveInitialBlock(alpha, { anchor: 'constructor' }, null)).toBe(0);
    expect(resolveInitialBlock(alpha, { anchor: '__proto__' }, null)).toBe(0);
  });
  it('restores the last position only for the same chapter and clamps stale indexes', () => {
    expect(resolveInitialBlock(alpha, {}, { slug: 'Alpha', blockIndex: 3 })).toBe(3);
    expect(resolveInitialBlock(alpha, {}, { slug: 'Alpha', blockIndex: 500 })).toBe(5);
    expect(resolveInitialBlock(alpha, {}, { slug: 'Beta', blockIndex: 3 })).toBe(0);
  });
});
