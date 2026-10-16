import { renderRouter, screen } from 'expo-router/testing-library';
import Index from '@/app/index';

it('renders the root route', () => {
  renderRouter({ index: Index }, { initialUrl: '/' });
  expect(screen.getByText('Survival Manual')).toBeVisible();
});
