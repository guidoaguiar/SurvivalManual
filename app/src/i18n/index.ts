import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const languages = ['en', 'fr'] as const;
export type Language = (typeof languages)[number];

export function pickLanguage(override?: string): Language {
  const tag = override ?? getLocales()[0]?.languageCode ?? 'en';
  return (languages as readonly string[]).includes(tag) ? (tag as Language) : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: pickLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
