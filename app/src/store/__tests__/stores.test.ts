import { useSettings, fontSize } from '@/store/settings';
import { useReading } from '@/store/reading';
import { useBookmarks } from '@/store/bookmarks';
import { useChecklists } from '@/store/checklists';
import { emptyCard, hasCard, useEmergency } from '@/store/emergency';

const kv = jest.requireMock('expo-sqlite/kv-store').default as { __map: Map<string, string> };
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  kv.__map.clear();
  for (const s of [useSettings, useReading, useBookmarks, useChecklists, useEmergency] as unknown as { setState(x: unknown, replace: true): void; getInitialState(): unknown }[])
    s.setState(s.getInitialState(), true);
});

it('persists settings to the kv store', async () => {
  useSettings.getState().set({ theme: 'night', fontStep: 4 });
  await flush();
  expect(JSON.parse(kv.__map.get('settings')!).state).toMatchObject({ theme: 'night', fontStep: 4 });
});

it('falls back to defaults and finishes hydrating when stored data is corrupt', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  kv.__map.set('settings', '{not json');
  await useSettings.persist.rehydrate();
  expect(useSettings.getState().theme).toBe('system');
  expect(useSettings.persist.hasHydrated()).toBe(true);
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

it('maps font steps with the legacy formula and clamps', () => {
  expect([0, 2, 4].map(fontSize)).toEqual([8, 16, 24]);
  expect(fontSize(9)).toBe(24);
  expect(fontSize(-1)).toBe(8);
});

it('keeps 10 unique recents, newest first', () => {
  const { visit } = useReading.getState();
  for (let i = 0; i < 12; i++) visit(`C${i}`);
  visit('C5');
  const { recents } = useReading.getState();
  expect(recents).toHaveLength(10);
  expect(recents[0]).toBe('C5');
  expect(new Set(recents).size).toBe(10);
});

it('toggles bookmarks by chapter and block', () => {
  const { toggle } = useBookmarks.getState();
  toggle('Water', 3, 'Boiling');
  expect(useBookmarks.getState().items).toMatchObject([{ id: 'Water#3', slug: 'Water', blockIndex: 3, label: 'Boiling' }]);
  toggle('Water', 3);
  expect(useBookmarks.getState().items).toEqual([]);
});

it('manages checklist items', () => {
  const s = useChecklists.getState();
  const id = s.create('Kit', ['Knife', 'Rope'], 'kit');
  const [knife] = useChecklists.getState().lists[0].items;
  s.toggle(id, knife.id);
  s.addItem(id, 'Mirror');
  s.editItem(id, knife.id, 'Fixed-blade knife');
  expect(useChecklists.getState().lists[0].items.map((i) => [i.text, i.done])).toEqual([
    ['Fixed-blade knife', true],
    ['Rope', false],
    ['Mirror', false],
  ]);
  s.reset(id);
  expect(useChecklists.getState().lists[0].items.every((i) => !i.done)).toBe(true);
  s.remove(id);
  expect(useChecklists.getState().lists).toEqual([]);
});

it('knows whether the emergency card has content', () => {
  expect(hasCard(emptyCard)).toBe(false);
  expect(hasCard({ ...emptyCard, contacts: [{ name: '', phone: '' }] })).toBe(false);
  useEmergency.getState().update({ bloodType: 'O+' });
  expect(hasCard(useEmergency.getState().card)).toBe(true);
});

it('drops wrong-shaped emergency data and keeps the defaults', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  kv.__map.set('emergency', '{"state":{"card":{"contacts":null,"name":5}},"version":1}');
  await useEmergency.persist.rehydrate();
  const { card } = useEmergency.getState();
  expect(() => hasCard(card)).not.toThrow();
  expect(card.contacts).toEqual([]);
  expect(card.name).toBe('');
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

it('falls back to default settings when the stored state is not an object', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  kv.__map.set('settings', '{"state":"abc","version":1}');
  await useSettings.persist.rehydrate();
  expect(useSettings.getState()).toMatchObject({ theme: 'system', fontStep: 2, keepAwake: true, ttsRate: 1, legacyImported: false });
  warn.mockRestore();
});
