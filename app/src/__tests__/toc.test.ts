import { toc, tocBySlug, IGNORED_LINKS } from '@/toc';
import legacyEn from '@/i18n/locales/legacy.en.json';

it('has unique slugs', () => {
  expect(new Set(toc.map((e) => e.slug)).size).toBe(toc.length);
});

it('has an English title for every entry', () => {
  for (const e of toc) expect(legacyEn).toHaveProperty(e.titleKey);
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
  expect(IGNORED_LINKS).toEqual(['LifeStraw', 'SolarUSBCharger', 'OHTMultiTool', 'Audible', 'CampStoveUSB', 'HandCrankUSB', 'CarUSBCharger', 'PandaDubLionsDen', 'TreadMultiTool']);
});
