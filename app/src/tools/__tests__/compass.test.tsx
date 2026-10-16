import { act, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import i18n from '@/i18n';
import { cardinal } from '@/tools/cardinal';
import { Compass } from '@/tools/Compass';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn(), watchHeadingAsync: jest.fn() }));
const perm = Location.requestForegroundPermissionsAsync as jest.Mock;
const watch = Location.watchHeadingAsync as jest.Mock;

it('names the eight cardinal directions', () => {
  expect([0, 44, 46, 90, 135, 180, 270, 359, -90, 720].map(cardinal)).toEqual(['n', 'ne', 'ne', 'e', 'se', 's', 'w', 'n', 'w', 'n']);
});

it('shows true heading when permitted', async () => {
  perm.mockResolvedValue({ granted: true });
  watch.mockImplementation(async (cb) => {
    cb({ trueHeading: 90, magHeading: 88, accuracy: 3 });
    return { remove: jest.fn() };
  });
  render(<Compass />);
  await waitFor(() => expect(screen.getByText('90° E')).toBeVisible());
  expect(screen.getByText('True north')).toBeVisible();
  expect(screen.getByLabelText('Heading 90 degrees East, True north')).toBeVisible();
});

it('falls back to magnetic heading and explains why', async () => {
  perm.mockResolvedValue({ granted: false });
  watch.mockImplementation(async (cb) => {
    cb({ trueHeading: -1, magHeading: 181, accuracy: 1 });
    return { remove: jest.fn() };
  });
  render(<Compass />);
  await waitFor(() => expect(screen.getByText('181° S')).toBeVisible());
  expect(screen.getByText('Magnetic north')).toBeVisible();
  expect(screen.getByText('Location permission is needed for true north. Showing magnetic north.')).toBeVisible();
  expect(screen.getByText('Low accuracy: move your phone in a figure-8 to calibrate.')).toBeVisible();
});

it('shows unavailable when heading cannot be watched', async () => {
  perm.mockResolvedValue({ granted: true });
  watch.mockRejectedValue(new Error('no sensor'));
  render(<Compass />);
  await waitFor(() => expect(screen.getByText('A compass is not available on this device.')).toBeVisible());
});

it('localizes direction letters and spoken names', async () => {
  await act(() => i18n.changeLanguage('pt-BR'));
  try {
    perm.mockResolvedValue({ granted: true });
    watch.mockImplementation(async (cb) => {
      cb({ trueHeading: 270, magHeading: 268, accuracy: 3 });
      return { remove: jest.fn() };
    });
    render(<Compass />);
    await waitFor(() => expect(screen.getByText('270° O')).toBeVisible());
    expect(screen.getByLabelText(/Oeste/)).toBeVisible();
  } finally {
    await act(() => i18n.changeLanguage('en'));
  }
});
