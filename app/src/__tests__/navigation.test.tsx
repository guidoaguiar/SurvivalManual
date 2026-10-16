import { BackHandler, Platform } from 'react-native';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import RootLayout from '@/app/_layout';
import ChapterScreen from '@/app/chapter/[slug]';
import ImageScreen from '@/app/image/[name]';
import Index from '@/app/index';
import { goBack } from '@/lib/nav';
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

function onAndroid() {
  jest.replaceProperty(Platform, 'OS', 'android');
  return jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});
}

it('exits the app on Android when Back reaches the launch route, and resumes on the chapter', async () => {
  const exit = onAndroid();
  await launch();
  expect(exit).not.toHaveBeenCalled();
  go(() => router.back());
  expect(exit).toHaveBeenCalledTimes(1);
  // exitApp only backgrounds the task; on resume the chapter must be showing, not a blank index.
  expect(screen).toHavePathname('/chapter/Introduction');
  go(() => router.back());
  expect(exit).toHaveBeenCalledTimes(2);
  expect(screen).toHavePathname('/chapter/Introduction');
});

it('"Back to contents" on a missing chapter lands on a chapter without exiting', async () => {
  const exit = onAndroid();
  await launch();
  go(() => router.push('/chapter/Nope'));
  fireEvent.press(screen.getByText('Back to contents'));
  expect(screen).toHavePathname('/chapter/Introduction');
  expect(exit).not.toHaveBeenCalled();
});

it('the goBack fallback after launch lands on a chapter without exiting', async () => {
  const exit = onAndroid();
  await launch();
  go(() => router.push('/search'));
  jest.spyOn(router, 'canGoBack').mockReturnValueOnce(false);
  go(() => goBack());
  expect(screen).toHavePathname('/chapter/Introduction');
  expect(exit).not.toHaveBeenCalled();
});

// Android hardware Back: react-navigation handles it while it can go back; otherwise RN's
// BackHandler falls through to exitApp(). Presses until the app exits; also records whether the
// navigator was at its root (canGoBack() false) when exitApp ran.
function backUntilExit(exit: jest.SpyInstance, max = 6) {
  let atRoot = false;
  exit.mockImplementation(() => {
    atRoot = !router.canGoBack();
  });
  for (let i = 1; i <= max; i++) {
    if (router.canGoBack()) go(() => router.back());
    else BackHandler.exitApp();
    if (exit.mock.calls.length > 0) return { presses: i, atRoot };
  }
  return { presses: Infinity, atRoot };
}

it('Back still leaves the app after "Back to contents" reached from search', async () => {
  const exit = onAndroid();
  await launch();
  go(() => router.push('/search'));
  go(() => router.push('/chapter/Nope'));
  fireEvent.press(screen.getByText('Back to contents'));
  expect(screen).toHavePathname('/chapter/Introduction');
  const { presses, atRoot } = backUntilExit(exit);
  expect(presses).toBeLessThanOrEqual(3);
  expect(atRoot).toBe(true);
  expect(screen).toHavePathname('/chapter/Introduction');
});

it('Back leaves the app after a goBack fallback from a deep-linked first screen', async () => {
  const exit = onAndroid();
  renderRouter(routes, { initialUrl: '/search' });
  await waitFor(() => expect(screen).toHavePathname('/search'));
  expect(router.canGoBack()).toBe(false);
  go(() => goBack());
  expect(screen).toHavePathname('/chapter/Introduction');
  const { presses, atRoot } = backUntilExit(exit);
  expect(presses).toBeLessThanOrEqual(2);
  expect(atRoot).toBe(true);
});

it('redirects again instead of exiting on other platforms', async () => {
  const exit = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});
  await launch();
  go(() => router.back());
  expect(exit).not.toHaveBeenCalled();
  expect(screen).toHavePathname('/chapter/Introduction');
});
