import { useEffect, useState } from 'react';
import { useBookmarks } from './bookmarks';
import { useChecklists } from './checklists';
import { useEmergency } from './emergency';
import { useReading } from './reading';
import { useSettings } from './settings';

const stores = [useSettings, useReading, useBookmarks, useChecklists, useEmergency];
const allHydrated = () => stores.every((s) => s.persist.hasHydrated());

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    const check = () => {
      if (!allHydrated()) return;
      setHydrated(true);
    };
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, [hydrated]);
  return hydrated;
}
