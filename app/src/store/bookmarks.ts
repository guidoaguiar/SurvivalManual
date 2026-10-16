import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistConfig } from './persistConfig';

export type Bookmark = { id: string; slug: string; blockIndex: number; label?: string; createdAt: number };
type BookmarksState = { items: Bookmark[]; toggle: (slug: string, blockIndex: number, label?: string) => void; remove: (id: string) => void };

export const bookmarkId = (slug: string, blockIndex: number) => `${slug}#${blockIndex}`;

export const useBookmarks = create<BookmarksState>()(
  persist(
    (set) => ({
      items: [],
      toggle: (slug, blockIndex, label) =>
        set((s) => {
          const id = bookmarkId(slug, blockIndex);
          return s.items.some((b) => b.id === id)
            ? { items: s.items.filter((b) => b.id !== id) }
            : { items: [...s.items, { id, slug, blockIndex, label, createdAt: Date.now() }] };
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((b) => b.id !== id) })),
    }),
    persistConfig<BookmarksState>('bookmarks'),
  ),
);
