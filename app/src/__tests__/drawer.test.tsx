import { Text } from 'react-native';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { DrawerContent } from '@/components/DrawerContent';
import { useEmergency } from '@/store/emergency';

const navigation = { closeDrawer: jest.fn() };
const routes = {
  index: () => <DrawerContent navigation={navigation} />,
  'chapter/[slug]': () => <Text>chapter</Text>,
  'tools/emergency-card': () => <Text>card</Text>,
};

beforeEach(() => {
  jest.clearAllMocks();
  useEmergency.setState(useEmergency.getInitialState(), true);
});

it('navigates to a chapter and closes the drawer', () => {
  renderRouter(routes, { initialUrl: '/' });
  fireEvent.press(screen.getByText('Water'));
  expect(screen).toHavePathname('/chapter/Water');
  expect(navigation.closeDrawer).toHaveBeenCalled();
});

it('collapses the appendix until opened', () => {
  renderRouter(routes, { initialUrl: '/' });
  expect(screen.queryByText('FAQ')).toBeNull();
  fireEvent.press(screen.getByText('Appendix'));
  expect(screen.getByText('FAQ')).toBeVisible();
  expect(screen.queryByText('Translator Notes')).toBeNull();
});

it('pins the emergency card only when it has content', () => {
  renderRouter(routes, { initialUrl: '/' });
  expect(screen.getAllByText('Emergency card')).toHaveLength(1);
  act(() => {
    useEmergency.getState().update({ bloodType: 'A-' });
  });
  renderRouter(routes, { initialUrl: '/' });
  expect(screen.getAllByText('Emergency card')).toHaveLength(2);
});
