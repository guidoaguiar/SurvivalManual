import { palettes, resolveTheme } from '@/theme';

it('resolves system mode from the OS scheme', () => {
  expect(resolveTheme('system', 'dark')).toBe('night');
  expect(resolveTheme('system', 'light')).toBe('day');
  expect(resolveTheme('system', null)).toBe('day');
  expect(resolveTheme('amoled', 'light')).toBe('amoled');
});

it('uses true black for AMOLED and the legacy brand colour', () => {
  expect(palettes.amoled.background).toBe('#000000');
  expect(palettes.day.primary).toBe('#455440');
  expect(palettes.night.dark).toBe(true);
});
