import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newId } from '@/lib/id';
import { persistConfig } from './persistConfig';

export type ChecklistItem = { id: string; text: string; done: boolean };
export type Checklist = { id: string; title: string; templateId?: string; items: ChecklistItem[] };
type ChecklistsState = {
  lists: Checklist[];
  create: (title: string, items: string[], templateId?: string) => string;
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
  addItem: (id: string, text: string) => void;
  editItem: (id: string, itemId: string, text: string) => void;
  removeItem: (id: string, itemId: string) => void;
  toggle: (id: string, itemId: string) => void;
  reset: (id: string) => void;
};

const mapList = (lists: Checklist[], id: string, fn: (l: Checklist) => Checklist) => lists.map((l) => (l.id === id ? fn(l) : l));
const mapItems = (l: Checklist, fn: (i: ChecklistItem) => ChecklistItem) => ({ ...l, items: l.items.map(fn) });

export const useChecklists = create<ChecklistsState>()(
  persist(
    (set) => ({
      lists: [],
      create: (title, items, templateId) => {
        const id = newId();
        set((s) => ({ lists: [...s.lists, { id, title, templateId, items: items.map((text) => ({ id: newId(), text, done: false })) }] }));
        return id;
      },
      rename: (id, title) => set((s) => ({ lists: mapList(s.lists, id, (l) => ({ ...l, title })) })),
      remove: (id) => set((s) => ({ lists: s.lists.filter((l) => l.id !== id) })),
      addItem: (id, text) => set((s) => ({ lists: mapList(s.lists, id, (l) => ({ ...l, items: [...l.items, { id: newId(), text, done: false }] })) })),
      editItem: (id, itemId, text) => set((s) => ({ lists: mapList(s.lists, id, (l) => mapItems(l, (i) => (i.id === itemId ? { ...i, text } : i))) })),
      removeItem: (id, itemId) => set((s) => ({ lists: mapList(s.lists, id, (l) => ({ ...l, items: l.items.filter((i) => i.id !== itemId) })) })),
      toggle: (id, itemId) => set((s) => ({ lists: mapList(s.lists, id, (l) => mapItems(l, (i) => (i.id === itemId ? { ...i, done: !i.done } : i))) })),
      reset: (id) => set((s) => ({ lists: mapList(s.lists, id, (l) => mapItems(l, (i) => ({ ...i, done: false }))) })),
    }),
    persistConfig<ChecklistsState>('checklists'),
  ),
);
