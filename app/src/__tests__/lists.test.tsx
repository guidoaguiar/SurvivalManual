import { Text } from 'react-native';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import BookmarksScreen from '@/app/bookmarks';
import RecentsScreen from '@/app/recents';
import { useBookmarks } from '@/store/bookmarks';
import { useReading } from '@/store/reading';

const routes = { _layout: () => <Stack />, bookmarks: BookmarksScreen, recents: RecentsScreen, 'chapter/[slug]': () => <Text>chapter</Text> };

beforeEach(() => {
  useBookmarks.setState(useBookmarks.getInitialState(), true);
  useReading.setState(useReading.getInitialState(), true);
});

it('shows an empty state', () => {
  renderRouter(routes, { initialUrl: '/bookmarks' });
  expect(screen.getByText('No bookmarks yet. Tap the bookmark icon while reading.')).toBeVisible();
});

it('opens and deletes bookmarks', () => {
  useBookmarks.getState().toggle('Water', 7, 'Boiling');
  const first = renderRouter(routes, { initialUrl: '/bookmarks' });
  expect(screen.getByText('Boiling')).toBeVisible();
  fireEvent.press(screen.getByLabelText('Delete'));
  expect(useBookmarks.getState().items).toEqual([]);
  first.unmount(); // otherwise the old tree is still subscribed and owns the global router
  useBookmarks.getState().toggle('Water', 7, 'Boiling');
  renderRouter(routes, { initialUrl: '/bookmarks' });
  fireEvent.press(screen.getByText('Water'));
  expect(screen).toHavePathname('/chapter/Water');
  expect(screen).toHaveSearchParams({ slug: 'Water', block: '7' });
});

it('lists recents newest first', () => {
  useReading.getState().visit('Fire');
  useReading.getState().visit('Water');
  renderRouter(routes, { initialUrl: '/recents' });
  const titles = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
  expect(titles.slice(0, 2)).toEqual(['Water', 'Fire']);
  fireEvent.press(screen.getByText('Fire'));
  expect(screen).toHavePathname('/chapter/Fire');
});
