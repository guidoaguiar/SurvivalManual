import type { PersistOptions, PersistStorage } from 'zustand/middleware';
import { kv } from './kv';

function safeStorage<T>(): PersistStorage<T> {
  return {
    getItem: async (name) => {
      try {
        const raw = await kv.getItem(name);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.warn(`[${name}] stored data unreadable, using defaults`, e);
        return null;
      }
    },
    setItem: async (name, value) => {
      try {
        await kv.setItem(name, JSON.stringify(value));
      } catch (e) {
        console.warn(`[${name}] could not save`, e);
      }
    },
    removeItem: async (name) => {
      try {
        await kv.removeItem(name);
      } catch {
        // nothing to clean up
      }
    },
  };
}

export function persistConfig<T>(name: string): PersistOptions<T> {
  return { name, version: 1, storage: safeStorage<T>() };
}
