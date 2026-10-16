import { requireOptionalNativeModule } from 'expo';

export type RawLegacyPrefs = { nightMode: string | null; fontSize: string | null; lastUrl: string | null };

const native = requireOptionalNativeModule<{ read(): RawLegacyPrefs | null }>('LegacyPrefs');

export function readLegacyPrefs(): RawLegacyPrefs | null {
  try {
    return native?.read() ?? null;
  } catch (e) {
    console.warn('legacy prefs unreadable', e);
    return null;
  }
}
