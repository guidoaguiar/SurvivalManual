import 'react-native-gesture-handler/jestSetup';

jest.mock('expo-sqlite/kv-store', () => {
  const map = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => map.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        map.set(k, v);
      }),
      removeItem: jest.fn(async (k: string) => {
        map.delete(k);
      }),
      __map: map,
    },
  };
});

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => {}),
  deactivateKeepAwake: jest.fn(async () => {}),
  useKeepAwake: jest.fn(),
}));

// Icon fonts load async under jest and trigger act() warnings; treat them as loaded.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(async () => {}),
}));

import '@/i18n';
