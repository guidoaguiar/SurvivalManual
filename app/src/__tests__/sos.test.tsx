import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import SosScreen from '@/app/tools/sos';

let mockPermission = { granted: false, canAskAgain: true };
const mockRequest = jest.fn(async () => ({ granted: false }));
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [mockPermission, mockRequest],
}));
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(async () => {}), loop: false }),
}));

const routes = { _layout: () => <Stack />, 'tools/sos': SosScreen };

beforeEach(() => {
  jest.useFakeTimers();
  mockPermission = { granted: false, canAskAgain: true };
  mockRequest.mockClear();
});
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

it('explains a denied camera permission and keeps the switch enabled while it can be asked again', async () => {
  renderRouter(routes, { initialUrl: '/tools/sos' });
  await act(async () => fireEvent(screen.getByLabelText('Flashlight'), 'valueChange', true));
  expect(mockRequest).toHaveBeenCalled();
  expect(screen.getByText('Camera permission is needed to use the flashlight')).toBeVisible();
  expect(screen.getByLabelText('Flashlight').props.disabled).toBeFalsy();
});

it('disables the flashlight switch when permission can no longer be requested', () => {
  mockPermission = { granted: false, canAskAgain: false };
  renderRouter(routes, { initialUrl: '/tools/sos' });
  expect(screen.getByLabelText('Flashlight').props.disabled).toBe(true);
  expect(screen.getByText('Camera permission is needed to use the flashlight')).toBeVisible();
});
