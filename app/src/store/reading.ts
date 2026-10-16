import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistConfig } from './persistConfig';

export type LastPosition = { slug: string; blockIndex: number };
type ReadingState = { last: LastPosition | null; recents: string[]; setLast: (slug: string, blockIndex: number) => void; visit: (slug: string) => void };

export const useReading = create<ReadingState>()(
  persist(
    (set) => ({
      last: null,
      recents: [],
      setLast: (slug, blockIndex) => set({ last: { slug, blockIndex } }),
      visit: (slug) => set((s) => ({ recents: [slug, ...s.recents.filter((r) => r !== slug)].slice(0, 10) })),
    }),
    persistConfig<ReadingState>('reading'),
  ),
);
