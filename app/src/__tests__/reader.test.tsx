import { Linking, Text } from 'react-native';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Speech from 'expo-speech';
import { activateKeepAwakeAsync } from 'expo-keep-awake';
import ChapterScreen from '@/app/chapter/[slug]';
import { useBookmarks } from '@/store/bookmarks';
import { useSettings } from '@/store/settings';
import { useReading } from '@/store/reading';

jest.mock('@/content/chapters', () => require('@/test-utils/fixtures').chaptersModule);
jest.mock('@/content/images', () => require('@/test-utils/fixtures').imagesModule);

const routes = {
  _layout: () => <Stack />,
  'chapter/[slug]': ChapterScreen,
  'image/[name]': () => <Text>image</Text>,
};
const open = (url: string) => renderRouter(routes, { initialUrl: url });

beforeEach(() => {
  jest.clearAllMocks();
  useReading.setState(useReading.getInitialState(), true);
  useBookmarks.setState(useBookmarks.getInitialState(), true);
  useSettings.setState(useSettings.getInitialState(), true);
});

it('renders the chapter, records it as recent and keeps the screen awake', () => {
  open('/chapter/Alpha');
  expect(screen.getByText('Alpha intro')).toBeVisible();
  expect(useReading.getState().recents[0]).toBe('Alpha');
  expect(activateKeepAwakeAsync).toHaveBeenCalledWith('reader');
});

it('shows not found for unknown chapters', () => {
  open('/chapter/Nope');
  expect(screen.getByText('Chapter not found')).toBeVisible();
});

it('follows internal links', () => {
  open('/chapter/Alpha');
  fireEvent.press(screen.getByText('See Beta'));
  expect(screen).toHavePathname('/chapter/Beta');
});

it('opens images', () => {
  open('/chapter/Alpha');
  fireEvent.press(screen.getByLabelText('Figure 1'));
  expect(screen).toHavePathname('/image/a.png');
});

it('highlights a search jump and steps through matching blocks', () => {
  open('/chapter/Alpha?block=2&q=water');
  expect(screen.getAllByTestId('hl').length).toBeGreaterThan(0);
  expect(screen.getByTestId('find-status')).toHaveTextContent('2 of 2');
  fireEvent.press(screen.getByLabelText('Next'));
  expect(screen.getByTestId('find-status')).toHaveTextContent('1 of 2');
});

it('finds in chapter from the header', () => {
  open('/chapter/Alpha');
  fireEvent.press(screen.getByLabelText('Find in chapter'));
  fireEvent.changeText(screen.getByTestId('find-input'), 'zzz');
  expect(screen.getByTestId('find-status')).toHaveTextContent('No matches');
});

it('bookmarks the current block with its heading', () => {
  open('/chapter/Alpha');
  fireEvent.press(screen.getByLabelText('Add bookmark'));
  expect(useBookmarks.getState().items).toMatchObject([{ id: 'Alpha#0', label: 'Alpha intro' }]);
  expect(screen.getByLabelText('Remove bookmark')).toBeVisible();
});

it('reads aloud from the current block', () => {
  open('/chapter/Alpha');
  fireEvent.press(screen.getByLabelText('Read aloud'));
  expect(Speech.speak).toHaveBeenCalledWith('Alpha intro', expect.anything());
  expect(screen.getByLabelText('Stop reading')).toBeVisible();
});

it('restores the last block, and a block param overrides it', () => {
  useReading.setState({ last: { slug: 'Alpha', blockIndex: 2 } });
  open('/chapter/Alpha');
  fireEvent.press(screen.getByLabelText('Add bookmark'));
  expect(useBookmarks.getState().items[0].id).toBe('Alpha#2');
});

it('prefers the block param over the last position', () => {
  useReading.setState({ last: { slug: 'Alpha', blockIndex: 2 } });
  open('/chapter/Alpha?block=4');
  fireEvent.press(screen.getByLabelText('Add bookmark'));
  expect(useBookmarks.getState().items[0].id).toBe('Alpha#4');
});

it('does not keep the screen awake when the setting is off', () => {
  useSettings.setState({ keepAwake: false });
  open('/chapter/Alpha');
  expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
});

it('stops reading when the screen loses focus', () => {
  open('/chapter/Alpha');
  fireEvent.press(screen.getByLabelText('Read aloud'));
  fireEvent.press(screen.getByText('See Beta'));
  expect(Speech.stop).toHaveBeenCalled();
});

it('opens external links with Linking', () => {
  const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  open('/chapter/Alpha');
  fireEvent.press(screen.getByText('Survival wiki'));
  expect(spy).toHaveBeenCalledWith('https://example.org');
});

it('shows the chapter in the selected language and switches live', async () => {
  const i18n = require('@/i18n').default;
  open('/chapter/Alpha');
  expect(screen.getByText('Alpha intro')).toBeVisible();
  await act(() => i18n.changeLanguage('pt-BR'));
  expect(screen.getByText('Introdução alfa')).toBeVisible();
  await act(() => i18n.changeLanguage('en'));
  expect(screen.getByText('Alpha intro')).toBeVisible();
});
