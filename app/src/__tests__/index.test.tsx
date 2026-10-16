import { Text } from 'react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import Index from '@/app/index';
import { useReading } from '@/store/reading';

const routes = { index: Index, 'chapter/[slug]': () => <Text>chapter</Text> };

beforeEach(() => useReading.setState(useReading.getInitialState(), true));

it('opens the first chapter on first launch', () => {
  renderRouter(routes, { initialUrl: '/' });
  expect(screen).toHavePathname('/chapter/Introduction');
});

it('opens the last-read chapter', () => {
  useReading.setState({ last: { slug: 'Water', blockIndex: 4 } });
  renderRouter(routes, { initialUrl: '/' });
  expect(screen).toHavePathname('/chapter/Water');
});

it('falls back when the last chapter no longer exists', () => {
  useReading.setState({ last: { slug: 'Removed', blockIndex: 4 } });
  renderRouter(routes, { initialUrl: '/' });
  expect(screen).toHavePathname('/chapter/Introduction');
});
