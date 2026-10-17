import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { contentLanguages } from '@/content/manifest';
import { locales } from '@/content/locales';

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export const languages: string[] = [...new Set([...Object.keys(locales), ...contentLanguages])].sort((a, b) =>
  a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b),
);

type Device = { languageTag?: string | null; languageCode?: string | null };

function match(candidate: string): string | undefined {
  const norm = candidate.replace('_', '-').toLowerCase();
  const exact = languages.find((l) => l.toLowerCase() === norm);
  if (exact) return exact;
  const base = norm.split('-')[0];
  return languages.find((l) => l.toLowerCase().split('-')[0] === base);
}

export function pickLanguage(override?: string, device: Device = getLocales()[0] ?? {}): string {
  // A saved override for a language that no longer exists falls through to the device locale.
  const saved = override && languages.find((l) => l.toLowerCase() === override.toLowerCase());
  if (saved) return saved;
  for (const c of [device.languageTag, device.languageCode]) {
    if (!c) continue;
    const hit = match(c);
    if (hit) return hit;
  }
  return 'en';
}

export function languageName(lang: string): string {
  return has(locales, lang) && locales[lang].language_name ? locales[lang].language_name : lang;
}

export function currentLanguage(): string {
  return i18n.language || 'en';
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(locales).map(([lang, translation]) => [lang, { translation }])),
  lng: pickLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
