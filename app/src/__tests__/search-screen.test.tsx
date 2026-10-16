import { Text } from 'react-native';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import SearchScreen from '@/app/search';
import { searchManual } from '@/search/search';

jest.mock('@/search/search', () => ({ searchManual: jest.fn() }));
const mocked = searchManual as jest.Mock;

const routes = { _layout: () => <Stack />, search: SearchScreen, 'chapter/[slug]': () => <Text>chapter</Text> };

it('shows grouped results and opens the section with the query', () => {
  mocked.mockReturnValue([{ slug: 'Water', sections: [{ slug: 'Water', block: 3, heading: 'Purification', excerpt: 'Boil water for one minute' }] }]);
  renderRouter(routes, { initialUrl: '/search' });
  fireEvent.changeText(screen.getByTestId('search-input'), 'water');
  expect(screen.getByText('Water')).toBeVisible();
  expect(screen.getByText('Purification')).toBeVisible();
  fireEvent.press(screen.getByTestId('search-result-0-0'));
  expect(screen).toHavePathname('/chapter/Water');
  expect(screen).toHaveSearchParams({ slug: 'Water', block: '3', q: 'water' });
});

it('says when nothing was found', () => {
  mocked.mockReturnValue([]);
  renderRouter(routes, { initialUrl: '/search' });
  fireEvent.changeText(screen.getByTestId('search-input'), 'zzz');
  expect(screen.getByText('Nothing found for “zzz”')).toBeVisible();
});
