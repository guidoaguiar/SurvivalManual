import { importLegacyOnce, mapLegacy } from '@/lib/legacyImport';
import { useReading } from '@/store/reading';
import { useSettings } from '@/store/settings';

jest.mock('../../../modules/legacy-prefs', () => ({ readLegacyPrefs: jest.fn(() => null) }));

beforeEach(() => {
  useSettings.setState(useSettings.getInitialState(), true);
  useReading.setState(useReading.getInitialState(), true);
});

describe('mapLegacy', () => {
  it('maps every legacy night mode', () => {
    const theme = (nightMode: string | null) => mapLegacy({ nightMode, fontSize: null, lastUrl: null }).theme;
    expect([theme('day'), theme('night'), theme('darknight'), theme('system'), theme('auto'), theme('weird'), theme(null)]).toEqual([
      'day', 'night', 'amoled', 'system', 'system', 'system', undefined,
    ]);
  });
  it('accepts font sizes 0–4 only', () => {
    const step = (fontSize: string | null) => mapLegacy({ nightMode: null, fontSize, lastUrl: null }).fontStep;
    expect([step('0'), step('4'), step('7'), step('x'), step(null)]).toEqual([0, 4, undefined, undefined, undefined]);
  });
  it('keeps the last chapter only if it still exists', () => {
    const slug = (lastUrl: string) => mapLegacy({ nightMode: null, fontSize: null, lastUrl }).lastSlug;
    expect(slug('Water#fig5-3')).toBe('Water');
    expect(slug('Weapons')).toBeUndefined();
  });
  it('maps nothing when there is no legacy data', () => expect(mapLegacy(null)).toEqual({}));
});

it('imports once', () => {
  const read = jest.fn(() => ({ nightMode: 'darknight', fontSize: '3', lastUrl: 'Fire' }));
  importLegacyOnce(read);
  expect(useSettings.getState()).toMatchObject({ theme: 'amoled', fontStep: 3, legacyImported: true });
  expect(useReading.getState().last).toEqual({ slug: 'Fire', blockIndex: 0 });
  importLegacyOnce(read);
  expect(read).toHaveBeenCalledTimes(1);
});

it('marks the import done even without legacy data', () => {
  importLegacyOnce(() => null);
  expect(useSettings.getState()).toMatchObject({ theme: 'system', fontStep: 2, legacyImported: true });
});

it('does not overwrite a last position that already exists', () => {
  useReading.setState({ last: { slug: 'Water', blockIndex: 7 } });
  importLegacyOnce(() => ({ nightMode: null, fontSize: null, lastUrl: 'Fire' }));
  expect(useReading.getState().last).toEqual({ slug: 'Water', blockIndex: 7 });
});
