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

import '@/i18n';

// expo-audio hoists expo-asset@58 over expo's 56, which breaks loading the real icon set under jest.
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
