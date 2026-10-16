import { BackHandler, Platform } from 'react-native';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import RootLayout from '@/app/_layout';
import ChapterScreen from '@/app/chapter/[slug]';
import ImageScreen from '@/app/image/[name]';
import Index from '@/app/index';
import SearchScreen from '@/app/search';
import { useReading } from '@/store/reading';
import { useSettings } from '@/store/settings';

// Drawer under jest: reanimated/worklets need their mocks, and the drawer's InteractionManager shim
// reads a jest RN version < 0.82 and touches the deprecated API (warns). On RN 0.85 it is undefined.
jest.mock('../../node_modules/react-native-drawer-layout/lib/module/views/InteractionManager.native.js', () => ({ InteractionManager: undefined }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@/content/chapters', () => require('@/test-utils/fixtures').chaptersModule);
jest.mock('@/content/images', () => require('@/test-utils/fixtures').imagesModule);
jest.mock('@/components/ZoomableImage', () => ({
  ZoomableImage: ({ alt }: { alt: string }) => {
    const { View: V } = require('react-native');
    return <V accessibilityLabel={alt} />;
  },
}));

// The real root layout (Drawer) with the real screens.
const routes = { _layout: RootLayout, index: Index, 'chapter/[slug]': ChapterScreen, search: SearchScreen, 'image/[name]': ImageScreen };

async function launch() {
  renderRouter(routes, { initialUrl: '/' });
  await waitFor(() => expect(screen).toHavePathname('/chapter/Introduction'));
}

const go = (fn: () => void) => act(fn);

beforeEach(() => {
  jest.restoreAllMocks();
  useReading.setState(useReading.getInitialState(), true);
  useSettings.setState(useSettings.getInitialState(), true);
});

it('imports legacy prefs once hydration completes', async () => {
  await launch();
  expect(useSettings.getState().legacyImported).toBe(true);
});

it('returns from search to the chapter it redirected to', async () => {
  await launch();
  go(() => router.push('/search'));
  expect(screen).toHavePathname('/search');
  go(() => router.back());
  expect(screen).toHavePathname('/chapter/Introduction');
});

it('returns from search to the exact chapter view, not via the launch route', async () => {
  await launch();
  go(() => router.push({ pathname: '/chapter/[slug]', params: { slug: 'Alpha', q: 'water' } }));
  go(() => router.push('/search'));
  go(() => router.back());
  expect(screen).toHavePathname('/chapter/Alpha');
  expect(screen).toHaveSearchParams({ slug: 'Alpha', q: 'water' });
});

it('closing an image returns to the chapter with its params intact', async () => {
  await launch();
  go(() => router.push({ pathname: '/chapter/[slug]', params: { slug: 'Alpha', q: 'water' } }));
  expect(screen.getByText('Alpha intro')).toBeVisible();
  go(() => router.push('/image/a.png'));
  expect(screen).toHavePathname('/image/a.png');
  fireEvent.press(screen.getByLabelText('Close'));
  expect(screen).toHavePathname('/chapter/Alpha');
  expect(screen).toHaveSearchParams({ slug: 'Alpha', q: 'water' });
});

it('exits the app on Android when Back reaches the launch route', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const exit = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});
  await launch();
  expect(exit).not.toHaveBeenCalled();
  go(() => router.back());
  expect(exit).toHaveBeenCalledTimes(1);
});

it('redirects again instead of exiting on other platforms', async () => {
  const exit = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});
  await launch();
  go(() => router.back());
  expect(exit).not.toHaveBeenCalled();
  expect(screen).toHavePathname('/chapter/Introduction');
});
