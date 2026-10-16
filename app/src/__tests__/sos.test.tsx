import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import SosScreen from '@/app/tools/sos';

jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: false }, jest.fn(async () => ({ granted: false }))],
}));
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(async () => {}), loop: false }),
}));

const routes = { _layout: () => <Stack />, 'tools/sos': SosScreen };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('strobes the screen in Morse timing and stops on tap', () => {
  renderRouter(routes, { initialUrl: '/tools/sos' });
  expect(screen.getByText('... --- ...')).toBeVisible();
  fireEvent.press(screen.getByText('Start'));
  expect(screen.getByTestId('strobe')).toHaveStyle({ backgroundColor: '#ffffff' });
  act(() => jest.advanceTimersByTime(150)); // 8 wpm → 150 ms per unit; the first dot ends
  expect(screen.getByTestId('strobe')).toHaveStyle({ backgroundColor: '#000000' });
  fireEvent.press(screen.getByTestId('strobe'));
  expect(screen.queryByTestId('strobe')).toBeNull();
});

it('disables Start and lists skipped characters when nothing is encodable', () => {
  renderRouter(routes, { initialUrl: '/tools/sos' });
  fireEvent.changeText(screen.getByLabelText('Message'), '###');
  expect(screen.getByText('Skipped (no Morse code): #')).toBeVisible();
  expect(screen.getByText('Start')).toBeDisabled();
});

it('changes speed within 5–20 wpm', () => {
  renderRouter(routes, { initialUrl: '/tools/sos' });
  for (let i = 0; i < 20; i++) fireEvent.press(screen.getByLabelText('Faster'));
  expect(screen.getByText('Speed: 20 words per minute')).toBeVisible();
  for (let i = 0; i < 30; i++) fireEvent.press(screen.getByLabelText('Slower'));
  expect(screen.getByText('Speed: 5 words per minute')).toBeVisible();
});
