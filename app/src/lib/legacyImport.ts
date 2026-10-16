import { readLegacyPrefs, type RawLegacyPrefs } from '../../modules/legacy-prefs';
import { useReading } from '@/store/reading';
import { useSettings, type SettingsValues, type ThemeMode } from '@/store/settings';
import { tocBySlug } from '@/toc';

export type LegacyImport = { theme?: ThemeMode; fontStep?: number; lastSlug?: string };

const THEMES: Record<string, ThemeMode> = { day: 'day', night: 'night', darknight: 'amoled' };

export function mapLegacy(raw: RawLegacyPrefs | null): LegacyImport {
  if (!raw) return {};
  const out: LegacyImport = {};
  if (raw.nightMode) out.theme = THEMES[raw.nightMode] ?? 'system';
  if (raw.fontSize != null && /^[0-4]$/.test(raw.fontSize)) out.fontStep = Number(raw.fontSize);
  const slug = raw.lastUrl?.split('#')[0];
  if (slug && tocBySlug.has(slug)) out.lastSlug = slug;
  return out;
}

export function importLegacyOnce(read: () => RawLegacyPrefs | null = readLegacyPrefs) {
  const settings = useSettings.getState();
  if (settings.legacyImported) return;
  const m = mapLegacy(read());
  const patch: Partial<SettingsValues> = { legacyImported: true };
  if (m.theme) patch.theme = m.theme;
  if (m.fontStep !== undefined) patch.fontStep = m.fontStep;
  settings.set(patch);
  if (m.lastSlug) useReading.getState().setLast(m.lastSlug, 0);
}
