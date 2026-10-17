import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import SettingsScreen from '@/app/settings';
import { useSettings } from '@/store/settings';

const routes = { _layout: () => <Stack />, settings: SettingsScreen };

beforeEach(() => useSettings.setState(useSettings.getInitialState(), true));

it('changes theme, font size, keep-awake, reading speed and language', () => {
  renderRouter(routes, { initialUrl: '/settings' });
  expect(screen.getByRole('radio', { name: 'English' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Português (Brasil)' })).toBeTruthy();
  fireEvent.press(screen.getByRole('radio', { name: 'True black (AMOLED)' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Large' }));
  fireEvent(screen.getByRole('switch'), 'valueChange', false);
  fireEvent.press(screen.getByRole('radio', { name: '1.5×' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Français' }));
  expect(useSettings.getState()).toMatchObject({ theme: 'amoled', fontStep: 3, keepAwake: false, ttsRate: 1.5, language: 'fr' });
  fireEvent.press(screen.getByRole('radio', { name: 'System default' }));
  expect(useSettings.getState().language).toBeUndefined();
});
