import { toc, tocBySlug } from '@/toc';
import en from '@/i18n/locales/en.json';
import ptBR from '@/i18n/locales/pt-BR.json';

it('has unique slugs', () => {
  expect(new Set(toc.map((e) => e.slug)).size).toBe(toc.length);
});

it('has an English title for every entry', () => {
  for (const e of toc) expect(en).toHaveProperty(e.titleKey);
});

it('keeps the legacy order and grouping', () => {
  expect(toc[0].slug).toBe('Introduction');
  expect(toc.filter((e) => !e.appendix && e.listed !== false)).toHaveLength(28);
  expect(toc.filter((e) => e.appendix).map((e) => e.slug)).toEqual([
    'MultiTool',
    'BasicMechanicalSkills',
    'BlackoutDriving',
    'CarRepair',
    'DangerousArthropods',
    'FishAndMollusks',
    'RopesAndKnots',
    'Weapons',
    'FAQ',
  ]);
  expect(tocBySlug.get('TranslatorNotes')?.listed).toBe(false);
});

it('has every English interface string translated for pt-BR with the same placeholders', () => {
  const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();
  for (const [key, value] of Object.entries(en)) {
    expect(ptBR).toHaveProperty(key);
    expect(placeholders((ptBR as Record<string, string>)[key])).toEqual(placeholders(value));
  }
  expect(ptBR.language_name).toBe('Português (Brasil)');
});
