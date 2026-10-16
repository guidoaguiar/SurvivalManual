import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type TocEntry = { slug: string; titleKey: string; icon?: IconName; appendix?: boolean; listed?: boolean };

export const toc: TocEntry[] = [
  { slug: 'Introduction', titleKey: 'introduction', icon: 'information-outline' },
  { slug: 'Psychology', titleKey: 'psychology', icon: 'brain' },
  { slug: 'Power', titleKey: 'power', icon: 'power-plug-outline' },
  { slug: 'Planning', titleKey: 'planning', icon: 'format-list-numbered' },
  { slug: 'Kits', titleKey: 'kits', icon: 'briefcase-outline' },
  { slug: 'Apps', titleKey: 'apps', icon: 'cellphone' },
  { slug: 'Medicine', titleKey: 'basic_medicine', icon: 'medical-bag' },
  { slug: 'Shelter', titleKey: 'shelter', icon: 'home-roof' },
  { slug: 'Water', titleKey: 'water', icon: 'cup-water' },
  { slug: 'Fire', titleKey: 'fire', icon: 'fire' },
  { slug: 'Food', titleKey: 'food', icon: 'silverware-fork-knife' },
  { slug: 'Plants', titleKey: 'plants', icon: 'flower-outline' },
  { slug: 'Poisonous-Plants', titleKey: 'poisonous_plants', icon: 'skull-outline' },
  { slug: 'Animals', titleKey: 'animals', icon: 'paw' },
  { slug: 'Tools', titleKey: 'tools', icon: 'hammer' },
  { slug: 'Desert', titleKey: 'desert', icon: 'white-balance-sunny' },
  { slug: 'Tropical', titleKey: 'tropical', icon: 'beach' },
  { slug: 'Cold', titleKey: 'cold', icon: 'snowflake' },
  { slug: 'Sea', titleKey: 'sea', icon: 'ferry' },
  { slug: 'WaterCrossing', titleKey: 'water_crossing', icon: 'rowing' },
  { slug: 'DirectionFinding', titleKey: 'directionfinding', icon: 'compass-outline' },
  { slug: 'ManMadeHazards', titleKey: 'man_made_hazards', icon: 'radioactive' },
  { slug: 'Self-defense', titleKey: 'self_defense', icon: 'shield-outline' },
  { slug: 'Signaling', titleKey: 'signaling', icon: 'flag-outline' },
  { slug: 'HostileAreas', titleKey: 'hostile_areas', icon: 'flash-outline' },
  { slug: 'Camouflage', titleKey: 'camouflage', icon: 'palette-outline' },
  { slug: 'People', titleKey: 'people', icon: 'account-group-outline' },
  { slug: 'Credits', titleKey: 'credits', icon: 'star-outline' },
  { slug: 'MultiTool', titleKey: 'multitool', appendix: true },
  { slug: 'DangerousArthropods', titleKey: 'insects_and_arachnids', appendix: true },
  { slug: 'FishAndMollusks', titleKey: 'fish_and_mollusks', appendix: true },
  { slug: 'RopesAndKnots', titleKey: 'ropes_and_knots', appendix: true },
  { slug: 'FAQ', titleKey: 'faq', appendix: true },
  { slug: 'TranslatorNotes', titleKey: 'translator_notes', listed: false },
];

export const tocBySlug = new Map(toc.map((e) => [e.slug, e]));

// Affiliate pages linked from the wiki that don't exist as wiki pages; rendered as plain text.
export const IGNORED_LINKS = ['LifeStraw', 'SolarUSBCharger', 'OHTMultiTool'];
