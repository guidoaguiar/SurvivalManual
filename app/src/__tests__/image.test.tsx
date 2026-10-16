import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import ImageScreen from '@/app/image/[name]';

jest.mock('@/content/images', () => require('@/test-utils/fixtures').imagesModule);
jest.mock('@/components/ZoomableImage', () => ({
  ZoomableImage: ({ alt }: { alt: string }) => {
    const { View: V } = require('react-native');
    return <V accessibilityLabel={alt} />;
  },
}));

const routes = { _layout: () => <Stack />, 'image/[name]': ImageScreen };

it('shows a known image', () => {
  renderRouter(routes, { initialUrl: '/image/a.png' });
  expect(screen.getByLabelText('a.png')).toBeTruthy();
});

it('shows not found for an unknown image', () => {
  renderRouter(routes, { initialUrl: '/image/missing.png' });
  expect(screen.getByText('Image not found')).toBeVisible();
});
