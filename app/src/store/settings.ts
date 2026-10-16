import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistConfig } from './persistConfig';

export type ThemeMode = 'system' | 'day' | 'night' | 'amoled';
export type SettingsValues = { theme: ThemeMode; fontStep: number; keepAwake: boolean; ttsRate: number; language?: string; legacyImported: boolean };
type SettingsState = SettingsValues & { set: (patch: Partial<SettingsValues>) => void };

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({ theme: 'system', fontStep: 2, keepAwake: true, ttsRate: 1, legacyImported: false, set: (patch) => set(patch) }),
    persistConfig<SettingsState>('settings'),
  ),
);

export const fontSize = (step: number) => 8 + 4 * Math.min(4, Math.max(0, Math.round(step)));
