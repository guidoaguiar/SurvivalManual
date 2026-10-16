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

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const sameKind = (d: unknown, v: unknown) =>
  d === undefined ? v === undefined || typeof v === 'string' : Array.isArray(d) ? Array.isArray(v) : isObj(d) ? isObj(v) : typeof d === typeof v;

// Keeps a persisted value only if it has the same kind as the default (one level deep for plain objects).
function mergeKnown(name: string, defaults: Rec, saved: unknown): Rec {
  if (!isObj(saved)) {
    if (saved !== undefined) console.warn(`[${name}] stored state has the wrong shape, using defaults`);
    return defaults;
  }
  const out: Rec = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const d = defaults[key];
    if (typeof d === 'function' || !(key in saved)) continue;
    const v = saved[key];
    if (!sameKind(d, v)) {
      console.warn(`[${name}] dropped invalid stored value for "${key}"`);
    } else if (isObj(d)) {
      out[key] = mergeKnown(`${name}.${key}`, d, v);
    } else {
      out[key] = v;
    }
  }
  return out;
}

export function persistConfig<T>(name: string): PersistOptions<T> {
  return { name, version: 1, storage: safeStorage<T>(), merge: (saved, current) => mergeKnown(name, current as Rec, saved) as T };
}
