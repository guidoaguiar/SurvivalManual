import { useColorScheme } from 'react-native';
import { useSettings, type ThemeMode } from '@/store/settings';

export type Colors = {
  dark: boolean;
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  border: string;
  highlight: string;
  highlightText: string;
  quoteBar: string;
  danger: string;
};

const night: Colors = {
  dark: true,
  background: '#121412',
  surface: '#1d211c',
  text: '#e6e8e3',
  muted: '#a3aa9f',
  primary: '#455440',
  onPrimary: '#ffffff',
  accent: '#9fb86a',
  border: '#2e352c',
  highlight: '#7a6a20',
  highlightText: '#ffffff',
  quoteBar: '#61733b',
  danger: '#ff8a80',
};

export const palettes: Record<'day' | 'night' | 'amoled', Colors> = {
  day: {
    dark: false,
    background: '#ffffff',
    surface: '#f1f3ef',
    text: '#1c222e',
    muted: '#5b6470',
    primary: '#455440',
    onPrimary: '#ffffff',
    accent: '#3d5a1e',
    border: '#d9ddd5',
    highlight: '#ffe08a',
    highlightText: '#1c222e',
    quoteBar: '#61733b',
    danger: '#b3261e',
  },
  night,
  amoled: { ...night, background: '#000000', surface: '#0b0b0b', border: '#1c1c1c' },
};

export function resolveTheme(mode: ThemeMode, scheme: string | null | undefined): keyof typeof palettes {
  if (mode === 'system') return scheme === 'dark' ? 'night' : 'day';
  return mode;
}

export function useColors(): Colors {
  const mode = useSettings((s) => s.theme);
  const scheme = useColorScheme();
  return palettes[resolveTheme(mode, scheme)];
}
