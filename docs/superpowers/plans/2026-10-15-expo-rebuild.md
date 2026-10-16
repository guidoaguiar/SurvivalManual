# Survival Manual Expo Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Survival Manual as one React Native + Expo codebase that ships offline to iOS, Android and Web. It keeps the current app's features and adds bookmarks, recents, better search, checklists, an emergency card, SOS/Morse, a compass and read-aloud.

**Architecture:** A Node build script turns the wiki markdown (git submodule) into per-chapter JSON block trees, a MiniSearch index and an image map. The Expo Router app renders those blocks with a small custom React Native renderer inside a drawer layout. All user state lives in persisted Zustand stores (expo-sqlite kv-store on native, localStorage on web). No network is used at runtime.

**Tech Stack:** Expo SDK 56, Expo Router (drawer), TypeScript (strict), unified/remark/rehype (build time only), MiniSearch, Zustand 5, i18next, expo-sqlite, expo-speech, expo-camera, expo-location, expo-audio, expo-keep-awake, react-native-gesture-handler + Reanimated, Jest (jest-expo) + React Native Testing Library, `node:test` via `tsx` for build scripts, workbox-build for the PWA, EAS Build/Submit.

**Spec:** `docs/superpowers/specs/2026-10-15-expo-rebuild-design.md`

## Global Constraints

- The Expo project lives in `app/` at the repo root. Routes are in `app/src/app/`; all other app code is in `app/src/`. Tests must never be placed inside `app/src/app/`, because every file there becomes a route.
- Use Expo SDK 56. Add native-capable packages with `npx expo install`, never with a bare `npm i`.
- TypeScript `strict: true`. The path alias `@/*` maps to `app/src/*`.
- Android package and iOS bundle ID: `org.ligi.survivalmanual`. Android `versionCode` ≥ 600.
- No runtime network access: no analytics, no remote fetches, no EAS Update.
- Content source: `android/src/main/assets/md` (git submodule `SurvivalManual.wiki`). Only slugs in `src/toc.ts` are built.
- `IGNORED_LINKS = ['LifeStraw', 'SolarUSBCharger', 'OHTMultiTool']` render as plain text.
- Font size formula: `8 + 4 * step`, step 0–4, default 2.
- Theme modes: `system | day | night | amoled`.
- Recents: max 10, most recent first, no duplicates.
- Search: MiniSearch `prefix: true`, `fuzzy: 0.2`, `boost: { heading: 2 }`. Try `combineWith: 'AND'` first and fall back to `'OR'` when it returns nothing.
- The drawer is permanent at window width ≥ 900, otherwise a slide-in (`front`) drawer.
- Morse timing: dot 1, dash 3, gap inside a letter 1, between letters 3, between words 7 units; `unitMs = 1200 / wpm`; wpm 5–20.
- Storage: `expo-sqlite/kv-store` on iOS/Android and `localStorage` on Web. Unreadable stored data falls back to defaults and never blocks startup.
- Commit after every task. End each commit message with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TcCDyooGxpdtGAGPhRXdEh
  ```
- Unless a step says otherwise, run every command from `app/`, i.e. `/home/guido/DevPessoal/SurvivalManual/app`.

## Review Focus

These five inputs aren't driven by any feature but are the most likely to hurt real users. Each has a test pinned in the task that owns the code:

1. **Stale reading position after a content update.** The saved `last.blockIndex` is past the chapter's end, or `last.slug` no longer exists. Expected: the app clamps to the last block, or opens the first chapter. Tests: Task 10 (`resolveInitialBlock`) and Task 11 (index redirect).
2. **Malformed route params from deep links or web URLs.** Examples: `/chapter/Water?block=abc`, `?block=-3`, `?anchor=nope`, `/image/missing.png`. Expected: the chapter opens at a sensible block, or a "not found" screen appears; nothing crashes. Tests: Task 10, Task 15.
3. **Search queries made only of punctuation, regex characters or spaces.** Examples: `"("`, `"c++"`, `"   "`. Expected: no exception; either no results or sensible ones. Tests: Task 5, Task 6.
4. **Corrupt or unreadable persisted data.** Example: invalid JSON in a store key. Expected: that store resets to defaults, hydration completes, and the app renders. Test: Task 7.
5. **Morse input with no encodable characters.** Examples: emoji, CJK, `###`. Expected: the characters are reported as skipped, Start is disabled, and no empty timeline runs. Tests: Task 19, Task 20.

---

### Task 1: Scaffold the Expo project, Jest, lint

**Files:**
- Create: `app/` (from the `blank-typescript@sdk-56` template), `app/src/app/index.tsx`, `app/jest.setup.ts`, `app/src/__tests__/smoke.test.tsx`
- Modify: `app/package.json`, `app/tsconfig.json`, `app/app.json`, `app/.gitignore`
- Delete: `app/App.tsx`, `app/index.ts`

**Interfaces:**
- Produces: a runnable Expo Router app; `npm test` runs Jest; the alias `@/` maps to `src/`.

- [ ] **Step 1: Create the project and install dependencies**

From the repo root `/home/guido/DevPessoal/SurvivalManual`:

```bash
npx create-expo-app@latest app --template blank-typescript@sdk-56 --no-install
cd app
npm install
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar react-native-gesture-handler react-native-reanimated react-native-worklets expo-sqlite expo-localization expo-keep-awake expo-speech expo-camera expo-location expo-audio @expo/vector-icons expo-font react-dom react-native-web
npm install zustand i18next react-i18next minisearch
npm install -D jest jest-expo @testing-library/react-native @types/jest @types/node tsx unified remark-parse remark-gfm remark-rehype rehype-raw rehype-slug @types/hast fast-xml-parser image-size@^2 workbox-build
rm App.tsx index.ts
```

- [ ] **Step 2: Configure `package.json`**

Set `"main": "expo-router/entry"` and merge in these `scripts` and `jest` keys. Keep the template's other keys.

```json
{
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "lint": "expo lint",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFiles": ["./jest.setup.ts"],
    "testPathIgnorePatterns": ["/node_modules/", "/scripts/"],
    "moduleNameMapper": { "^@/(.*)$": "<rootDir>/src/$1" }
  }
}
```

- [ ] **Step 3: Configure `tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "resolveJsonModule": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", "**/*.mts", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 4: Configure `app.json`**

Replace the whole file:

```json
{
  "expo": {
    "name": "Survival Manual",
    "slug": "survival-manual",
    "scheme": "survivalmanual",
    "version": "6.0.0",
    "orientation": "default",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": { "image": "./assets/icon.png", "resizeMode": "contain", "backgroundColor": "#455440" },
    "ios": { "bundleIdentifier": "org.ligi.survivalmanual", "supportsTablet": true },
    "android": { "package": "org.ligi.survivalmanual", "versionCode": 600 },
    "web": { "output": "static", "bundler": "metro", "favicon": "./assets/favicon.png" },
    "plugins": [
      "expo-router",
      "expo-sqlite",
      "expo-localization",
      ["expo-camera", { "cameraPermission": "Used only to switch on the flashlight for SOS signals.", "microphonePermission": false, "recordAudioAndroid": false }],
      ["expo-location", { "locationWhenInUsePermission": "Used only to show true north on the compass." }],
      ["expo-audio", { "microphonePermission": false, "recordAudioAndroid": false }]
    ]
  }
}
```

Copy the existing icon: `cp ../assets/icon_512.png assets/icon.png`. Use Context7 (`/expo/expo/__branch__sdk-56`) to check the option names of the `expo-camera`, `expo-location` and `expo-audio` config plugins. If a name differs, use the documented one.

- [ ] **Step 5: Append to `app/.gitignore`**

```
# generated by scripts/build-content.mts
src/content/
assets/content/
dist/
```

- [ ] **Step 6: Write `jest.setup.ts`**

```ts
import 'react-native-gesture-handler/jestSetup';

jest.mock('expo-sqlite/kv-store', () => {
  const map = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => map.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        map.set(k, v);
      }),
      removeItem: jest.fn(async (k: string) => {
        map.delete(k);
      }),
      __map: map,
    },
  };
});

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => {}),
  deactivateKeepAwake: jest.fn(async () => {}),
  useKeepAwake: jest.fn(),
}));
```

- [ ] **Step 7: Write the failing smoke test**

`src/__tests__/smoke.test.tsx`:

```tsx
import { renderRouter, screen } from 'expo-router/testing-library';
import Index from '@/app/index';

it('renders the root route', () => {
  renderRouter({ index: Index }, { initialUrl: '/' });
  expect(screen.getByText('Survival Manual')).toBeVisible();
});
```

- [ ] **Step 8: Run it and confirm it fails**

Run: `npx jest src/__tests__/smoke.test.tsx`
Expected: FAIL with `Cannot find module '@/app/index'`.

- [ ] **Step 9: Add the placeholder route**

`src/app/index.tsx`:

```tsx
import { Text } from 'react-native';

export default function Index() {
  return <Text>Survival Manual</Text>;
}
```

- [ ] **Step 10: Run the test and lint**

Run: `npx jest src/__tests__/smoke.test.tsx` → PASS.
Run: `npx expo lint` → this creates `eslint.config.js` on the first run; then it should exit 0.
Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 11: Commit**

```bash
cd /home/guido/DevPessoal/SurvivalManual
git add app
git commit -m "feat(app): scaffold Expo SDK 56 project with router, jest and lint"
```

---

### Task 2: Content types, block text, chapter list, i18n

**Files:**
- Create: `app/src/types/content.ts`, `app/src/lib/blockText.ts`, `app/src/toc.ts`, `app/scripts/convert-strings.mts`, `app/src/i18n/index.ts`, `app/src/i18n/locales/en.json`, `app/src/i18n/locales/legacy.en.json` (generated), `app/src/i18n/locales/legacy.fr.json` (generated)
- Test: `app/src/lib/__tests__/blockText.test.ts`, `app/src/__tests__/toc.test.ts`
- Modify: `app/jest.setup.ts`

**Interfaces:**
- Produces:
  - `Inline`, `Block`, `Chapter`, `ImageAsset`, `SearchDoc` (types in `@/types/content`)
  - `inlineText(nodes: Inline[]): string`, `blockText(block: Block): string`
  - `TocEntry`, `toc: TocEntry[]`, `tocBySlug: Map<string, TocEntry>`, `IGNORED_LINKS: string[]`
  - `i18n` (default export), `pickLanguage(override?: string): 'en' | 'fr'`, `languages`

- [ ] **Step 1: Write the types**

`src/types/content.ts`:

```ts
export type Inline =
  | { type: 'text'; value: string }
  | { type: 'inlineCode'; value: string }
  | { type: 'emphasis' | 'strong' | 'delete'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'image'; src: string; alt: string }
  | { type: 'break' };

export type Block =
  | { type: 'heading'; depth: 1 | 2 | 3 | 4 | 5 | 6; anchor?: string; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'table'; header: boolean; rows: Block[][][] }
  | { type: 'image'; src: string; alt: string }
  | { type: 'code'; value: string }
  | { type: 'thematicBreak' };

export type Chapter = { slug: string; blocks: Block[]; anchors: Record<string, number> };

export type ImageAsset = { source: number; width: number; height: number };

export type SearchDoc = { id: string; slug: string; block: number; heading: string; body: string };
```

- [ ] **Step 2: Write the failing `blockText` test**

`src/lib/__tests__/blockText.test.ts`:

```ts
import { blockText, inlineText } from '@/lib/blockText';
import type { Block } from '@/types/content';

it('flattens inline formatting', () => {
  expect(
    inlineText([
      { type: 'text', value: 'Boil ' },
      { type: 'strong', children: [{ type: 'text', value: 'water' }] },
      { type: 'break' },
      { type: 'link', href: '/chapter/Fire', children: [{ type: 'text', value: 'fire' }] },
      { type: 'image', src: 'a.png', alt: 'Figure' },
    ]),
  ).toBe('Boil water\nfireFigure');
});

it('flattens nested blocks', () => {
  const list: Block = {
    type: 'list',
    ordered: false,
    start: 1,
    items: [[{ type: 'paragraph', children: [{ type: 'text', value: 'a' }] }], [{ type: 'code', value: 'b' }]],
  };
  const table: Block = {
    type: 'table',
    header: true,
    rows: [[[{ type: 'paragraph', children: [{ type: 'text', value: 'x' }] }], [{ type: 'paragraph', children: [{ type: 'text', value: 'y' }] }]]],
  };
  expect(blockText(list)).toBe('a\nb');
  expect(blockText(table)).toBe('x | y');
  expect(blockText({ type: 'thematicBreak' })).toBe('');
  expect(blockText({ type: 'image', src: 'a.png', alt: 'Alt' })).toBe('Alt');
});
```

Run: `npx jest src/lib/__tests__/blockText.test.ts` → FAIL (the module is missing).

- [ ] **Step 3: Implement `src/lib/blockText.ts`**

```ts
import type { Block, Inline } from '@/types/content';

export function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
        case 'inlineCode':
          return n.value;
        case 'break':
          return '\n';
        case 'image':
          return n.alt;
        default:
          return inlineText(n.children);
      }
    })
    .join('');
}

export function blockText(block: Block): string {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return inlineText(block.children);
    case 'list':
      return block.items.map((item) => item.map(blockText).join('\n')).join('\n');
    case 'blockquote':
      return block.children.map(blockText).join('\n');
    case 'table':
      return block.rows.map((row) => row.map((cell) => cell.map(blockText).join(' ')).join(' | ')).join('\n');
    case 'image':
      return block.alt;
    case 'code':
      return block.value;
    case 'thematicBreak':
      return '';
  }
}
```

Run the test → PASS.

- [ ] **Step 4: Write the strings converter and run it**

`scripts/convert-strings.mts`:

```ts
// One-off: converts the legacy Android strings.xml files to i18next JSON.
// Output is committed. New UI strings go in src/i18n/locales/<lang>.json, never here.
import { readFileSync, writeFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

const RES = new URL('../../android/src/main/res/', import.meta.url);
const OUT = new URL('../src/i18n/locales/', import.meta.url);
const LOCALES: Record<string, string> = { en: 'values', fr: 'values-fr' };
const SKIP = new Set(['help_text']);

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: 'text', parseTagValue: false, isArray: (n) => n === 'string' });
const unescape = (s: string) => s.trim().replace(/\\n/g, '\n').replace(/\\(['"@?\\])/g, '$1');

for (const [lang, dir] of Object.entries(LOCALES)) {
  const xml = readFileSync(new URL(`${dir}/strings.xml`, RES), 'utf8');
  const entries: { name: string; text?: string; translatable?: string }[] = parser.parse(xml).resources.string ?? [];
  const out: Record<string, string> = {};
  for (const e of entries) {
    if (e.translatable === 'false' || SKIP.has(e.name) || e.text == null) continue;
    out[e.name] = unescape(String(e.text));
  }
  writeFileSync(new URL(`legacy.${lang}.json`, OUT), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`legacy.${lang}.json: ${Object.keys(out).length} strings`);
}
```

Run: `mkdir -p src/i18n/locales && npx tsx scripts/convert-strings.mts`
Expected: `legacy.en.json: 61 strings` and `legacy.fr.json` with about 50 strings. Open `legacy.en.json` and check that `"water": "Water"`, `"basic_medicine": "Basic Medicine"` and `"appendix": "Appendix"` are present.

- [ ] **Step 5: Write `src/i18n/locales/en.json` (new UI strings)**

```json
{
  "chapters": "Chapters",
  "tools_section": "Tools",
  "bookmarks": "Bookmarks",
  "recents": "Recently read",
  "checklists": "Checklists",
  "sos": "SOS signal",
  "compass": "Compass",
  "emergency_card": "Emergency card",
  "chapter_not_found": "Chapter not found",
  "checklist_not_found": "List not found",
  "image_not_found": "Image not found",
  "back_to_contents": "Back to contents",
  "bookmark_add": "Add bookmark",
  "bookmark_remove": "Remove bookmark",
  "read_aloud": "Read aloud",
  "stop_reading": "Stop reading",
  "find_in_chapter": "Find in chapter",
  "match_of": "{{current}} of {{total}}",
  "no_matches": "No matches",
  "previous": "Previous",
  "next": "Next",
  "close": "Close",
  "delete": "Delete",
  "search_placeholder": "Search the manual",
  "search_no_results": "Nothing found for “{{q}}”",
  "bookmarks_empty": "No bookmarks yet. Tap the bookmark icon while reading.",
  "recents_empty": "Nothing read yet.",
  "amoled": "True black (AMOLED)",
  "keep_awake": "Keep the screen on while reading",
  "tts_rate": "Reading speed",
  "language": "Language",
  "language_system": "System default",
  "font_preview": "Find water, make fire, build shelter.",
  "checklists_empty": "No lists yet.",
  "checklist_new": "New list",
  "checklist_from_template": "Start from a template",
  "checklist_blank": "Blank list",
  "checklist_add_item": "Add item",
  "checklist_reset": "Untick all",
  "checklist_delete": "Delete list",
  "checklist_delete_confirm": "Tap again to delete",
  "checklist_title": "List name",
  "template_kit": "Survival kit",
  "template_72h": "72-hour plan",
  "template_medical": "Medical kit",
  "ec_name": "Name",
  "ec_blood": "Blood type",
  "ec_allergies": "Allergies",
  "ec_medications": "Medications",
  "ec_conditions": "Medical conditions",
  "ec_notes": "Notes",
  "ec_contacts": "Emergency contacts",
  "ec_contact_name": "Contact name",
  "ec_contact_phone": "Phone",
  "ec_add_contact": "Add contact",
  "ec_local_only": "Stored only on this device. Never uploaded.",
  "ec_show_rescuer": "Show to rescuer",
  "ec_rescuer_title": "EMERGENCY INFORMATION",
  "sos_message": "Message",
  "sos_code": "Morse code",
  "sos_speed": "Speed: {{wpm}} words per minute",
  "sos_slower": "Slower",
  "sos_faster": "Faster",
  "sos_torch": "Flashlight",
  "sos_screen": "Screen strobe",
  "sos_tone": "Sound",
  "sos_loop": "Repeat",
  "sos_start": "Start",
  "sos_stop": "Stop",
  "sos_no_torch": "Flashlight unavailable on this device",
  "sos_torch_permission": "Camera permission is needed to use the flashlight",
  "sos_skipped": "Skipped (no Morse code): {{chars}}",
  "compass_unavailable": "A compass is not available on this device.",
  "compass_calibrate": "Low accuracy: move your phone in a figure-8 to calibrate.",
  "compass_permission": "Location permission is needed for true north. Showing magnetic north.",
  "compass_learn": "Find direction without a compass",
  "compass_true": "True north",
  "compass_magnetic": "Magnetic north"
}
```

- [ ] **Step 6: Write `src/i18n/index.ts`**

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import legacyEn from './locales/legacy.en.json';
import legacyFr from './locales/legacy.fr.json';

export const languages = ['en', 'fr'] as const;
export type Language = (typeof languages)[number];

export function pickLanguage(override?: string): Language {
  const tag = override ?? getLocales()[0]?.languageCode ?? 'en';
  return (languages as readonly string[]).includes(tag) ? (tag as Language) : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...legacyEn, ...en } },
    fr: { translation: legacyFr },
  },
  lng: pickLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
```

Append to `jest.setup.ts`: `import '@/i18n';`

- [ ] **Step 7: Write the failing chapter-list test**

`src/__tests__/toc.test.ts`:

```ts
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
  expect(toc.filter((e) => e.appendix).map((e) => e.slug)).toEqual(['MultiTool', 'DangerousArthropods', 'FishAndMollusks', 'RopesAndKnots', 'FAQ']);
  expect(tocBySlug.get('TranslatorNotes')?.listed).toBe(false);
  expect(IGNORED_LINKS).toEqual(['LifeStraw', 'SolarUSBCharger', 'OHTMultiTool']);
});
```

Run → FAIL (the module is missing).

- [ ] **Step 8: Implement `src/toc.ts`**

This is a port of `android/src/main/kotlin/org/ligi/survivalmanual/model/NavigationDefinitions.kt`:

```ts
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
```

Run: `npx jest src/__tests__/toc.test.ts src/lib` → PASS. Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 9: Commit**

```bash
git add app && git commit -m "feat(app): content types, block text, toc and i18n with legacy strings"
```

---

### Task 3: Markdown → block converter

**Files:**
- Create: `app/scripts/content/convert.mts`
- Test: `app/scripts/content/convert.test.mts`
- Modify: `app/package.json` (add the `test:content` script)

**Interfaces:**
- Consumes: `Block`, `Inline`, `Chapter` from `src/types/content.ts`.
- Produces:
  - `convertMarkdown(slug: string, md: string, opts: ConvertOptions): Converted`
  - `type ConvertOptions = { ignored: Set<string> }`
  - `type LinkRef = { slug: string; anchor?: string }`
  - `type Converted = { chapter: Chapter; links: LinkRef[]; images: string[] }`
  - Internal links become `href = '/chapter/<Slug>'` or `'/chapter/<Slug>?anchor=<a>'`. Links to image files become `'/image/<name>'`.

- [ ] **Step 1: Add the script to `package.json`**

`"test:content": "tsx --test scripts/content/*.test.mts"`

- [ ] **Step 2: Write the failing tests**

`scripts/content/convert.test.mts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertMarkdown } from './convert';

const opts = { ignored: new Set(['LifeStraw']) };
const conv = (md: string, slug = 'Cur') => convertMarkdown(slug, md, opts);

test('headings get anchors and are indexed', () => {
  const { chapter } = conv('# Water Sources\n\nSome text');
  assert.deepEqual(chapter.blocks[0], { type: 'heading', depth: 1, anchor: 'water-sources', children: [{ type: 'text', value: 'Water Sources' }] });
  assert.equal(chapter.anchors['water-sources'], 0);
  assert.equal(chapter.blocks[1].type, 'paragraph');
});

test('soft line breaks collapse to spaces', () => {
  const { chapter } = conv('a\nb');
  assert.deepEqual(chapter.blocks, [{ type: 'paragraph', children: [{ type: 'text', value: 'a b' }] }]);
});

test('inline formatting', () => {
  const { chapter } = conv('**b** _e_ ~~d~~ `c`');
  const p = chapter.blocks[0];
  assert.equal(p.type, 'paragraph');
  if (p.type !== 'paragraph') return;
  assert.deepEqual(p.children.map((n) => n.type), ['strong', 'text', 'emphasis', 'text', 'delete', 'text', 'inlineCode']);
});

test('nested and ordered lists', () => {
  const { chapter } = conv('3. one\n4. two\n\n* a\n  * b');
  const [ol, ul] = chapter.blocks;
  assert.equal(ol.type === 'list' && ol.ordered && ol.start, 3);
  assert.ok(ul.type === 'list' && !ul.ordered);
  if (ul.type !== 'list') return;
  assert.equal(ul.items[0][0].type, 'paragraph');
  assert.equal(ul.items[0][1].type, 'list');
});

test('gfm table', () => {
  const { chapter } = conv('| h1 | h2 |\n|----|----|\n| a | b |');
  const t = chapter.blocks[0];
  assert.ok(t.type === 'table' && t.header);
  if (t.type !== 'table') return;
  assert.equal(t.rows.length, 2);
  assert.deepEqual(t.rows[1][0], [{ type: 'paragraph', children: [{ type: 'text', value: 'a' }] }]);
});

test('raw HTML table with a list in a cell', () => {
  const { chapter } = conv('<table><tr><td><ul><li>x</li></ul></td></tr></table>');
  const t = chapter.blocks[0];
  assert.ok(t.type === 'table' && !t.header);
  if (t.type !== 'table') return;
  assert.equal(t.rows[0][0][0].type, 'list');
});

test('standalone <a name> anchors point at the next block; image-only paragraphs become image blocks', () => {
  const { chapter, images } = conv('Intro\n\n<a name="fig7-4"></a>\n\n![Figure 7-4\\. Thing](fig07-04.png) ![Second](b.png)');
  assert.deepEqual(chapter.blocks.slice(1), [
    { type: 'image', src: 'fig07-04.png', alt: 'Figure 7-4. Thing' },
    { type: 'image', src: 'b.png', alt: 'Second' },
  ]);
  assert.equal(chapter.anchors['fig7-4'], 1);
  assert.deepEqual(images.sort(), ['b.png', 'fig07-04.png']);
});

test('inline anchors point at their own block', () => {
  const { chapter } = conv('First\n\nText <a name="x"></a> more');
  assert.equal(chapter.anchors.x, 1);
});

test('links: internal, same-page anchor, ignored, external, image', () => {
  const { chapter, links } = conv('[Food](Food) [f](#fig8-24) [ls](LifeStraw) [w](https://x.org) [img](pic.png)');
  const p = chapter.blocks[0];
  if (p.type !== 'paragraph') return assert.fail('expected paragraph');
  const hrefs = p.children.flatMap((n) => (n.type === 'link' ? [n.href] : []));
  assert.deepEqual(hrefs, ['/chapter/Food', '/chapter/Cur?anchor=fig8-24', 'https://x.org', '/image/pic.png']);
  assert.ok(p.children.some((n) => n.type === 'text' && n.value.includes('ls')));
  assert.deepEqual(links, [{ slug: 'Food', anchor: undefined }, { slug: 'Cur', anchor: 'fig8-24' }]);
});

test('wrapper elements are unwrapped', () => {
  const { chapter } = conv('<center><font color="#fff">Hi</font></center>');
  assert.deepEqual(chapter.blocks, [{ type: 'paragraph', children: [{ type: 'text', value: 'Hi' }] }]);
});

test('blockquote, code and rule', () => {
  const { chapter } = conv('> quoted\n\n```\nx = 1\n```\n\n---');
  assert.deepEqual(chapter.blocks.map((b) => b.type), ['blockquote', 'code', 'thematicBreak']);
  assert.deepEqual(chapter.blocks[1], { type: 'code', value: 'x = 1' });
});
```

Run: `npm run test:content` → FAIL (`./convert` is missing).

- [ ] **Step 3: Implement `scripts/content/convert.mts`**

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import type { Element, ElementContent, Root, RootContent } from 'hast';
import type { Block, Chapter, Inline } from '../../src/types/content';

export type LinkRef = { slug: string; anchor?: string };
export type ConvertOptions = { ignored: Set<string> };
export type Converted = { chapter: Chapter; links: LinkRef[]; images: string[] };

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypeSlug);

const BLOCK_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'blockquote', 'table', 'pre', 'hr']);
const HEADINGS: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const IMAGE_FILE = /\.(png|jpe?g|gif|webp)$/i;

type Node = RootContent | ElementContent;
type ImageInline = Extract<Inline, { type: 'image' }>;

const isElement = (n: Node): n is Element => n.type === 'element';
const hasBlockDescendant = (el: Element): boolean =>
  el.children.some((c) => isElement(c) && (BLOCK_TAGS.has(c.tagName) || hasBlockDescendant(c)));
const textOf = (n: Node): string => (n.type === 'text' ? n.value : isElement(n) ? n.children.map(textOf).join('') : '');

class Converter {
  private anchors: string[] = [];
  links: LinkRef[] = [];
  images = new Set<string>();

  constructor(
    private slug: string,
    private opts: ConvertOptions,
  ) {}

  takeAnchors(): string[] {
    const a = this.anchors;
    this.anchors = [];
    return a;
  }

  blocks(nodes: Node[]): Block[] {
    const out: Block[] = [];
    let run: Inline[] = [];
    const flush = () => {
      out.push(...this.paragraph(run));
      run = [];
    };
    const visit = (node: Node) => {
      if (node.type === 'text') {
        run.push(...this.inline(node));
        return;
      }
      if (!isElement(node)) return;
      if (BLOCK_TAGS.has(node.tagName)) {
        flush();
        this.collectAnchor(node);
        out.push(...this.block(node));
        return;
      }
      if (hasBlockDescendant(node)) {
        // Wrapper such as <center>/<div>/<font> around blocks: unwrap.
        this.collectAnchor(node);
        node.children.forEach(visit);
        return;
      }
      run.push(...this.inline(node));
    };
    nodes.forEach(visit);
    flush();
    return out;
  }

  private block(el: Element): Block[] {
    const tag = el.tagName;
    const depth = HEADINGS[tag];
    if (depth) {
      const id = el.properties.id;
      return [{ type: 'heading', depth, anchor: id != null ? String(id) : undefined, children: trimInlines(el.children.flatMap((c) => this.inline(c))) }];
    }
    switch (tag) {
      case 'p':
        return this.paragraph(el.children.flatMap((c) => this.inline(c)));
      case 'ul':
      case 'ol':
        return [
          {
            type: 'list',
            ordered: tag === 'ol',
            start: Number(el.properties.start ?? 1) || 1,
            items: el.children
              .filter(isElement)
              .filter((c) => c.tagName === 'li')
              .map((li) => {
                this.collectAnchor(li);
                return this.blocks(li.children);
              }),
          },
        ];
      case 'blockquote':
        return [{ type: 'blockquote', children: this.blocks(el.children) }];
      case 'table': {
        const rows = this.rows(el);
        if (!rows.length) return [];
        return [{ type: 'table', header: rows[0].every((c) => c.tagName === 'th'), rows: rows.map((r) => r.map((cell) => this.blocks(cell.children))) }];
      }
      case 'pre':
        return [{ type: 'code', value: textOf(el).replace(/\n$/, '') }];
      case 'hr':
        return [{ type: 'thematicBreak' }];
      default:
        return [];
    }
  }

  private rows(el: Element): Element[][] {
    return el.children.filter(isElement).flatMap((c): Element[][] => {
      if (c.tagName === 'tr') return [c.children.filter(isElement).filter((td) => td.tagName === 'td' || td.tagName === 'th')];
      if (c.tagName === 'thead' || c.tagName === 'tbody' || c.tagName === 'tfoot') return this.rows(c);
      return [];
    });
  }

  private inline(node: Node): Inline[] {
    if (node.type === 'text') return [{ type: 'text', value: node.value.replace(/\s+/g, ' ') }];
    if (!isElement(node)) return [];
    this.collectAnchor(node);
    const kids = () => node.children.flatMap((c) => this.inline(c));
    switch (node.tagName) {
      case 'em':
      case 'i':
        return [{ type: 'emphasis', children: kids() }];
      case 'strong':
      case 'b':
        return [{ type: 'strong', children: kids() }];
      case 'del':
      case 's':
        return [{ type: 'delete', children: kids() }];
      case 'code':
        return [{ type: 'inlineCode', value: textOf(node) }];
      case 'br':
        return [{ type: 'break' }];
      case 'img': {
        const src = String(node.properties.src ?? '');
        if (!src) return [];
        this.images.add(src);
        return [{ type: 'image', src, alt: String(node.properties.alt ?? '') }];
      }
      case 'a':
        return node.properties.href != null ? this.link(String(node.properties.href), kids()) : kids();
      default:
        return kids();
    }
  }

  private link(href: string, children: Inline[]): Inline[] {
    if (SCHEME.test(href)) return [{ type: 'link', href, children }];
    const hash = href.indexOf('#');
    const path = decodeURIComponent(hash === -1 ? href : href.slice(0, hash));
    const anchor = hash === -1 ? undefined : decodeURIComponent(href.slice(hash + 1)) || undefined;
    if (IMAGE_FILE.test(path)) {
      this.images.add(path);
      return [{ type: 'link', href: `/image/${encodeURIComponent(path)}`, children }];
    }
    const slug = path || this.slug;
    if (this.opts.ignored.has(slug)) return children;
    this.links.push({ slug, anchor });
    return [{ type: 'link', href: `/chapter/${encodeURIComponent(slug)}${anchor ? `?anchor=${encodeURIComponent(anchor)}` : ''}`, children }];
  }

  private paragraph(run: Inline[]): Block[] {
    const content = run.filter((n) => !(n.type === 'text' && !n.value.trim()) && n.type !== 'break');
    if (!content.length) return [];
    if (content.every((n) => n.type === 'image')) {
      return (content as ImageInline[]).map((n) => ({ type: 'image', src: n.src, alt: n.alt }));
    }
    return [{ type: 'paragraph', children: trimInlines(run) }];
  }

  private collectAnchor(el: Element) {
    const id = el.properties.id ?? (el.tagName === 'a' && el.properties.href == null ? el.properties.name : undefined);
    if (id != null && id !== '') this.anchors.push(String(id));
  }
}

function trimInlines(nodes: Inline[]): Inline[] {
  const merged: Inline[] = [];
  for (const n of nodes) {
    const prev = merged[merged.length - 1];
    if (n.type === 'text' && prev?.type === 'text') merged[merged.length - 1] = { type: 'text', value: prev.value + n.value };
    else merged.push(n);
  }
  while (merged[0]?.type === 'break') merged.shift();
  while (merged[merged.length - 1]?.type === 'break') merged.pop();
  const first = merged[0];
  if (first?.type === 'text') merged[0] = { type: 'text', value: first.value.trimStart() };
  const lastIndex = merged.length - 1;
  const last = merged[lastIndex];
  if (last?.type === 'text') merged[lastIndex] = { type: 'text', value: last.value.trimEnd() };
  return merged.filter((n) => !(n.type === 'text' && n.value === ''));
}

export function convertMarkdown(slug: string, md: string, opts: ConvertOptions): Converted {
  const tree = processor.runSync(processor.parse(md)) as Root;
  const c = new Converter(slug, opts);
  const blocks: Block[] = [];
  const anchors: Record<string, number> = {};
  let pending: string[] = [];
  for (const node of tree.children) {
    const produced = c.blocks([node]);
    pending.push(...c.takeAnchors());
    if (!produced.length) continue;
    for (const a of pending) anchors[a] ??= blocks.length;
    pending = [];
    blocks.push(...produced);
  }
  for (const a of pending) anchors[a] ??= Math.max(blocks.length - 1, 0);
  return { chapter: { slug, blocks, anchors }, links: c.links, images: [...c.images] };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm run test:content` → every test passes. If the `<a name>` test fails because parse5 nests elements differently than expected, print the tree with `console.dir(processor.runSync(processor.parse(md)), { depth: 8 })`. Then fix the converter so the anchor maps to the block that follows it. Don't change the test.

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat(content): convert wiki markdown and raw HTML into app block trees"
```

---

### Task 4: Content build, validation, search index, CI

**Files:**
- Create: `app/src/search/options.ts`, `app/scripts/content/sections.mts`, `app/scripts/content/validate.mts`, `app/scripts/build-content.mts`, `.github/workflows/expo.yml`
- Test: `app/scripts/content/build.test.mts`
- Modify: `app/package.json`

**Interfaces:**
- Consumes: `convertMarkdown`, `Converted` (Task 3); `toc`, `IGNORED_LINKS` (Task 2); `blockText` (Task 2).
- Produces:
  - `fold(s: string): string`, `indexOptions: Options<SearchDoc>`, `queryOptions: SearchOptions` (in `@/search/options`)
  - `sectionsOf(chapter: Chapter, title: string): SearchDoc[]`
  - `validate(converted: Map<string, Converted>, fileExists: (name: string) => boolean): { errors: string[]; warnings: string[] }`
  - `buildContent(input: BuildInput): { warnings: string[] }`, which throws `Error` listing every error
  - Generated files:
    - `src/content/chapters/<slug>.json`
    - `src/content/chapters.ts`, which exports `chapterLoaders: Record<string, () => Chapter>`
    - `src/content/images.ts`, which exports `images: Record<string, ImageAsset>`
    - `src/content/search-index.json`
    - `assets/content/<image files>`

- [ ] **Step 1: Write `src/search/options.ts`**

```ts
import type { Options, SearchOptions } from 'minisearch';
import type { SearchDoc } from '@/types/content';

// Case- and accent-insensitive comparison key. Shared by indexing, querying and highlighting.
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const indexOptions: Options<SearchDoc> = {
  idField: 'id',
  fields: ['heading', 'body'],
  storeFields: ['slug', 'block', 'heading', 'body'],
  processTerm: (term) => fold(term),
};

export const queryOptions: SearchOptions = { prefix: true, fuzzy: 0.2, boost: { heading: 2 } };
```

- [ ] **Step 2: Write the failing build tests**

`scripts/content/build.test.mts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContent } from '../build-content';
import { sectionsOf } from './sections';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function setup(files: Record<string, string | Buffer>) {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  const src = join(dir, 'md');
  mkdirSync(src);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(src, name), body);
  return { src, out: join(dir, 'out'), imgOut: join(dir, 'img') };
}
const input = (dirs: ReturnType<typeof setup>, slugs = ['Alpha', 'Beta']) => ({
  ...dirs,
  slugs,
  titles: { Alpha: 'Alpha', Beta: 'Beta' },
  ignored: ['LifeStraw'],
});

test('builds chapters, loaders, images and index', () => {
  const dirs = setup({ 'Alpha.md': '# A\n\nWater [b](Beta) [ls](LifeStraw)\n\n![Fig](pic.png)', 'Beta.md': 'Fire', 'pic.png': PNG });
  const { warnings } = buildContent(input(dirs));
  assert.deepEqual(warnings, []);
  assert.ok(existsSync(join(dirs.out, 'chapters', 'Alpha.json')));
  assert.match(readFileSync(join(dirs.out, 'chapters.ts'), 'utf8'), /"Beta": \(\) => require\("\.\/chapters\/Beta\.json"\)/);
  const images = readFileSync(join(dirs.out, 'images.ts'), 'utf8');
  assert.match(images, /"pic\.png": \{ source: require\(".*pic\.png"\), width: 1, height: 1 \}/);
  assert.ok(existsSync(join(dirs.imgOut, 'pic.png')));
  assert.ok(JSON.parse(readFileSync(join(dirs.out, 'search-index.json'), 'utf8')).documentCount >= 2);
});

test('fails on a missing chapter file, missing image or unknown link', () => {
  const dirs = setup({ 'Alpha.md': '![x](nope.png) [z](Zeta)' });
  assert.throws(() => buildContent(input(dirs)), (e: Error) => {
    assert.match(e.message, /Beta: missing markdown file/);
    assert.match(e.message, /Alpha: missing image "nope\.png"/);
    assert.match(e.message, /Alpha: link to unknown chapter "Zeta"/);
    return true;
  });
});

test('unknown anchors are warnings', () => {
  const dirs = setup({ 'Alpha.md': '[x](Beta#nowhere)', 'Beta.md': 'b' });
  assert.deepEqual(buildContent(input(dirs)).warnings, ['Alpha: link to unknown anchor "Beta#nowhere" (opens at top)']);
});

test('sections split at headings; text before the first heading uses the chapter title', () => {
  const docs = sectionsOf(
    { slug: 'S', anchors: {}, blocks: [
      { type: 'paragraph', children: [{ type: 'text', value: 'lead' }] },
      { type: 'heading', depth: 2, children: [{ type: 'text', value: 'H' }] },
      { type: 'paragraph', children: [{ type: 'text', value: 'one' }] },
      { type: 'paragraph', children: [{ type: 'text', value: 'two' }] },
    ] },
    'Title',
  );
  assert.deepEqual(docs, [
    { id: 'S#0', slug: 'S', block: 0, heading: 'Title', body: 'lead' },
    { id: 'S#1', slug: 'S', block: 1, heading: 'H', body: 'one\ntwo' },
  ]);
});
```

Run: `npm run test:content` → FAIL (the modules are missing).

- [ ] **Step 3: Implement `scripts/content/sections.mts`**

```ts
import { blockText } from '../../src/lib/blockText';
import type { Chapter, SearchDoc } from '../../src/types/content';

export function sectionsOf(chapter: Chapter, title: string): SearchDoc[] {
  const docs: SearchDoc[] = [];
  let cur: SearchDoc | undefined;
  for (let i = 0; i < chapter.blocks.length; i++) {
    const b = chapter.blocks[i];
    if (b.type === 'heading') {
      cur = { id: `${chapter.slug}#${i}`, slug: chapter.slug, block: i, heading: blockText(b), body: '' };
      docs.push(cur);
      continue;
    }
    if (!cur) {
      cur = { id: `${chapter.slug}#0`, slug: chapter.slug, block: 0, heading: title, body: '' };
      docs.push(cur);
    }
    const text = blockText(b).trim();
    if (text) cur.body = cur.body ? `${cur.body}\n${text}` : text;
  }
  return docs;
}
```

- [ ] **Step 4: Implement `scripts/content/validate.mts`**

```ts
import type { Converted } from './convert';

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function validate(converted: Map<string, Converted>, fileExists: (name: string) => boolean) {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const [slug, c] of converted) {
    for (const img of c.images) {
      if (!SCHEME.test(img) && !fileExists(img)) errors.push(`${slug}: missing image "${img}"`);
    }
    for (const l of c.links) {
      const target = converted.get(l.slug);
      if (!target) {
        errors.push(`${slug}: link to unknown chapter "${l.slug}"`);
        continue;
      }
      if (l.anchor && target.chapter.anchors[l.anchor] === undefined) {
        warnings.push(`${slug}: link to unknown anchor "${l.slug}#${l.anchor}" (opens at top)`);
      }
    }
  }
  return { errors, warnings };
}
```

- [ ] **Step 5: Implement `scripts/build-content.mts`**

```ts
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import MiniSearch from 'minisearch';
import { imageSize } from 'image-size';
import { convertMarkdown, type Converted } from './content/convert';
import { sectionsOf } from './content/sections';
import { validate } from './content/validate';
import { indexOptions } from '../src/search/options';
import { IGNORED_LINKS, toc } from '../src/toc';
import type { SearchDoc } from '../src/types/content';

export type BuildInput = { src: string; out: string; imgOut: string; slugs: string[]; titles: Record<string, string>; ignored: string[] };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const posix = (p: string) => p.split(sep).join('/');
const req = (from: string, to: string) => {
  const r = posix(relative(from, to));
  return JSON.stringify(r.startsWith('.') ? r : `./${r}`);
};

export function buildContent(i: BuildInput): { warnings: string[] } {
  const errors: string[] = [];
  const converted = new Map<string, Converted>();
  const opts = { ignored: new Set(i.ignored) };
  for (const slug of i.slugs) {
    const file = join(i.src, `${slug}.md`);
    if (!existsSync(file)) {
      errors.push(`${slug}: missing markdown file ${file}`);
      continue;
    }
    converted.set(slug, convertMarkdown(slug, readFileSync(file, 'utf8'), opts));
  }
  const checked = validate(converted, (name) => existsSync(join(i.src, name)));
  errors.push(...checked.errors);
  if (errors.length) throw new Error(`content build failed:\n${errors.join('\n')}`);

  rmSync(i.out, { recursive: true, force: true });
  rmSync(i.imgOut, { recursive: true, force: true });
  mkdirSync(join(i.out, 'chapters'), { recursive: true });
  mkdirSync(i.imgOut, { recursive: true });

  const index = new MiniSearch<SearchDoc>(indexOptions);
  const imageNames = new Set<string>();
  for (const [slug, c] of converted) {
    writeFileSync(join(i.out, 'chapters', `${slug}.json`), JSON.stringify(c.chapter));
    index.addAll(sectionsOf(c.chapter, i.titles[slug] ?? slug));
    for (const img of c.images) if (!SCHEME.test(img)) imageNames.add(img);
  }
  writeFileSync(join(i.out, 'search-index.json'), JSON.stringify(index));

  const loaders = [...converted.keys()].map((slug) => `  ${JSON.stringify(slug)}: () => require(${JSON.stringify(`./chapters/${slug}.json`)}),`);
  writeFileSync(
    join(i.out, 'chapters.ts'),
    `// generated by scripts/build-content.mts\nimport type { Chapter } from '@/types/content';\n\nexport const chapterLoaders: Record<string, () => Chapter> = {\n${loaders.join('\n')}\n};\n`,
  );

  const imageLines = [...imageNames].sort().map((name) => {
    const from = join(i.src, name);
    const to = join(i.imgOut, name);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    const { width, height } = imageSize(readFileSync(from));
    return `  ${JSON.stringify(name)}: { source: require(${req(i.out, to)}), width: ${width}, height: ${height} },`;
  });
  writeFileSync(
    join(i.out, 'images.ts'),
    `// generated by scripts/build-content.mts\nimport type { ImageAsset } from '@/types/content';\n\nexport const images: Record<string, ImageAsset> = {\n${imageLines.join('\n')}\n};\n`,
  );
  return { warnings: checked.warnings };
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const legacyEn: Record<string, string> = JSON.parse(readFileSync(join(root, 'src/i18n/locales/legacy.en.json'), 'utf8'));
  const { warnings } = buildContent({
    src: resolve(root, process.env.CONTENT_SRC ?? '../android/src/main/assets/md'),
    out: join(root, 'src/content'),
    imgOut: join(root, 'assets/content'),
    slugs: toc.map((e) => e.slug),
    titles: Object.fromEntries(toc.map((e) => [e.slug, legacyEn[e.titleKey] ?? e.slug])),
    ignored: IGNORED_LINKS,
  });
  for (const w of warnings) console.warn(`warn: ${w}`);
  console.log(`content: built ${toc.length} chapters`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
```

- [ ] **Step 6: Run the unit tests**

Run: `npm run test:content` → every test passes.

- [ ] **Step 7: Add the npm scripts and build the real content**

Add to `package.json` `scripts`:

```json
"content": "tsx scripts/build-content.mts",
"prestart": "npm run content",
"preweb": "npm run content",
"preandroid": "npm run content",
"preios": "npm run content",
"pretest": "npm run content",
"pretypecheck": "npm run content"
```

Run: `npm run content`
Expected: `content: built 34 chapters`, possibly preceded by `warn:` lines for unknown anchors. If it fails on a real link or image, read the error. Fix it in the converter when it's a conversion bug. When the wiki itself is broken (a link to a page that doesn't exist), add the slug to `IGNORED_LINKS` in `src/toc.ts` and tell the user in the task report. Then spot-check the output:

```bash
node -e "const c=require('./src/content/chapters/Fire.json'); console.log(c.blocks.length, Object.keys(c.anchors).filter(a=>a.startsWith('fig')).slice(0,5), c.blocks.filter(b=>b.type==='table').length)"
```

Expected: more than 50 blocks, `fig7-*` anchors listed, and at least 2 tables.

- [ ] **Step 8: Add CI**

`.github/workflows/expo.yml` (at the repo root):

```yaml
name: Expo app
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: app/package-lock.json
      - run: npm ci
      - run: npm run content
      - run: npx tsc --noEmit
      - run: npx expo lint
      - run: npm run test:content
      - run: npx jest --ci
```

- [ ] **Step 9: Run the full checks and commit**

Run: `npx tsc --noEmit && npx jest` → exit 0.

```bash
cd /home/guido/DevPessoal/SurvivalManual
git add app .github/workflows/expo.yml
git commit -m "feat(content): build chapters, image map and search index from the wiki; add CI"
```

---

### Task 5: Highlighting and excerpts

**Files:**
- Create: `app/src/search/highlight.ts`
- Test: `app/src/search/__tests__/highlight.test.ts`

**Interfaces:**
- Consumes: `fold` (Task 4).
- Produces:
  - `type Run = { text: string; match: boolean }`
  - `splitHighlights(text: string, terms: string[]): Run[]`
  - `excerpt(text: string, terms: string[], size?: number): string`
  - `queryTerms(q: string): string[]`

- [ ] **Step 1: Write the failing tests**

```ts
import { excerpt, queryTerms, splitHighlights } from '@/search/highlight';

const marked = (text: string, terms: string[]) =>
  splitHighlights(text, terms).map((r) => (r.match ? `[${r.text}]` : r.text)).join('');

describe('splitHighlights', () => {
  it('matches case-insensitively', () => expect(marked('Boil Water now', ['water'])).toBe('Boil [Water] now'));
  it('matches accents both ways', () => {
    expect(marked('Café au lait', ['cafe'])).toBe('[Café] au lait');
    expect(marked('Cafe', ['café'])).toBe('[Cafe]');
  });
  it('merges overlapping terms', () => expect(marked('waterproof', ['water', 'terpro'])).toBe('[water][pro]of'));
  it('returns one plain run without terms', () => expect(splitHighlights('abc', [])).toEqual([{ text: 'abc', match: false }]));
  it('handles empty text', () => expect(splitHighlights('', ['a'])).toEqual([{ text: '', match: false }]));
  it('treats regex characters literally', () => expect(marked('use c++ (rarely)', ['c++', '('])).toBe('use [c++] [(]rarely)'));
  it('preserves the original text', () => {
    const text = 'Ñandú und Größe';
    expect(splitHighlights(text, ['nandu', 'grosse']).map((r) => r.text).join('')).toBe(text);
  });
});

describe('excerpt', () => {
  const long = `${'lorem '.repeat(60)}purification of water ${'ipsum '.repeat(60)}`;
  it('centres on the first match and adds ellipses', () => {
    const e = excerpt(long, ['purification'], 80);
    expect(e).toContain('purification');
    expect(e.startsWith('…')).toBe(true);
    expect(e.endsWith('…')).toBe(true);
    expect(e.length).toBeLessThanOrEqual(82);
  });
  it('returns short text unchanged', () => expect(excerpt('short text', ['x'])).toBe('short text'));
  it('starts at the beginning without a match', () => expect(excerpt(long, ['zzz'], 40).startsWith('lorem')).toBe(true));
});

describe('queryTerms', () => {
  it('splits on spaces and punctuation', () => expect(queryTerms('  water, fire  ')).toEqual(['water', 'fire']));
  it('returns nothing for punctuation only', () => expect(queryTerms(' ( ) ')).toEqual([]));
});
```

Run: `npx jest src/search` → FAIL (the module is missing).

- [ ] **Step 2: Implement `src/search/highlight.ts`**

```ts
import MiniSearch from 'minisearch';
import { fold } from './options';

export type Run = { text: string; match: boolean };

const tokenize: (text: string) => string[] = MiniSearch.getDefault('tokenize');

export function queryTerms(q: string): string[] {
  return tokenize(q).filter(Boolean);
}

export function splitHighlights(text: string, terms: string[]): Run[] {
  const folded = terms.map(fold).filter(Boolean);
  if (!folded.length || !text) return [{ text, match: false }];
  // Build the folded text plus a map from folded index to original index.
  let haystack = '';
  const map: number[] = [];
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    const f = fold(ch);
    for (let k = 0; k < f.length; k++) map.push(i);
    haystack += f;
    i += ch.length;
  }
  map.push(text.length);
  const ranges: [number, number][] = [];
  for (const term of folded) {
    for (let at = haystack.indexOf(term); at !== -1; at = haystack.indexOf(term, at + term.length)) {
      ranges.push([map[at], map[at + term.length]]);
    }
  }
  if (!ranges.length) return [{ text, match: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const runs: Run[] = [];
  let pos = 0;
  for (const [s, e] of ranges) {
    if (e <= pos) continue;
    const start = Math.max(s, pos);
    if (start > pos) runs.push({ text: text.slice(pos, start), match: false });
    runs.push({ text: text.slice(start, e), match: true });
    pos = e;
  }
  if (pos < text.length) runs.push({ text: text.slice(pos), match: false });
  return runs;
}

export function excerpt(text: string, terms: string[], size = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= size) return flat;
  const f = fold(flat);
  let at = -1;
  for (const t of terms.map(fold).filter(Boolean)) {
    const i = f.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) at = 0;
  let start = Math.max(0, at - Math.floor(size / 3));
  let end = Math.min(flat.length, start + size);
  start = Math.max(0, end - size);
  if (start > 0) {
    const sp = flat.indexOf(' ', start);
    if (sp !== -1 && sp < at) start = sp + 1;
  }
  if (end < flat.length) {
    const sp = flat.lastIndexOf(' ', end);
    if (sp > at) end = sp;
  }
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}
```

- [ ] **Step 3: Run the tests**

Run: `npx jest src/search` → PASS.

- [ ] **Step 4: Commit**

```bash
git add app && git commit -m "feat(search): accent-insensitive highlighting and excerpts"
```

---

### Task 6: Search engine

**Files:**
- Create: `app/src/search/search.ts`
- Test: `app/src/search/__tests__/search.test.ts`

**Interfaces:**
- Consumes: `indexOptions`, `queryOptions` (Task 4); `excerpt`, `queryTerms` (Task 5); the generated `src/content/search-index.json`.
- Produces:
  - `type SectionHit = { slug: string; block: number; heading: string; excerpt: string }`
  - `type ChapterHits = { slug: string; sections: SectionHit[] }`
  - `searchManual(q: string, index?: MiniSearch<SearchDoc>): ChapterHits[]`
  - `loadIndex(): MiniSearch<SearchDoc>`

- [ ] **Step 1: Write the failing tests**

```ts
import MiniSearch from 'minisearch';
import { indexOptions } from '@/search/options';
import { searchManual } from '@/search/search';
import type { SearchDoc } from '@/types/content';

const docs: SearchDoc[] = [
  { id: 'Water#0', slug: 'Water', block: 0, heading: 'Water', body: 'Purification of water by boiling' },
  { id: 'Water#5', slug: 'Water', block: 5, heading: 'Filters', body: 'Improvised water filters' },
  { id: 'Fire#0', slug: 'Fire', block: 0, heading: 'Fire', body: 'Boil water over fire' },
];
const small = () => {
  const m = new MiniSearch<SearchDoc>(indexOptions);
  m.addAll(docs);
  return m;
};

it('groups sections by chapter in score order', () => {
  const res = searchManual('water', small());
  expect(res.map((g) => g.slug)).toEqual(['Water', 'Fire']);
  expect(res[0].sections.map((s) => s.block)).toEqual([0, 5]);
  expect(res[0].sections[0].excerpt).toContain('water');
});

it('falls back to OR when AND finds nothing', () => {
  expect(searchManual('filters fire', small()).map((g) => g.slug).sort()).toEqual(['Fire', 'Water']);
});

it('returns nothing for blank or punctuation-only queries', () => {
  expect(searchManual('   ', small())).toEqual([]);
  expect(searchManual('(', small())).toEqual([]);
  expect(() => searchManual('c++', small())).not.toThrow();
});

it('ranks the Water chapter first for "water purification" in the real manual', () => {
  expect(searchManual('water purification')[0].slug).toBe('Water');
});
```

Run: `npx jest src/search/__tests__/search.test.ts` → FAIL.

- [ ] **Step 2: Implement `src/search/search.ts`**

```ts
import MiniSearch from 'minisearch';
import type { SearchDoc } from '@/types/content';
import { excerpt, queryTerms } from './highlight';
import { indexOptions, queryOptions } from './options';

export type SectionHit = { slug: string; block: number; heading: string; excerpt: string };
export type ChapterHits = { slug: string; sections: SectionHit[] };

let cached: MiniSearch<SearchDoc> | undefined;

export function loadIndex(): MiniSearch<SearchDoc> {
  cached ??= MiniSearch.loadJSON<SearchDoc>(JSON.stringify(require('@/content/search-index.json')), indexOptions);
  return cached;
}

export function searchManual(q: string, index?: MiniSearch<SearchDoc>): ChapterHits[] {
  const terms = queryTerms(q);
  if (!terms.length) return [];
  const idx = index ?? loadIndex();
  let results = idx.search(q, { ...queryOptions, combineWith: 'AND' });
  if (!results.length) results = idx.search(q, { ...queryOptions, combineWith: 'OR' });
  const groups = new Map<string, ChapterHits>();
  for (const r of results) {
    const slug = r.slug as string;
    let g = groups.get(slug);
    if (!g) {
      g = { slug, sections: [] };
      groups.set(slug, g);
    }
    g.sections.push({ slug, block: r.block as number, heading: r.heading as string, excerpt: excerpt(r.body as string, terms) });
  }
  return [...groups.values()];
}
```

- [ ] **Step 3: Run the tests**

Run: `npx jest src/search` → PASS. If the real-manual ranking test fails, print the top 5 results (`console.log(searchManual('water purification').slice(0,5))`). Then raise `boost.heading` in `queryOptions`, at most to 3. If Water still doesn't rank first, stop and report the ranking to the user. Don't weaken the test.

- [ ] **Step 4: Commit**

```bash
git add app && git commit -m "feat(search): MiniSearch query with AND→OR fallback grouped by chapter"
```

---

### Task 7: Persisted stores

**Files:**
- Create:
  - `app/src/store/kv.ts`, `app/src/store/kv.web.ts`, `app/src/store/persistConfig.ts`
  - `app/src/store/settings.ts`, `app/src/store/reading.ts`, `app/src/store/bookmarks.ts`, `app/src/store/checklists.ts`, `app/src/store/emergency.ts`, `app/src/store/hydration.ts`
  - `app/src/lib/id.ts`
- Test: `app/src/store/__tests__/stores.test.ts`

**Interfaces:**
- Produces:
  - `useSettings`: `{ theme: ThemeMode; fontStep: number; keepAwake: boolean; ttsRate: number; language?: string; legacyImported: boolean; set(patch) }`, `ThemeMode`, `fontSize(step): number`
  - `useReading`: `{ last: LastPosition | null; recents: string[]; setLast(slug, blockIndex); visit(slug) }`, `LastPosition = { slug: string; blockIndex: number }`
  - `useBookmarks`: `{ items: Bookmark[]; toggle(slug, blockIndex, label?); remove(id) }`, `Bookmark`, `bookmarkId(slug, blockIndex)`
  - `useChecklists`: `{ lists: Checklist[]; create(title, items: string[], templateId?): string; rename(id, title); remove(id); addItem(id, text); editItem(id, itemId, text); removeItem(id, itemId); toggle(id, itemId); reset(id) }`, `Checklist`, `ChecklistItem`
  - `useEmergency`: `{ card: EmergencyCard; update(patch); clear() }`, `EmergencyCard`, `Contact`, `emptyCard`, `hasCard(card)`
  - `useHydrated(): boolean`
  - `newId(): string`

- [ ] **Step 1: Write the failing tests**

`src/store/__tests__/stores.test.ts`:

```ts
import { useSettings, fontSize } from '@/store/settings';
import { useReading } from '@/store/reading';
import { useBookmarks } from '@/store/bookmarks';
import { useChecklists } from '@/store/checklists';
import { emptyCard, hasCard, useEmergency } from '@/store/emergency';

const kv = jest.requireMock('expo-sqlite/kv-store').default as { __map: Map<string, string> };
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  kv.__map.clear();
  for (const s of [useSettings, useReading, useBookmarks, useChecklists, useEmergency]) s.setState(s.getInitialState(), true);
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
```

Run: `npx jest src/store` → FAIL.

- [ ] **Step 2: Implement the storage layer**

`src/store/kv.ts`:

```ts
import store from 'expo-sqlite/kv-store';

export const kv: {
  getItem(name: string): Promise<string | null> | string | null;
  setItem(name: string, value: string): Promise<void> | void;
  removeItem(name: string): Promise<void> | void;
} = store;
```

`src/store/kv.web.ts`:

```ts
// expo-sqlite on web needs COOP/COEP headers that static hosts can't set, so web uses localStorage.
export const kv = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => localStorage.setItem(name, value),
  removeItem: (name: string) => localStorage.removeItem(name),
};
```

`src/store/persistConfig.ts`:

```ts
import type { PersistOptions, PersistStorage } from 'zustand/middleware';
import { kv } from './kv';

function safeStorage<T>(): PersistStorage<T> {
  return {
    getItem: async (name) => {
      try {
        const raw = await kv.getItem(name);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.warn(`[${name}] stored data unreadable, using defaults`, e);
        return null;
      }
    },
    setItem: async (name, value) => {
      try {
        await kv.setItem(name, JSON.stringify(value));
      } catch (e) {
        console.warn(`[${name}] could not save`, e);
      }
    },
    removeItem: async (name) => {
      try {
        await kv.removeItem(name);
      } catch {
        // nothing to clean up
      }
    },
  };
}

export function persistConfig<T>(name: string): PersistOptions<T> {
  return { name, version: 1, storage: safeStorage<T>() };
}
```

`src/lib/id.ts`:

```ts
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
```

- [ ] **Step 3: Implement the stores**

`src/store/settings.ts`:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistConfig } from './persistConfig';

export type ThemeMode = 'system' | 'day' | 'night' | 'amoled';
export type SettingsValues = { theme: ThemeMode; fontStep: number; keepAwake: boolean; ttsRate: number; language?: string; legacyImported: boolean };
type SettingsState = SettingsValues & { set: (patch: Partial<SettingsValues>) => void };

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({ theme: 'system', fontStep: 2, keepAwake: true, ttsRate: 1, legacyImported: false, set: (patch) => set(patch) }),
    persistConfig<SettingsState>('settings'),
  ),
);

export const fontSize = (step: number) => 8 + 4 * Math.min(4, Math.max(0, Math.round(step)));
```

`src/store/reading.ts`:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistConfig } from './persistConfig';

export type LastPosition = { slug: string; blockIndex: number };
type ReadingState = { last: LastPosition | null; recents: string[]; setLast: (slug: string, blockIndex: number) => void; visit: (slug: string) => void };

export const useReading = create<ReadingState>()(
  persist(
    (set) => ({
      last: null,
      recents: [],
      setLast: (slug, blockIndex) => set({ last: { slug, blockIndex } }),
      visit: (slug) => set((s) => ({ recents: [slug, ...s.recents.filter((r) => r !== slug)].slice(0, 10) })),
    }),
    persistConfig<ReadingState>('reading'),
  ),
);
```

`src/store/bookmarks.ts`:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistConfig } from './persistConfig';

export type Bookmark = { id: string; slug: string; blockIndex: number; label?: string; createdAt: number };
type BookmarksState = { items: Bookmark[]; toggle: (slug: string, blockIndex: number, label?: string) => void; remove: (id: string) => void };

export const bookmarkId = (slug: string, blockIndex: number) => `${slug}#${blockIndex}`;

export const useBookmarks = create<BookmarksState>()(
  persist(
    (set) => ({
      items: [],
      toggle: (slug, blockIndex, label) =>
        set((s) => {
          const id = bookmarkId(slug, blockIndex);
          return s.items.some((b) => b.id === id)
            ? { items: s.items.filter((b) => b.id !== id) }
            : { items: [...s.items, { id, slug, blockIndex, label, createdAt: Date.now() }] };
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((b) => b.id !== id) })),
    }),
    persistConfig<BookmarksState>('bookmarks'),
  ),
);
```

`src/store/checklists.ts`:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newId } from '@/lib/id';
import { persistConfig } from './persistConfig';

export type ChecklistItem = { id: string; text: string; done: boolean };
export type Checklist = { id: string; title: string; templateId?: string; items: ChecklistItem[] };
type ChecklistsState = {
  lists: Checklist[];
  create: (title: string, items: string[], templateId?: string) => string;
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
  addItem: (id: string, text: string) => void;
  editItem: (id: string, itemId: string, text: string) => void;
  removeItem: (id: string, itemId: string) => void;
  toggle: (id: string, itemId: string) => void;
  reset: (id: string) => void;
};

const mapList = (lists: Checklist[], id: string, fn: (l: Checklist) => Checklist) => lists.map((l) => (l.id === id ? fn(l) : l));
const mapItems = (l: Checklist, fn: (i: ChecklistItem) => ChecklistItem) => ({ ...l, items: l.items.map(fn) });

export const useChecklists = create<ChecklistsState>()(
  persist(
    (set) => ({
      lists: [],
      create: (title, items, templateId) => {
        const id = newId();
        set((s) => ({ lists: [...s.lists, { id, title, templateId, items: items.map((text) => ({ id: newId(), text, done: false })) }] }));
        return id;
      },
      rename: (id, title) => set((s) => ({ lists: mapList(s.lists, id, (l) => ({ ...l, title })) })),
      remove: (id) => set((s) => ({ lists: s.lists.filter((l) => l.id !== id) })),
      addItem: (id, text) => set((s) => ({ lists: mapList(s.lists, id, (l) => ({ ...l, items: [...l.items, { id: newId(), text, done: false }] })) })),
      editItem: (id, itemId, text) => set((s) => ({ lists: mapList(s.lists, id, (l) => mapItems(l, (i) => (i.id === itemId ? { ...i, text } : i))) })),
      removeItem: (id, itemId) => set((s) => ({ lists: mapList(s.lists, id, (l) => ({ ...l, items: l.items.filter((i) => i.id !== itemId) })) })),
      toggle: (id, itemId) => set((s) => ({ lists: mapList(s.lists, id, (l) => mapItems(l, (i) => (i.id === itemId ? { ...i, done: !i.done } : i))) })),
      reset: (id) => set((s) => ({ lists: mapList(s.lists, id, (l) => mapItems(l, (i) => ({ ...i, done: false }))) })),
    }),
    persistConfig<ChecklistsState>('checklists'),
  ),
);
```

`src/store/emergency.ts`:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistConfig } from './persistConfig';

export type Contact = { name: string; phone: string };
export type EmergencyCard = { name: string; bloodType: string; allergies: string; medications: string; conditions: string; contacts: Contact[]; notes: string };
type EmergencyState = { card: EmergencyCard; update: (patch: Partial<EmergencyCard>) => void; clear: () => void };

export const emptyCard: EmergencyCard = { name: '', bloodType: '', allergies: '', medications: '', conditions: '', contacts: [], notes: '' };

export const hasCard = (c: EmergencyCard) =>
  [c.name, c.bloodType, c.allergies, c.medications, c.conditions, c.notes].some((v) => v.trim() !== '') ||
  c.contacts.some((x) => x.name.trim() !== '' || x.phone.trim() !== '');

export const useEmergency = create<EmergencyState>()(
  persist(
    (set) => ({
      card: emptyCard,
      update: (patch) => set((s) => ({ card: { ...s.card, ...patch } })),
      clear: () => set({ card: emptyCard }),
    }),
    persistConfig<EmergencyState>('emergency'),
  ),
);
```

`src/store/hydration.ts`:

```ts
import { useEffect, useState } from 'react';
import { useBookmarks } from './bookmarks';
import { useChecklists } from './checklists';
import { useEmergency } from './emergency';
import { useReading } from './reading';
import { useSettings } from './settings';

const stores = [useSettings, useReading, useBookmarks, useChecklists, useEmergency];
const allHydrated = () => stores.every((s) => s.persist.hasHydrated());

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(allHydrated);
  useEffect(() => {
    if (hydrated) return;
    const check = () => {
      if (allHydrated()) setHydrated(true);
    };
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, [hydrated]);
  return hydrated;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/store && npx tsc --noEmit` → PASS and exit 0.

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat(store): persisted settings, reading, bookmarks, checklists and emergency card"
```

---

### Task 8: Theme

**Files:**
- Create: `app/src/theme.ts`
- Test: `app/src/__tests__/theme.test.ts`

**Interfaces:**
- Consumes: `useSettings`, `ThemeMode` (Task 7).
- Produces: `type Colors`, `palettes: Record<'day' | 'night' | 'amoled', Colors>`, `resolveTheme(mode, scheme)`, `useColors(): Colors`.

- [ ] **Step 1: Write the failing test**

```ts
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
```

Run → FAIL.

- [ ] **Step 2: Implement `src/theme.ts`**

```ts
import { useColorScheme } from 'react-native';
import { useSettings, type ThemeMode } from '@/store/settings';

export type Colors = {
  dark: boolean;
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  border: string;
  highlight: string;
  highlightText: string;
  quoteBar: string;
  danger: string;
};

const night: Colors = {
  dark: true,
  background: '#121412',
  surface: '#1d211c',
  text: '#e6e8e3',
  muted: '#a3aa9f',
  primary: '#455440',
  onPrimary: '#ffffff',
  accent: '#9fb86a',
  border: '#2e352c',
  highlight: '#7a6a20',
  highlightText: '#ffffff',
  quoteBar: '#61733b',
  danger: '#ff8a80',
};

export const palettes: Record<'day' | 'night' | 'amoled', Colors> = {
  day: {
    dark: false,
    background: '#ffffff',
    surface: '#f1f3ef',
    text: '#1c222e',
    muted: '#5b6470',
    primary: '#455440',
    onPrimary: '#ffffff',
    accent: '#3d5a1e',
    border: '#d9ddd5',
    highlight: '#ffe08a',
    highlightText: '#1c222e',
    quoteBar: '#61733b',
    danger: '#b3261e',
  },
  night,
  amoled: { ...night, background: '#000000', surface: '#0b0b0b', border: '#1c1c1c' },
};

export function resolveTheme(mode: ThemeMode, scheme: 'light' | 'dark' | null | undefined): keyof typeof palettes {
  if (mode === 'system') return scheme === 'dark' ? 'night' : 'day';
  return mode;
}

export function useColors(): Colors {
  const mode = useSettings((s) => s.theme);
  const scheme = useColorScheme();
  return palettes[resolveTheme(mode, scheme)];
}
```

If `useColorScheme()` returns a type that includes `'unspecified'` in this React Native version, widen the `scheme` parameter type to `string | null | undefined`.

- [ ] **Step 3: Run the tests and commit**

Run: `npx jest src/__tests__/theme.test.ts` → PASS.

```bash
git add app && git commit -m "feat(theme): day, night and AMOLED palettes"
```

---

### Task 9: Block renderer

**Files:**
- Create: `app/src/render/RenderContext.tsx`, `app/src/render/BlockView.tsx`, `app/src/test-utils/fixtures.ts`
- Test: `app/src/render/__tests__/BlockView.test.tsx`

**Interfaces:**
- Consumes: `Block`, `Inline`, `ImageAsset` (Task 2); `images` from `@/content/images` (Task 4); `splitHighlights` (Task 5); `Colors`, `palettes` (Task 8).
- Produces:
  - `type RenderCtx = { fontSize: number; colors: Colors; terms: string[]; onLink(href: string): void; onImage(src: string): void }`
  - `RenderProvider`, `useRenderCtx()`, `BlockView({ block })`
  - Test fixtures: `alpha`, `beta`, `chaptersModule`, `imagesModule`
  - Highlighted runs carry `testID="hl"`

- [ ] **Step 1: Write the test fixtures**

`src/test-utils/fixtures.ts`:

```ts
import type { Chapter } from '@/types/content';

const p = (value: string) => ({ type: 'paragraph' as const, children: [{ type: 'text' as const, value }] });

export const alpha: Chapter = {
  slug: 'Alpha',
  anchors: { 'alpha-intro': 0, purify: 2, fig1: 4 },
  blocks: [
    { type: 'heading', depth: 1, anchor: 'alpha-intro', children: [{ type: 'text', value: 'Alpha intro' }] },
    p('Clean water is vital. Boil water first.'),
    { type: 'heading', depth: 2, anchor: 'purify', children: [{ type: 'text', value: 'Purify' }] },
    { type: 'paragraph', children: [{ type: 'link', href: '/chapter/Beta', children: [{ type: 'text', value: 'See Beta' }] }] },
    { type: 'image', src: 'a.png', alt: 'Figure 1' },
    p('More water tips.'),
  ],
};

export const beta: Chapter = { slug: 'Beta', anchors: {}, blocks: [{ type: 'heading', depth: 1, children: [{ type: 'text', value: 'Beta' }] }, p('Fire basics.')] };

export const chaptersModule = { chapterLoaders: { Alpha: () => alpha, Beta: () => beta } };
export const imagesModule = { images: { 'a.png': { source: 1, width: 200, height: 100 } } };
```

- [ ] **Step 2: Write the failing renderer tests**

`src/render/__tests__/BlockView.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BlockView } from '@/render/BlockView';
import { RenderProvider, type RenderCtx } from '@/render/RenderContext';
import { palettes } from '@/theme';
import type { Block } from '@/types/content';

jest.mock('@/content/images', () => require('@/test-utils/fixtures').imagesModule);

const ctx = (over: Partial<RenderCtx> = {}): RenderCtx => ({ fontSize: 16, colors: palettes.day, terms: [], onLink: jest.fn(), onImage: jest.fn(), ...over });
const show = (block: Block, value = ctx()) => {
  render(
    <RenderProvider value={value}>
      <BlockView block={block} />
    </RenderProvider>,
  );
  return value;
};
const text = (value: string) => ({ type: 'text' as const, value });

it('renders headings as headers', () => {
  show({ type: 'heading', depth: 2, children: [text('Water')] });
  expect(screen.getByRole('header')).toHaveTextContent('Water');
});

it('renders inline formatting', () => {
  show({ type: 'paragraph', children: [text('Some '), { type: 'strong', children: [text('bold')] }, text(' and '), { type: 'emphasis', children: [text('em')] }] });
  expect(screen.getByText('bold')).toHaveStyle({ fontWeight: 'bold' });
  expect(screen.getByText('em')).toHaveStyle({ fontStyle: 'italic' });
});

it('calls onLink with the href', () => {
  const c = show({ type: 'paragraph', children: [{ type: 'link', href: '/chapter/Beta', children: [text('Beta')] }] });
  fireEvent.press(screen.getByText('Beta'));
  expect(c.onLink).toHaveBeenCalledWith('/chapter/Beta');
});

it('numbers ordered lists from start', () => {
  show({ type: 'list', ordered: true, start: 3, items: [[{ type: 'paragraph', children: [text('a')] }], [{ type: 'paragraph', children: [text('b')] }]] });
  expect(screen.getByText('3.')).toBeVisible();
  expect(screen.getByText('4.')).toBeVisible();
});

it('renders blockquotes, tables and code', () => {
  show({ type: 'blockquote', children: [{ type: 'paragraph', children: [text('quoted')] }] });
  expect(screen.getByText('quoted')).toBeVisible();
  show({ type: 'table', header: true, rows: [[[{ type: 'paragraph', children: [text('h')] }]], [[{ type: 'paragraph', children: [text('cell')] }]]] });
  expect(screen.getByText('cell')).toBeVisible();
  show({ type: 'code', value: 'x = 1' });
  expect(screen.getByText('x = 1')).toBeVisible();
});

it('opens known images and skips unknown ones', () => {
  const c = show({ type: 'image', src: 'a.png', alt: 'Figure 1' });
  fireEvent.press(screen.getByLabelText('Figure 1'));
  expect(c.onImage).toHaveBeenCalledWith('a.png');
  show({ type: 'image', src: 'missing.png', alt: 'Gone' });
  expect(screen.queryByLabelText('Gone')).toBeNull();
});

it('highlights search terms', () => {
  show({ type: 'paragraph', children: [text('Boil Water now')] }, ctx({ terms: ['water'] }));
  expect(screen.getAllByTestId('hl').map((n) => n.props.children)).toEqual(['Water']);
});
```

Run: `npx jest src/render` → FAIL.

- [ ] **Step 3: Implement `src/render/RenderContext.tsx`**

```tsx
import { createContext, useContext, type PropsWithChildren } from 'react';
import type { Colors } from '@/theme';

export type RenderCtx = { fontSize: number; colors: Colors; terms: string[]; onLink: (href: string) => void; onImage: (src: string) => void };

const Ctx = createContext<RenderCtx | null>(null);

export function RenderProvider({ value, children }: PropsWithChildren<{ value: RenderCtx }>) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRenderCtx(): RenderCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRenderCtx outside RenderProvider');
  return c;
}
```

- [ ] **Step 4: Implement `src/render/BlockView.tsx`**

```tsx
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { images } from '@/content/images';
import { splitHighlights } from '@/search/highlight';
import type { Block, Inline } from '@/types/content';
import { useRenderCtx } from './RenderContext';

const HEADING_SCALE = { 1: 1.6, 2: 1.4, 3: 1.25, 4: 1.1, 5: 1, 6: 1 } as const;
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function BlockView({ block }: { block: Block }) {
  const c = useRenderCtx();
  const base = { fontSize: c.fontSize, lineHeight: c.fontSize * 1.5, color: c.colors.text };
  switch (block.type) {
    case 'heading': {
      const size = c.fontSize * HEADING_SCALE[block.depth];
      return (
        <Text accessibilityRole="header" style={[base, styles.heading, { fontSize: size, lineHeight: size * 1.3 }]}>
          <Inlines nodes={block.children} />
        </Text>
      );
    }
    case 'paragraph':
      return (
        <Text style={[base, styles.paragraph]}>
          <Inlines nodes={block.children} />
        </Text>
      );
    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={[base, styles.bullet]}>{block.ordered ? `${block.start + i}.` : '•'}</Text>
              <View style={styles.flex}>
                {item.map((b, j) => (
                  <BlockView key={j} block={b} />
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    case 'blockquote':
      return (
        <View style={[styles.quote, { borderLeftColor: c.colors.quoteBar }]}>
          {block.children.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </View>
      );
    case 'table':
      return (
        <ScrollView horizontal style={styles.tableScroll}>
          <View style={[styles.table, { borderColor: c.colors.border }]}>
            {block.rows.map((row, r) => (
              <View key={r} style={[styles.tr, r === 0 && block.header && { backgroundColor: c.colors.surface }]}>
                {row.map((cell, k) => (
                  <View key={k} style={[styles.td, { borderColor: c.colors.border }]}>
                    {cell.map((b, j) => (
                      <BlockView key={j} block={b} />
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    case 'image':
      return <ImageBlock src={block.src} alt={block.alt} />;
    case 'code':
      return <Text style={[base, styles.code, { backgroundColor: c.colors.surface, fontFamily: MONO }]}>{block.value}</Text>;
    case 'thematicBreak':
      return <View style={[styles.hr, { backgroundColor: c.colors.border }]} />;
  }
}

function ImageBlock({ src, alt }: { src: string; alt: string }) {
  const c = useRenderCtx();
  const asset = images[src];
  if (!asset) return null;
  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={alt || src} onPress={() => c.onImage(src)} style={styles.figure}>
      {/* Figures are black line art; give them a light backing in dark themes. */}
      <Image source={asset.source} resizeMode="contain" style={[styles.image, { aspectRatio: asset.width / asset.height, maxWidth: asset.width }, c.colors.dark && styles.imageOnDark]} />
      {alt ? <Text style={[styles.caption, { color: c.colors.muted, fontSize: c.fontSize * 0.85 }]}>{alt}</Text> : null}
    </Pressable>
  );
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => (
        <InlineView key={i} node={n} />
      ))}
    </>
  );
}

function InlineView({ node }: { node: Inline }) {
  const c = useRenderCtx();
  switch (node.type) {
    case 'text':
      return <Highlighted text={node.value} />;
    case 'strong':
      return (
        <Text style={styles.bold}>
          <Inlines nodes={node.children} />
        </Text>
      );
    case 'emphasis':
      return (
        <Text style={styles.italic}>
          <Inlines nodes={node.children} />
        </Text>
      );
    case 'delete':
      return (
        <Text style={styles.strike}>
          <Inlines nodes={node.children} />
        </Text>
      );
    case 'inlineCode':
      return <Text style={{ fontFamily: MONO }}>{node.value}</Text>;
    case 'break':
      return <Text>{'\n'}</Text>;
    case 'link':
      return (
        <Text accessibilityRole="link" style={[styles.link, { color: c.colors.accent }]} onPress={() => c.onLink(node.href)}>
          <Inlines nodes={node.children} />
        </Text>
      );
    case 'image':
      return (
        <Text accessibilityRole="link" style={[styles.link, { color: c.colors.accent }]} onPress={() => c.onImage(node.src)}>
          {`[${node.alt || node.src}]`}
        </Text>
      );
  }
}

function Highlighted({ text }: { text: string }) {
  const c = useRenderCtx();
  if (!c.terms.length) return <>{text}</>;
  return (
    <>
      {splitHighlights(text, c.terms).map((r, i) =>
        r.match ? (
          <Text key={i} testID="hl" style={{ backgroundColor: c.colors.highlight, color: c.colors.highlightText }}>
            {r.text}
          </Text>
        ) : (
          r.text
        ),
      )}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  paragraph: { marginBottom: 10 },
  list: { marginBottom: 10 },
  listItem: { flexDirection: 'row' },
  bullet: { width: 28 },
  flex: { flex: 1 },
  quote: { borderLeftWidth: 4, paddingLeft: 12, marginBottom: 10 },
  tableScroll: { marginBottom: 12 },
  table: { borderWidth: StyleSheet.hairlineWidth },
  tr: { flexDirection: 'row' },
  td: { width: 180, padding: 6, borderWidth: StyleSheet.hairlineWidth },
  code: { padding: 8, marginBottom: 10 },
  hr: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  figure: { marginBottom: 12, alignItems: 'center' },
  image: { width: '100%' },
  imageOnDark: { backgroundColor: '#ffffff', borderRadius: 4 },
  caption: { marginTop: 4, textAlign: 'center' },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  link: { textDecorationLine: 'underline' },
});
```

- [ ] **Step 5: Run the tests and commit**

Run: `npx jest src/render && npx tsc --noEmit` → PASS and exit 0.

```bash
git add app && git commit -m "feat(render): native renderer for chapter blocks with search highlighting"
```

---

### Task 10: Reader building blocks

**Files:**
- Create: `app/src/lib/chapters.ts`, `app/src/lib/useTitle.ts`, `app/src/lib/nav.ts`, `app/src/reader/useMatches.ts`, `app/src/reader/useReadAloud.ts`, `app/src/components/IconButton.tsx`, `app/src/reader/FindBar.tsx`
- Test: `app/src/lib/__tests__/chapters.test.ts`, `app/src/reader/__tests__/useMatches.test.ts`, `app/src/reader/__tests__/useReadAloud.test.ts`

**Interfaces:**
- Consumes: `chapterLoaders` (generated); `toc`/`tocBySlug`; `blockText`; `fold`; `LastPosition`; `useColors`.
- Produces:
  - `loadChapter(slug?: string): Chapter | null`
  - `chapterTitle(slug: string, t: (key: string) => string): string`
  - `nearestHeading(chapter: Chapter, index: number): string | undefined`
  - `resolveInitialBlock(chapter: Chapter, params: { block?: string; anchor?: string }, last: LastPosition | null): number`
  - `useTitle(title: string, headerRight?: () => ReactNode): void`
  - `goBack(fallback: Href): void`
  - `findMatches(texts: string[], terms: string[]): number[]`, `useMatches(blocks, terms): number[]`
  - `useReadAloud(blocks: Block[], rate: number): { speaking: number | null; speakFrom(i: number): void; stop(): void }`
  - `IconButton({ icon, label, onPress, color, size?, disabled? })`
  - `FindBar({ query, onChangeQuery, total, current, onPrev, onNext, onClose })`, which renders `testID="find-input"` and `testID="find-status"`

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/chapters.test.ts`:

```ts
import { chapterTitle, loadChapter, nearestHeading, resolveInitialBlock } from '@/lib/chapters';
import { alpha } from '@/test-utils/fixtures';

jest.mock('@/content/chapters', () => require('@/test-utils/fixtures').chaptersModule);

it('loads known chapters only', () => {
  expect(loadChapter('Alpha')?.slug).toBe('Alpha');
  expect(loadChapter('Nope')).toBeNull();
  expect(loadChapter(undefined)).toBeNull();
});

it('titles from the toc, falling back to the slug', () => {
  const t = (k: string) => `T:${k}`;
  expect(chapterTitle('Water', t)).toBe('T:water');
  expect(chapterTitle('Alpha', t)).toBe('Alpha');
});

it('finds the nearest heading at or above a block', () => {
  expect(nearestHeading(alpha, 3)).toBe('Purify');
  expect(nearestHeading(alpha, 1)).toBe('Alpha intro');
  expect(nearestHeading(alpha, 99)).toBe('Purify');
});

describe('resolveInitialBlock', () => {
  it('prefers a valid block param', () => expect(resolveInitialBlock(alpha, { block: '4' }, null)).toBe(4));
  it('ignores malformed or out-of-range block params', () => {
    expect(resolveInitialBlock(alpha, { block: 'abc' }, null)).toBe(0);
    expect(resolveInitialBlock(alpha, { block: '-3' }, null)).toBe(0);
    expect(resolveInitialBlock(alpha, { block: '99' }, null)).toBe(0);
  });
  it('uses named anchors, ignoring unknown ones', () => {
    expect(resolveInitialBlock(alpha, { anchor: 'purify' }, null)).toBe(2);
    expect(resolveInitialBlock(alpha, { anchor: 'nope' }, null)).toBe(0);
  });
  it('restores the last position only for the same chapter and clamps stale indexes', () => {
    expect(resolveInitialBlock(alpha, {}, { slug: 'Alpha', blockIndex: 3 })).toBe(3);
    expect(resolveInitialBlock(alpha, {}, { slug: 'Alpha', blockIndex: 500 })).toBe(5);
    expect(resolveInitialBlock(alpha, {}, { slug: 'Beta', blockIndex: 3 })).toBe(0);
  });
});
```

`src/reader/__tests__/useMatches.test.ts`:

```ts
import { findMatches } from '@/reader/useMatches';

it('returns indexes of texts containing any folded term', () => {
  expect(findMatches(['boil water', 'fire', 'café water'], ['WATER'])).toEqual([0, 2]);
  expect(findMatches(['café'], ['cafe'])).toEqual([0]);
  expect(findMatches(['x'], [])).toEqual([]);
});
```

`src/reader/__tests__/useReadAloud.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { useReadAloud } from '@/reader/useReadAloud';
import type { Block } from '@/types/content';

const p = (value: string): Block => ({ type: 'paragraph', children: [{ type: 'text', value }] });
const blocks: Block[] = [p('one'), { type: 'thematicBreak' }, p('two')];
const speak = Speech.speak as jest.Mock;
const finishCurrent = () => act(() => speak.mock.calls[speak.mock.calls.length - 1][1].onDone());

beforeEach(() => jest.clearAllMocks());

it('speaks block by block, skipping empty blocks', () => {
  const { result } = renderHook(() => useReadAloud(blocks, 1.25));
  act(() => result.current.speakFrom(0));
  expect(speak).toHaveBeenLastCalledWith('one', expect.objectContaining({ rate: 1.25, language: 'en' }));
  expect(result.current.speaking).toBe(0);
  finishCurrent();
  expect(speak).toHaveBeenLastCalledWith('two', expect.anything());
  expect(result.current.speaking).toBe(2);
  finishCurrent();
  expect(result.current.speaking).toBeNull();
});

it('stop cancels and ignores late callbacks', () => {
  const { result } = renderHook(() => useReadAloud(blocks, 1));
  act(() => result.current.speakFrom(0));
  act(() => result.current.stop());
  expect(Speech.stop).toHaveBeenCalled();
  finishCurrent();
  expect(speak).toHaveBeenCalledTimes(1);
  expect(result.current.speaking).toBeNull();
});
```

Run: `npx jest src/lib src/reader` → FAIL.

- [ ] **Step 2: Implement `src/lib/chapters.ts`**

```ts
import { chapterLoaders } from '@/content/chapters';
import { blockText } from '@/lib/blockText';
import type { LastPosition } from '@/store/reading';
import { tocBySlug } from '@/toc';
import type { Chapter } from '@/types/content';

export function loadChapter(slug: string | undefined): Chapter | null {
  if (!slug) return null;
  const load = chapterLoaders[slug];
  return load ? load() : null;
}

export function chapterTitle(slug: string, t: (key: string) => string): string {
  const entry = tocBySlug.get(slug);
  return entry ? t(entry.titleKey) : slug;
}

export function nearestHeading(chapter: Chapter, index: number): string | undefined {
  for (let i = Math.min(index, chapter.blocks.length - 1); i >= 0; i--) {
    const b = chapter.blocks[i];
    if (b.type === 'heading') return blockText(b);
  }
  return undefined;
}

export function resolveInitialBlock(chapter: Chapter, params: { block?: string; anchor?: string }, last: LastPosition | null): number {
  const max = chapter.blocks.length - 1;
  if (params.block != null && /^\d+$/.test(params.block)) {
    const n = Number(params.block);
    if (n <= max) return n;
  }
  if (params.anchor && chapter.anchors[params.anchor] !== undefined) return chapter.anchors[params.anchor];
  if (last?.slug === chapter.slug) return Math.max(0, Math.min(last.blockIndex, max));
  return 0;
}
```

- [ ] **Step 3: Implement `src/lib/useTitle.ts` and `src/lib/nav.ts`**

```ts
// src/lib/useTitle.ts
import { useLayoutEffect, type ReactNode } from 'react';
import { useNavigation } from 'expo-router';

export function useTitle(title: string, headerRight?: () => ReactNode) {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ title, headerRight });
  }, [navigation, title, headerRight]);
}
```

```ts
// src/lib/nav.ts
import { router, type Href } from 'expo-router';

export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
```

- [ ] **Step 4: Implement `src/reader/useMatches.ts`**

```ts
import { useMemo } from 'react';
import { blockText } from '@/lib/blockText';
import { fold } from '@/search/options';
import type { Block } from '@/types/content';

export function findMatches(texts: string[], terms: string[]): number[] {
  const folded = terms.map(fold).filter(Boolean);
  if (!folded.length) return [];
  return texts.flatMap((text, i) => {
    const f = fold(text);
    return folded.some((t) => f.includes(t)) ? [i] : [];
  });
}

export function useMatches(blocks: Block[], terms: string[]): number[] {
  const texts = useMemo(() => blocks.map(blockText), [blocks]);
  return useMemo(() => findMatches(texts, terms), [texts, terms]);
}
```

- [ ] **Step 5: Implement `src/reader/useReadAloud.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { blockText } from '@/lib/blockText';
import type { Block } from '@/types/content';

// Speech.pause is iOS-only, so "pause" is stop + resume from the first visible block.
export function useReadAloud(blocks: Block[], rate: number) {
  const [speaking, setSpeaking] = useState<number | null>(null);
  const run = useRef(0);

  const speakFrom = useCallback(
    (start: number) => {
      const token = ++run.current;
      const next = (k: number) => {
        if (token !== run.current) return;
        while (k < blocks.length && !blockText(blocks[k]).trim()) k++;
        if (k >= blocks.length) {
          setSpeaking(null);
          return;
        }
        setSpeaking(k);
        Speech.speak(blockText(blocks[k]), {
          rate,
          language: 'en',
          onDone: () => next(k + 1),
          onError: () => {
            if (token === run.current) setSpeaking(null);
          },
        });
      };
      Speech.stop();
      next(start);
    },
    [blocks, rate],
  );

  const stop = useCallback(() => {
    run.current++;
    Speech.stop();
    setSpeaking(null);
  }, []);

  useEffect(() => stop, [stop]);

  return { speaking, speakFrom, stop };
}
```

- [ ] **Step 6: Implement `IconButton` and `FindBar`**

`src/components/IconButton.tsx`:

```tsx
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { IconName } from '@/toc';

type Props = { icon: IconName; label: string; onPress: () => void; color: string; size?: number; disabled?: boolean };

export function IconButton({ icon, label, onPress, color, size = 24, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, (pressed || disabled) && styles.dim]}
    >
      <MaterialCommunityIcons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({ btn: { padding: 8 }, dim: { opacity: 0.5 } });
```

`src/reader/FindBar.tsx`:

```tsx
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/IconButton';
import { useColors } from '@/theme';

type Props = { query: string; onChangeQuery: (q: string) => void; total: number; current: number; onPrev: () => void; onNext: () => void; onClose: () => void };

export function FindBar({ query, onChangeQuery, total, current, onPrev, onNext, onClose }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const status = query.trim() ? (total ? t('match_of', { current: current + 1, total }) : t('no_matches')) : '';
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TextInput
        testID="find-input"
        value={query}
        onChangeText={onChangeQuery}
        placeholder={t('find_in_chapter')}
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.text }]}
        autoFocus={!query}
        returnKeyType="search"
        onSubmitEditing={onNext}
      />
      <Text testID="find-status" style={{ color: colors.muted }}>
        {status}
      </Text>
      <IconButton icon="chevron-up" label={t('previous')} color={colors.text} onPress={onPrev} disabled={!total} />
      <IconButton icon="chevron-down" label={t('next')} color={colors.text} onPress={onNext} disabled={!total} />
      <IconButton icon="close" label={t('close')} color={colors.text} onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, paddingVertical: 8, fontSize: 16 },
});
```

- [ ] **Step 7: Run the tests and commit**

Run: `npx jest src/lib src/reader && npx tsc --noEmit` → PASS and exit 0.

```bash
git add app && git commit -m "feat(reader): chapter loading, initial position, matches, read-aloud and find bar"
```

---

### Task 11: App shell — layout, drawer, index redirect

**Files:**
- Create: `app/src/app/_layout.tsx`, `app/src/components/DrawerContent.tsx`, `app/src/components/NotFound.tsx`, `app/src/components/Button.tsx`, `app/src/components/Empty.tsx`
- Modify: `app/src/app/index.tsx`
- Delete: `app/src/__tests__/smoke.test.tsx`
- Test: `app/src/__tests__/drawer.test.tsx`, `app/src/__tests__/index.test.tsx`

**Interfaces:**
- Consumes: `useHydrated`, `useSettings`, `useReading`, `useEmergency`/`hasCard`, `useColors`, `toc`/`tocBySlug`, `i18n`/`pickLanguage`, `IconButton`.
- Produces:
  - `DrawerContent({ navigation }: { navigation: { closeDrawer(): void } })`
  - `NotFound({ message? })`, a "not found" screen with a "Back to contents" button that replaces the route with `/`
  - `Button({ label, onPress, variant?, disabled? })`, where `variant` is `'primary' | 'danger' | 'plain'`
  - `Empty({ text })`
  - The index route redirects to `/chapter/<last slug or Introduction>`

- [ ] **Step 1: Write the failing tests**

`src/__tests__/index.test.tsx`:

```tsx
import { Text } from 'react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import Index from '@/app/index';
import { useReading } from '@/store/reading';

const routes = { index: Index, 'chapter/[slug]': () => <Text>chapter</Text> };

beforeEach(() => useReading.setState(useReading.getInitialState(), true));

it('opens the first chapter on first launch', () => {
  renderRouter(routes, { initialUrl: '/' });
  expect(screen).toHavePathname('/chapter/Introduction');
});

it('opens the last-read chapter', () => {
  useReading.setState({ last: { slug: 'Water', blockIndex: 4 } });
  renderRouter(routes, { initialUrl: '/' });
  expect(screen).toHavePathname('/chapter/Water');
});

it('falls back when the last chapter no longer exists', () => {
  useReading.setState({ last: { slug: 'Removed', blockIndex: 4 } });
  renderRouter(routes, { initialUrl: '/' });
  expect(screen).toHavePathname('/chapter/Introduction');
});
```

`src/__tests__/drawer.test.tsx`:

```tsx
import { Text } from 'react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { DrawerContent } from '@/components/DrawerContent';
import { useEmergency } from '@/store/emergency';

const navigation = { closeDrawer: jest.fn() };
const routes = {
  index: () => <DrawerContent navigation={navigation} />,
  'chapter/[slug]': () => <Text>chapter</Text>,
  'tools/emergency-card': () => <Text>card</Text>,
};

beforeEach(() => {
  jest.clearAllMocks();
  useEmergency.setState(useEmergency.getInitialState(), true);
});

it('navigates to a chapter and closes the drawer', () => {
  renderRouter(routes, { initialUrl: '/' });
  fireEvent.press(screen.getByText('Water'));
  expect(screen).toHavePathname('/chapter/Water');
  expect(navigation.closeDrawer).toHaveBeenCalled();
});

it('collapses the appendix until opened', () => {
  renderRouter(routes, { initialUrl: '/' });
  expect(screen.queryByText('FAQ')).toBeNull();
  fireEvent.press(screen.getByText('Appendix'));
  expect(screen.getByText('FAQ')).toBeVisible();
  expect(screen.queryByText('Translator Notes')).toBeNull();
});

it('pins the emergency card only when it has content', () => {
  renderRouter(routes, { initialUrl: '/' });
  expect(screen.getAllByText('Emergency card')).toHaveLength(1);
  useEmergency.getState().update({ bloodType: 'A-' });
  renderRouter(routes, { initialUrl: '/' });
  expect(screen.getAllByText('Emergency card')).toHaveLength(2);
});
```

Delete `src/__tests__/smoke.test.tsx`. Run: `npx jest src/__tests__/index.test.tsx src/__tests__/drawer.test.tsx` → FAIL.

- [ ] **Step 2: Implement the shared components**

`src/components/Button.tsx`:

```tsx
import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '@/theme';

type Props = { label: string; onPress: () => void; variant?: 'primary' | 'danger' | 'plain'; disabled?: boolean };

export function Button({ label, onPress, variant = 'primary', disabled }: Props) {
  const colors = useColors();
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  const fg = variant === 'plain' ? colors.accent : colors.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg }, (pressed || disabled) && styles.dim]}
    >
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginVertical: 6 },
  label: { fontSize: 16, fontWeight: '600' },
  dim: { opacity: 0.5 },
});
```

`src/components/Empty.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme';

export function Empty({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View style={styles.box}>
      <Text style={[styles.text, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ box: { flex: 1, padding: 24, justifyContent: 'center' }, text: { fontSize: 16, textAlign: 'center' } });
```

`src/components/NotFound.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/theme';
import { Button } from './Button';

export function NotFound({ message }: { message?: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={styles.box}>
      <Text style={[styles.text, { color: colors.text }]}>{message ?? t('chapter_not_found')}</Text>
      <Button label={t('back_to_contents')} onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({ box: { flex: 1, padding: 24, justifyContent: 'center' }, text: { fontSize: 18, textAlign: 'center', marginBottom: 16 } });
```

- [ ] **Step 3: Implement `src/components/DrawerContent.tsx`**

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { hasCard, useEmergency } from '@/store/emergency';
import { useColors } from '@/theme';
import { toc, type IconName, type TocEntry } from '@/toc';

type Props = { navigation: { closeDrawer(): void } };

export function DrawerContent({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const card = useEmergency((s) => s.card);
  const [appendixOpen, setAppendixOpen] = useState(false);

  const go = (href: Href) => {
    navigation.closeDrawer();
    router.navigate(href);
  };
  const row = (icon: IconName, label: string, path: string, emphasis = false) => (
    <Row key={path} icon={icon} label={label} active={pathname === path} emphasis={emphasis} onPress={() => go(path as Href)} />
  );
  const chapterRow = (e: TocEntry) => row(e.icon ?? 'book-open-page-variant-outline', t(e.titleKey), `/chapter/${e.slug}`);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('app_name')}</Text>
      {hasCard(card) && row('card-account-details-star', t('emergency_card'), '/tools/emergency-card', true)}
      {row('magnify', t('search'), '/search')}
      <Section label={t('chapters')} />
      {toc.filter((e) => e.listed !== false && !e.appendix).map(chapterRow)}
      <Row icon={appendixOpen ? 'chevron-down' : 'chevron-right'} label={t('appendix')} onPress={() => setAppendixOpen((o) => !o)} />
      {appendixOpen && toc.filter((e) => e.listed !== false && e.appendix).map(chapterRow)}
      <Section label={t('tools_section')} />
      {row('bookmark-multiple-outline', t('bookmarks'), '/bookmarks')}
      {row('history', t('recents'), '/recents')}
      {row('format-list-checks', t('checklists'), '/tools/checklists')}
      {row('alarm-light-outline', t('sos'), '/tools/sos')}
      {row('compass-outline', t('compass'), '/tools/compass')}
      {row('card-account-details-outline', t('emergency_card'), '/tools/emergency-card')}
      {row('cog-outline', t('settings'), '/settings')}
    </ScrollView>
  );
}

function Section({ label }: { label: string }) {
  const colors = useColors();
  return <Text style={[styles.section, { color: colors.muted }]}>{label.toUpperCase()}</Text>;
}

function Row({ icon, label, active, emphasis, onPress }: { icon: IconName; label: string; active?: boolean; emphasis?: boolean; onPress: () => void }) {
  const colors = useColors();
  const fg = emphasis ? colors.danger : active ? colors.accent : colors.text;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress} style={[styles.row, active && { backgroundColor: colors.surface }]}>
      <MaterialCommunityIcons name={icon} size={22} color={fg} />
      <Text style={[styles.label, { color: fg }, emphasis && styles.bold]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 8 },
  section: { fontSize: 12, fontWeight: '600', paddingHorizontal: 16, marginTop: 16, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 16 },
  label: { fontSize: 15 },
  bold: { fontWeight: 'bold' },
});
```

- [ ] **Step 4: Implement the layout and the index route**

`src/app/_layout.tsx`:

```tsx
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import i18n, { pickLanguage } from '@/i18n';
import { DrawerContent } from '@/components/DrawerContent';
import { useHydrated } from '@/store/hydration';
import { useSettings } from '@/store/settings';
import { useColors } from '@/theme';

export default function RootLayout() {
  const hydrated = useHydrated();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const language = useSettings((s) => s.language);

  useEffect(() => {
    void i18n.changeLanguage(pickLanguage(language));
  }, [language]);

  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={styles.fill}>
      <StatusBar style="light" />
      <Drawer
        drawerContent={(props) => <DrawerContent navigation={props.navigation} />}
        screenOptions={{
          drawerType: width >= 900 ? 'permanent' : 'front',
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.onPrimary,
          drawerStyle: { backgroundColor: colors.background, width: 300 },
          sceneStyle: { backgroundColor: colors.background },
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
```

`src/app/index.tsx`:

```tsx
import { Redirect } from 'expo-router';
import { useReading } from '@/store/reading';
import { toc, tocBySlug } from '@/toc';

export default function Index() {
  const last = useReading((s) => s.last);
  const slug = last && tocBySlug.has(last.slug) ? last.slug : toc[0].slug;
  return <Redirect href={`/chapter/${slug}`} />;
}
```

- [ ] **Step 5: Run the tests, typecheck and lint**

Run: `npx jest src/__tests__ && npx tsc --noEmit && npx expo lint` → PASS and exit 0. If `props.navigation` has no `closeDrawer` in the SDK 56 drawer types, check the drawer docs on Context7 and pass the documented close function instead.

- [ ] **Step 6: Commit**

```bash
git add -A app && git commit -m "feat(app): drawer shell with chapter list, tools, emergency pin and last-chapter redirect"
```

---

### Task 12: Chapter reader screen

**Files:**
- Create: `app/src/reader/Reader.tsx`, `app/src/app/chapter/[slug].tsx`
- Test: `app/src/__tests__/reader.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 7–11.
- Produces:
  - Route `/chapter/[slug]?block=&anchor=&q=`
  - `Reader({ chapter, title, initialBlock, initialQuery? })`
  - Header buttons labelled `Find in chapter`, `Read aloud` / `Stop reading`, `Add bookmark` / `Remove bookmark`

- [ ] **Step 1: Write the failing tests**

`src/__tests__/reader.test.tsx`:

```tsx
import { Text } from 'react-native';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Speech from 'expo-speech';
import { activateKeepAwakeAsync } from 'expo-keep-awake';
import ChapterScreen from '@/app/chapter/[slug]';
import { useBookmarks } from '@/store/bookmarks';
import { useReading } from '@/store/reading';

jest.mock('@/content/chapters', () => require('@/test-utils/fixtures').chaptersModule);
jest.mock('@/content/images', () => require('@/test-utils/fixtures').imagesModule);

const routes = {
  _layout: () => <Stack />,
  'chapter/[slug]': ChapterScreen,
  'image/[name]': () => <Text>image</Text>,
};
const open = (url: string) => renderRouter(routes, { initialUrl: url });

beforeEach(() => {
  jest.clearAllMocks();
  useReading.setState(useReading.getInitialState(), true);
  useBookmarks.setState(useBookmarks.getInitialState(), true);
});

it('renders the chapter, records it as recent and keeps the screen awake', () => {
  open('/chapter/Alpha');
  expect(screen.getByText('Alpha intro')).toBeVisible();
  expect(useReading.getState().recents[0]).toBe('Alpha');
  expect(activateKeepAwakeAsync).toHaveBeenCalledWith('reader');
});

it('shows not found for unknown chapters', () => {
  open('/chapter/Nope');
  expect(screen.getByText('Chapter not found')).toBeVisible();
});

it('follows internal links and opens images', () => {
  open('/chapter/Alpha');
  fireEvent.press(screen.getByText('See Beta'));
  expect(screen).toHavePathname('/chapter/Beta');
  open('/chapter/Alpha');
  fireEvent.press(screen.getByLabelText('Figure 1'));
  expect(screen).toHavePathname('/image/a.png');
});

it('highlights a search jump and steps through matching blocks', () => {
  open('/chapter/Alpha?block=2&q=water');
  expect(screen.getAllByTestId('hl').length).toBeGreaterThan(0);
  expect(screen.getByTestId('find-status')).toHaveTextContent('2 of 2');
  fireEvent.press(screen.getByLabelText('Next'));
  expect(screen.getByTestId('find-status')).toHaveTextContent('1 of 2');
});

it('finds in chapter from the header', () => {
  open('/chapter/Alpha');
  fireEvent.press(screen.getByLabelText('Find in chapter'));
  fireEvent.changeText(screen.getByTestId('find-input'), 'zzz');
  expect(screen.getByTestId('find-status')).toHaveTextContent('No matches');
});

it('bookmarks the current block with its heading', () => {
  open('/chapter/Alpha');
  fireEvent.press(screen.getByLabelText('Add bookmark'));
  expect(useBookmarks.getState().items).toMatchObject([{ id: 'Alpha#0', label: 'Alpha intro' }]);
  expect(screen.getByLabelText('Remove bookmark')).toBeVisible();
});

it('reads aloud from the current block', () => {
  open('/chapter/Alpha');
  fireEvent.press(screen.getByLabelText('Read aloud'));
  expect(Speech.speak).toHaveBeenCalledWith('Alpha intro', expect.anything());
  expect(screen.getByLabelText('Stop reading')).toBeVisible();
});
```

Run: `npx jest src/__tests__/reader.test.tsx` → FAIL.

- [ ] **Step 2: Implement `src/reader/Reader.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, StyleSheet, View, type ViewToken } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/IconButton';
import { nearestHeading } from '@/lib/chapters';
import { useTitle } from '@/lib/useTitle';
import { BlockView } from '@/render/BlockView';
import { RenderProvider, type RenderCtx } from '@/render/RenderContext';
import { queryTerms } from '@/search/highlight';
import { bookmarkId, useBookmarks } from '@/store/bookmarks';
import { useReading } from '@/store/reading';
import { fontSize, useSettings } from '@/store/settings';
import { useColors } from '@/theme';
import type { Block, Chapter } from '@/types/content';
import { FindBar } from './FindBar';
import { useMatches } from './useMatches';
import { useReadAloud } from './useReadAloud';

type Props = { chapter: Chapter; title: string; initialBlock: number; initialQuery?: string };

const VIEWABILITY = { itemVisiblePercentThreshold: 10 };

function openLink(href: string) {
  if (href.startsWith('/')) router.push(href as Href);
  else void Linking.openURL(href);
}

function openImage(src: string) {
  router.push({ pathname: '/image/[name]', params: { name: src } });
}

export function Reader({ chapter, title, initialBlock, initialQuery }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const fontStep = useSettings((s) => s.fontStep);
  const keepAwake = useSettings((s) => s.keepAwake);
  const ttsRate = useSettings((s) => s.ttsRate);
  const listRef = useRef<FlatList<Block>>(null);
  const retried = useRef(-1);
  const [firstVisible, setFirstVisible] = useState(initialBlock);
  const [query, setQuery] = useState(initialQuery ?? '');
  const [findOpen, setFindOpen] = useState(!!initialQuery);
  const [cursor, setCursor] = useState(0);
  const terms = useMemo(() => (findOpen ? queryTerms(query) : []), [findOpen, query]);
  const matches = useMatches(chapter.blocks, terms);
  const { speaking, speakFrom, stop } = useReadAloud(chapter.blocks, ttsRate);
  const bookmarked = useBookmarks((s) => s.items.some((b) => b.id === bookmarkId(chapter.slug, firstVisible)));
  const toggleBookmark = useBookmarks((s) => s.toggle);

  const scrollTo = useCallback((index: number, animated = true) => {
    listRef.current?.scrollToIndex({ index, animated, viewPosition: 0 });
  }, []);

  useEffect(() => {
    useReading.getState().visit(chapter.slug);
  }, [chapter.slug]);

  useEffect(() => {
    if (initialBlock > 0) requestAnimationFrame(() => scrollTo(initialBlock, false));
  }, [initialBlock, scrollTo]);

  useEffect(() => {
    const i = matches.findIndex((m) => m >= initialBlock);
    setCursor(i === -1 ? 0 : i);
  }, [matches, initialBlock]);

  useEffect(() => {
    if (speaking != null) scrollTo(speaking);
  }, [speaking, scrollTo]);

  useFocusEffect(
    useCallback(() => {
      if (keepAwake) activateKeepAwakeAsync('reader').catch(() => {});
      return () => {
        stop();
        if (keepAwake) Promise.resolve(deactivateKeepAwake('reader')).catch(() => {});
      };
    }, [keepAwake, stop]),
  );

  // FlatList requires a stable callback; the Reader is keyed by chapter, so the slug is fixed.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const indexes = viewableItems.map((v) => v.index).filter((i): i is number => i != null);
    if (!indexes.length) return;
    const first = Math.min(...indexes);
    setFirstVisible(first);
    useReading.getState().setLast(chapter.slug, first);
  }).current;

  const onScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
    if (retried.current === info.index) return;
    retried.current = info.index;
    setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false }), 100);
  }, []);

  const goMatch = (delta: number) => {
    if (!matches.length) return;
    const next = (cursor + delta + matches.length) % matches.length;
    setCursor(next);
    scrollTo(matches[next]);
  };

  const headerRight = useCallback(
    () => (
      <View style={styles.actions}>
        <IconButton icon="magnify" label={t('find_in_chapter')} color={colors.onPrimary} onPress={() => setFindOpen((o) => !o)} />
        <IconButton
          icon={speaking != null ? 'stop' : 'volume-high'}
          label={speaking != null ? t('stop_reading') : t('read_aloud')}
          color={colors.onPrimary}
          onPress={() => (speaking != null ? stop() : speakFrom(firstVisible))}
        />
        <IconButton
          icon={bookmarked ? 'bookmark' : 'bookmark-outline'}
          label={bookmarked ? t('bookmark_remove') : t('bookmark_add')}
          color={colors.onPrimary}
          onPress={() => toggleBookmark(chapter.slug, firstVisible, nearestHeading(chapter, firstVisible))}
        />
      </View>
    ),
    [t, colors.onPrimary, speaking, stop, speakFrom, firstVisible, bookmarked, toggleBookmark, chapter],
  );
  useTitle(title, headerRight);

  const ctx = useMemo<RenderCtx>(() => ({ fontSize: fontSize(fontStep), colors, terms, onLink: openLink, onImage: openImage }), [fontStep, colors, terms]);

  return (
    <RenderProvider value={ctx}>
      {findOpen && (
        <FindBar
          query={query}
          onChangeQuery={setQuery}
          total={matches.length}
          current={cursor}
          onPrev={() => goMatch(-1)}
          onNext={() => goMatch(1)}
          onClose={() => setFindOpen(false)}
        />
      )}
      <FlatList
        ref={listRef}
        data={chapter.blocks}
        extraData={speaking}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={[styles.block, index === speaking && { backgroundColor: colors.surface }]}>
            <BlockView block={item} />
          </View>
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY}
        onScrollToIndexFailed={onScrollToIndexFailed}
        initialNumToRender={Math.max(10, initialBlock + 2)}
        windowSize={11}
        contentContainerStyle={styles.content}
      />
    </RenderProvider>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row' },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  block: { borderRadius: 4 },
});
```

- [ ] **Step 3: Implement `src/app/chapter/[slug].tsx`**

```tsx
import { useMemo } from 'react';
import { useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { NotFound } from '@/components/NotFound';
import { chapterTitle, loadChapter, resolveInitialBlock } from '@/lib/chapters';
import { Reader } from '@/reader/Reader';
import { useReading } from '@/store/reading';
import { toc } from '@/toc';

export async function generateStaticParams() {
  return toc.map((e) => ({ slug: e.slug }));
}

export function ErrorBoundary(_: ErrorBoundaryProps) {
  return <NotFound />;
}

export default function ChapterScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ slug: string; block?: string; anchor?: string; q?: string }>();
  const chapter = useMemo(() => loadChapter(params.slug), [params.slug]);
  if (!chapter) return <NotFound />;
  const initialBlock = resolveInitialBlock(chapter, params, useReading.getState().last);
  return (
    <Reader
      key={`${chapter.slug}|${params.q ?? ''}`}
      chapter={chapter}
      title={chapterTitle(chapter.slug, t)}
      initialBlock={initialBlock}
      initialQuery={params.q}
    />
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/__tests__/reader.test.tsx` → PASS. If the header buttons don't render under the test `Stack`, check that `useTitle` is called and that `headerRight` is passed. Don't move the actions out of the header just to make the test pass.

- [ ] **Step 5: Run the app on Web and Android by hand**

Run: `npm run web` and open the printed URL. Then:
- Open Fire. Check that the tables and figures render, and that the drawer is permanent when the window is wider than 900 px.
- Search a term with the header find button.
- Bookmark a block. Reload the page and check that the last position is restored.

Run: `npm run android` with an emulator running. Scroll Plants (a long chapter) and check that scrolling stays smooth. Write down anything broken in the task report.

- [ ] **Step 6: Commit**

```bash
git add app && git commit -m "feat(reader): chapter screen with restore, find, bookmarks, read-aloud and keep-awake"
```

---

### Task 13: Search screen

**Files:**
- Create: `app/src/app/search.tsx`
- Test: `app/src/__tests__/search-screen.test.tsx`

**Interfaces:**
- Consumes: `searchManual`, `ChapterHits` (Task 6); `splitHighlights`, `queryTerms` (Task 5); `chapterTitle`; `useTitle`.
- Produces: route `/search`. The input has `testID="search-input"`; results have `testID="search-result-<group>-<index>"`.

- [ ] **Step 1: Write the failing test**

```tsx
import { Text } from 'react-native';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import SearchScreen from '@/app/search';
import { searchManual } from '@/search/search';

jest.mock('@/search/search', () => ({ searchManual: jest.fn() }));
const mocked = searchManual as jest.Mock;

const routes = { _layout: () => <Stack />, search: SearchScreen, 'chapter/[slug]': () => <Text>chapter</Text> };

it('shows grouped results and opens the section with the query', () => {
  mocked.mockReturnValue([{ slug: 'Water', sections: [{ slug: 'Water', block: 3, heading: 'Purification', excerpt: 'Boil water for one minute' }] }]);
  renderRouter(routes, { initialUrl: '/search' });
  fireEvent.changeText(screen.getByTestId('search-input'), 'water');
  expect(screen.getByText('Water')).toBeVisible();
  expect(screen.getByText('Purification')).toBeVisible();
  fireEvent.press(screen.getByTestId('search-result-0-0'));
  expect(screen).toHavePathname('/chapter/Water');
  expect(screen).toHaveSearchParams({ block: '3', q: 'water' });
});

it('says when nothing was found', () => {
  mocked.mockReturnValue([]);
  renderRouter(routes, { initialUrl: '/search' });
  fireEvent.changeText(screen.getByTestId('search-input'), 'zzz');
  expect(screen.getByText('Nothing found for “zzz”')).toBeVisible();
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/app/search.tsx`**

```tsx
import { useDeferredValue, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Empty } from '@/components/Empty';
import { chapterTitle } from '@/lib/chapters';
import { useTitle } from '@/lib/useTitle';
import { queryTerms, splitHighlights } from '@/search/highlight';
import { searchManual } from '@/search/search';
import { useColors } from '@/theme';

export default function SearchScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('search'));
  const [q, setQ] = useState('');
  const query = useDeferredValue(q);
  const terms = useMemo(() => queryTerms(query), [query]);
  const sections = useMemo(
    () => searchManual(query).map((g, gi) => ({ title: chapterTitle(g.slug, t), gi, data: g.sections })),
    [query, t],
  );

  return (
    <View style={styles.fill}>
      <TextInput
        testID="search-input"
        value={q}
        onChangeText={setQ}
        autoFocus
        placeholder={t('search_placeholder')}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      {query.trim() !== '' && sections.length === 0 ? (
        <Empty text={t('search_no_results', { q: query })} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(s) => `${s.slug}#${s.block}`}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => <Text style={[styles.chapter, { color: colors.accent, backgroundColor: colors.background }]}>{section.title}</Text>}
          renderItem={({ item, index, section }) => (
            <Pressable
              testID={`search-result-${section.gi}-${index}`}
              onPress={() => router.push({ pathname: '/chapter/[slug]', params: { slug: item.slug, block: String(item.block), q: query } })}
              style={[styles.item, { borderColor: colors.border }]}
            >
              <Text style={[styles.heading, { color: colors.text }]}>{item.heading}</Text>
              <Text style={{ color: colors.muted }}>
                {splitHighlights(item.excerpt, terms).map((r, i) =>
                  r.match ? (
                    <Text key={i} style={{ backgroundColor: colors.highlight, color: colors.highlightText }}>
                      {r.text}
                    </Text>
                  ) : (
                    r.text
                  ),
                )}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  input: { margin: 12, padding: 12, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, fontSize: 16 },
  chapter: { fontWeight: 'bold', fontSize: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  item: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
});
```

- [ ] **Step 3: Run the tests and commit**

Run: `npx jest src/__tests__/search-screen.test.tsx` → PASS.

```bash
git add app && git commit -m "feat(search): search screen with grouped, highlighted results"
```

---

### Task 14: Bookmarks and Recents screens

**Files:**
- Create: `app/src/app/bookmarks.tsx`, `app/src/app/recents.tsx`
- Test: `app/src/__tests__/lists.test.tsx`

**Interfaces:**
- Consumes: `useBookmarks`, `useReading`, `chapterTitle`, `IconButton`, `Empty`, `useTitle`.
- Produces: routes `/bookmarks` and `/recents`.

- [ ] **Step 1: Write the failing tests**

```tsx
import { Text } from 'react-native';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import BookmarksScreen from '@/app/bookmarks';
import RecentsScreen from '@/app/recents';
import { useBookmarks } from '@/store/bookmarks';
import { useReading } from '@/store/reading';

const routes = { _layout: () => <Stack />, bookmarks: BookmarksScreen, recents: RecentsScreen, 'chapter/[slug]': () => <Text>chapter</Text> };

beforeEach(() => {
  useBookmarks.setState(useBookmarks.getInitialState(), true);
  useReading.setState(useReading.getInitialState(), true);
});

it('shows an empty state', () => {
  renderRouter(routes, { initialUrl: '/bookmarks' });
  expect(screen.getByText('No bookmarks yet. Tap the bookmark icon while reading.')).toBeVisible();
});

it('opens and deletes bookmarks', () => {
  useBookmarks.getState().toggle('Water', 7, 'Boiling');
  renderRouter(routes, { initialUrl: '/bookmarks' });
  expect(screen.getByText('Boiling')).toBeVisible();
  fireEvent.press(screen.getByLabelText('Delete'));
  expect(useBookmarks.getState().items).toEqual([]);
  useBookmarks.getState().toggle('Water', 7, 'Boiling');
  renderRouter(routes, { initialUrl: '/bookmarks' });
  fireEvent.press(screen.getByText('Water'));
  expect(screen).toHavePathname('/chapter/Water');
  expect(screen).toHaveSearchParams({ block: '7' });
});

it('lists recents newest first', () => {
  useReading.getState().visit('Fire');
  useReading.getState().visit('Water');
  renderRouter(routes, { initialUrl: '/recents' });
  const titles = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
  expect(titles.slice(0, 2)).toEqual(['Water', 'Fire']);
  fireEvent.press(screen.getByText('Fire'));
  expect(screen).toHavePathname('/chapter/Fire');
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/app/bookmarks.tsx`**

```tsx
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Empty } from '@/components/Empty';
import { IconButton } from '@/components/IconButton';
import { chapterTitle } from '@/lib/chapters';
import { useTitle } from '@/lib/useTitle';
import { useBookmarks } from '@/store/bookmarks';
import { useColors } from '@/theme';

export default function BookmarksScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('bookmarks'));
  const items = useBookmarks((s) => s.items);
  const remove = useBookmarks((s) => s.remove);
  if (!items.length) return <Empty text={t('bookmarks_empty')} />;
  return (
    <FlatList
      data={[...items].sort((a, b) => b.createdAt - a.createdAt)}
      keyExtractor={(b) => b.id}
      renderItem={({ item }) => (
        <View style={[styles.row, { borderColor: colors.border }]}>
          <Pressable
            style={styles.main}
            onPress={() => router.push({ pathname: '/chapter/[slug]', params: { slug: item.slug, block: String(item.blockIndex) } })}
          >
            <Text style={[styles.title, { color: colors.text }]}>{chapterTitle(item.slug, t)}</Text>
            {item.label ? <Text style={{ color: colors.muted }}>{item.label}</Text> : null}
          </Pressable>
          <IconButton icon="delete-outline" label={t('delete')} color={colors.muted} onPress={() => remove(item.id)} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, paddingVertical: 12 },
  title: { fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 3: Implement `src/app/recents.tsx`**

```tsx
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Empty } from '@/components/Empty';
import { chapterTitle } from '@/lib/chapters';
import { useTitle } from '@/lib/useTitle';
import { useReading } from '@/store/reading';
import { useColors } from '@/theme';

export default function RecentsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('recents'));
  const recents = useReading((s) => s.recents);
  if (!recents.length) return <Empty text={t('recents_empty')} />;
  return (
    <FlatList
      data={recents}
      keyExtractor={(s) => s}
      renderItem={({ item }) => {
        const title = chapterTitle(item, t);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            onPress={() => router.push({ pathname: '/chapter/[slug]', params: { slug: item } })}
            style={[styles.row, { borderColor: colors.border }]}
          >
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16 },
});
```

- [ ] **Step 4: Run the tests and commit**

Run: `npx jest src/__tests__/lists.test.tsx` → PASS.

```bash
git add app && git commit -m "feat(app): bookmarks and recently read screens"
```

---

### Task 15: Image viewer

**Files:**
- Create: `app/src/components/ZoomableImage.tsx`, `app/src/app/image/[name].tsx`
- Test: `app/src/__tests__/image.test.tsx`

**Interfaces:**
- Consumes: `images`, `ImageAsset`, `NotFound`, `IconButton`, `goBack`, `useTitle`.
- Produces: route `/image/[name]` and `ZoomableImage({ asset, alt })`.

- [ ] **Step 1: Write the failing test**

```tsx
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
```

Run → FAIL.

- [ ] **Step 2: Implement `src/components/ZoomableImage.tsx`**

```tsx
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ImageAsset } from '@/types/content';

export function ZoomableImage({ asset, alt }: { asset: ImageAsset; alt: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(6, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      x.value = savedX.value + e.translationX;
      y.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? 1 : 2.5;
      scale.value = withTiming(next);
      savedScale.value = next;
      if (next === 1) {
        x.value = withTiming(0);
        y.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <View style={styles.fill}>
        <Animated.Image accessibilityLabel={alt} source={asset.source} resizeMode="contain" style={[styles.image, { aspectRatio: asset.width / asset.height }, style]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', overflow: 'hidden' },
  image: { width: '100%' },
});
```

- [ ] **Step 3: Implement `src/app/image/[name].tsx`**

```tsx
import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { images } from '@/content/images';
import { IconButton } from '@/components/IconButton';
import { NotFound } from '@/components/NotFound';
import { ZoomableImage } from '@/components/ZoomableImage';
import { goBack } from '@/lib/nav';
import { useTitle } from '@/lib/useTitle';
import { useColors } from '@/theme';

export async function generateStaticParams() {
  return Object.keys(images).map((name) => ({ name }));
}

export default function ImageScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { name } = useLocalSearchParams<{ name: string }>();
  const asset = name ? images[name] : undefined;
  const close = useCallback(() => <IconButton icon="close" label={t('close')} color={colors.onPrimary} onPress={() => goBack('/')} />, [t, colors.onPrimary]);
  useTitle(name ?? '', close);
  if (!asset) return <NotFound message={t('image_not_found')} />;
  return <ZoomableImage asset={asset} alt={name} />;
}
```

- [ ] **Step 4: Run the tests and check by hand**

Run: `npx jest src/__tests__/image.test.tsx` → PASS.

On an Android emulator, open Fire, tap a figure, then pinch, pan and double-tap. Check that the close button returns to the chapter.

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat(app): full-screen zoomable image viewer"
```

---

### Task 16: Settings screen

**Files:**
- Create: `app/src/components/Choices.tsx`, `app/src/app/settings.tsx`
- Test: `app/src/__tests__/settings.test.tsx`

**Interfaces:**
- Consumes: `useSettings`, `fontSize`, `useColors`, `useTitle`.
- Produces: route `/settings`; `Choices<T extends string | number>({ value, options: [T, string][], onChange })`, which renders radio-role chips.

- [ ] **Step 1: Write the failing test**

```tsx
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import SettingsScreen from '@/app/settings';
import { useSettings } from '@/store/settings';

const routes = { _layout: () => <Stack />, settings: SettingsScreen };

beforeEach(() => useSettings.setState(useSettings.getInitialState(), true));

it('changes theme, font size, keep-awake, reading speed and language', () => {
  renderRouter(routes, { initialUrl: '/settings' });
  fireEvent.press(screen.getByRole('radio', { name: 'True black (AMOLED)' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Large' }));
  fireEvent(screen.getByRole('switch'), 'valueChange', false);
  fireEvent.press(screen.getByRole('radio', { name: '1.5×' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Français' }));
  expect(useSettings.getState()).toMatchObject({ theme: 'amoled', fontStep: 3, keepAwake: false, ttsRate: 1.5, language: 'fr' });
  fireEvent.press(screen.getByRole('radio', { name: 'System default' }));
  expect(useSettings.getState().language).toBeUndefined();
});
```

French has no `language_system` string, so i18next falls back to English (`System default`) after switching to French. Run → FAIL.

- [ ] **Step 2: Implement `src/components/Choices.tsx`**

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme';

type Props<T> = { value: T; options: [T, string][]; onChange: (v: T) => void };

export function Choices<T extends string | number>({ value, options, onChange }: Props<T>) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      {options.map(([v, label]) => {
        const selected = v === value;
        return (
          <Pressable
            key={String(v)}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(v)}
            style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' }]}
          >
            <Text style={{ color: selected ? colors.onPrimary : colors.text }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
});
```

- [ ] **Step 3: Implement `src/app/settings.tsx`**

```tsx
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Choices } from '@/components/Choices';
import { useTitle } from '@/lib/useTitle';
import { fontSize, useSettings, type ThemeMode } from '@/store/settings';
import { useColors } from '@/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('settings'));
  const s = useSettings();
  const label = (text: string) => <Text style={[styles.label, { color: colors.text }]}>{text}</Text>;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {label(t('preference_daynight_title'))}
      <Choices<ThemeMode>
        value={s.theme}
        options={[['system', t('system')], ['day', t('day')], ['night', t('night')], ['amoled', t('amoled')]]}
        onChange={(theme) => s.set({ theme })}
      />
      {label(t('preference_fontsize_title'))}
      <Choices<number>
        value={s.fontStep}
        options={[[0, t('tiny')], [1, t('small')], [2, t('medium')], [3, t('large')], [4, t('huge')]]}
        onChange={(fontStep) => s.set({ fontStep })}
      />
      <Text style={{ color: colors.text, fontSize: fontSize(s.fontStep), marginBottom: 16 }}>{t('font_preview')}</Text>
      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: colors.text }]}>{t('keep_awake')}</Text>
        <Switch accessibilityRole="switch" value={s.keepAwake} onValueChange={(keepAwake) => s.set({ keepAwake })} />
      </View>
      {label(t('tts_rate'))}
      <Choices<number>
        value={s.ttsRate}
        options={[[0.75, '0.75×'], [1, '1×'], [1.25, '1.25×'], [1.5, '1.5×']]}
        onChange={(ttsRate) => s.set({ ttsRate })}
      />
      {label(t('language'))}
      <Choices<string>
        value={s.language ?? 'system'}
        options={[['system', t('language_system')], ['en', 'English'], ['fr', 'Français']]}
        onChange={(v) => s.set({ language: v === 'system' ? undefined : v })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  label: { fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  switchLabel: { flex: 1, fontSize: 16 },
});
```

- [ ] **Step 4: Run the tests and commit**

Run: `npx jest src/__tests__/settings.test.tsx` → PASS.

```bash
git add app && git commit -m "feat(app): settings for theme, text size, keep-awake, reading speed and language"
```

---

### Task 17: Checklists

**Files:**
- Create: `app/src/tools/checklistTemplates.ts`, `app/src/app/tools/checklists.tsx`, `app/src/app/tools/checklist.tsx`
- Test: `app/src/__tests__/checklists.test.tsx`

**Interfaces:**
- Consumes: `useChecklists` (Task 7), `Button`, `IconButton`, `NotFound`, `goBack`, `useTitle`.
- Produces:
  - `checklistTemplates: { id: string; titleKey: string; items: string[] }[]`, with ids `kit`, `72h` and `medical`
  - Routes `/tools/checklists` and `/tools/checklist?id=`

- [ ] **Step 1: Write the failing tests**

```tsx
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import ChecklistScreen from '@/app/tools/checklist';
import ChecklistsScreen from '@/app/tools/checklists';
import { useChecklists } from '@/store/checklists';

const routes = { _layout: () => <Stack />, 'tools/checklists': ChecklistsScreen, 'tools/checklist': ChecklistScreen };

beforeEach(() => useChecklists.setState(useChecklists.getInitialState(), true));

it('creates a list from a template and ticks, adds and resets items', () => {
  renderRouter(routes, { initialUrl: '/tools/checklists' });
  expect(screen.getByText('No lists yet.')).toBeVisible();
  fireEvent.press(screen.getByText('New list'));
  fireEvent.press(screen.getByText('Survival kit'));
  expect(screen).toHavePathname('/tools/checklist');
  const list = useChecklists.getState().lists[0];
  expect(list.templateId).toBe('kit');
  fireEvent.press(screen.getAllByRole('checkbox')[0]);
  expect(useChecklists.getState().lists[0].items[0].done).toBe(true);
  fireEvent.changeText(screen.getByTestId('new-item'), 'Spare socks');
  fireEvent(screen.getByTestId('new-item'), 'submitEditing');
  expect(useChecklists.getState().lists[0].items.at(-1)?.text).toBe('Spare socks');
  fireEvent.press(screen.getByText('Untick all'));
  expect(useChecklists.getState().lists[0].items.every((i) => !i.done)).toBe(true);
});

it('needs two taps to delete a list', () => {
  const id = useChecklists.getState().create('Mine', ['a']);
  renderRouter(routes, { initialUrl: `/tools/checklist?id=${id}` });
  fireEvent.press(screen.getByText('Delete list'));
  expect(useChecklists.getState().lists).toHaveLength(1);
  fireEvent.press(screen.getByText('Tap again to delete'));
  expect(useChecklists.getState().lists).toHaveLength(0);
});

it('shows not found for an unknown list id', () => {
  renderRouter(routes, { initialUrl: '/tools/checklist?id=nope' });
  expect(screen.getByText('List not found')).toBeVisible();
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/tools/checklistTemplates.ts`**

```ts
export type ChecklistTemplate = { id: string; titleKey: string; items: string[] };

// English only: item text is data, like the chapter content.
export const checklistTemplates: ChecklistTemplate[] = [
  {
    id: 'kit',
    titleKey: 'template_kit',
    items: [
      'Water bottle or canteen',
      'Water purification tablets or filter',
      'Fire starter (ferro rod, lighter, waterproof matches)',
      'Fixed-blade knife or multitool',
      'Signal mirror',
      'Whistle',
      'Compass and map',
      'Flashlight with spare batteries',
      'Paracord (15 m)',
      'Emergency (space) blanket',
      'Poncho or tarp',
      'First aid kit',
      'High-energy food rations',
      'Fishing line and hooks',
    ],
  },
  {
    id: '72h',
    titleKey: 'template_72h',
    items: [
      'Agree on a meeting point and an out-of-area contact',
      'Plan two evacuation routes',
      '4 litres of water per person per day for 3 days',
      'Non-perishable food for 3 days',
      'Manual can opener',
      'Battery or hand-crank radio',
      'Copies of ID and important documents',
      'Cash in small bills',
      'Prescription medicines for 7 days',
      'Power bank and charging cables',
      'Warm clothing and sturdy shoes for everyone',
      'Sleeping bag or blanket per person',
      'Hygiene kit',
      'Pet food and supplies',
    ],
  },
  {
    id: 'medical',
    titleKey: 'template_medical',
    items: [
      'Adhesive bandages (assorted)',
      'Sterile gauze pads',
      'Roller and elastic bandages',
      'Triangular bandage',
      'Medical tape',
      'Tourniquet',
      'Antiseptic wipes',
      'Antibiotic ointment',
      'Tweezers and scissors',
      'Disposable gloves',
      'Pain relievers',
      'Antihistamines',
      'Oral rehydration salts',
      'Thermometer',
      'Personal prescription medicines',
    ],
  },
];
```

- [ ] **Step 3: Implement `src/app/tools/checklists.tsx`**

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { useTitle } from '@/lib/useTitle';
import { useChecklists } from '@/store/checklists';
import { useColors } from '@/theme';
import { checklistTemplates } from '@/tools/checklistTemplates';

export default function ChecklistsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('checklists'));
  const lists = useChecklists((s) => s.lists);
  const create = useChecklists((s) => s.create);
  const [picking, setPicking] = useState(false);

  const open = (id: string) => router.push({ pathname: '/tools/checklist', params: { id } });
  const start = (title: string, items: string[], templateId?: string) => {
    setPicking(false);
    open(create(title, items, templateId));
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {lists.length === 0 && <Text style={[styles.empty, { color: colors.muted }]}>{t('checklists_empty')}</Text>}
      {lists.map((l) => (
        <Pressable key={l.id} onPress={() => open(l.id)} style={[styles.card, { borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{l.title}</Text>
          <Text style={{ color: colors.muted }}>{`${l.items.filter((i) => i.done).length}/${l.items.length}`}</Text>
        </Pressable>
      ))}
      {picking ? (
        <>
          <Text style={[styles.label, { color: colors.text }]}>{t('checklist_from_template')}</Text>
          {checklistTemplates.map((tpl) => (
            <Button key={tpl.id} variant="plain" label={t(tpl.titleKey)} onPress={() => start(t(tpl.titleKey), tpl.items, tpl.id)} />
          ))}
          <Button variant="plain" label={t('checklist_blank')} onPress={() => start(t('checklist_new'), [])} />
        </>
      ) : (
        <Button label={t('checklist_new')} onPress={() => setPicking(true)} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  empty: { fontSize: 16, marginBottom: 16 },
  card: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 16, fontWeight: '600', marginTop: 12 },
});
```

- [ ] **Step 4: Implement `src/app/tools/checklist.tsx`**

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { NotFound } from '@/components/NotFound';
import { goBack } from '@/lib/nav';
import { useTitle } from '@/lib/useTitle';
import { useChecklists } from '@/store/checklists';
import { useColors } from '@/theme';

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const list = useChecklists((s) => s.lists.find((l) => l.id === id));
  const { rename, addItem, editItem, removeItem, toggle, reset, remove } = useChecklists.getState();
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useTitle(list?.title ?? t('checklists'));
  if (!list) return <NotFound message={t('checklist_not_found')} />;

  const submit = () => {
    if (!draft.trim()) return;
    addItem(list.id, draft.trim());
    setDraft('');
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextInput
        accessibilityLabel={t('checklist_title')}
        value={list.title}
        onChangeText={(v) => rename(list.id, v)}
        style={[styles.title, { color: colors.text, borderColor: colors.border }]}
      />
      {list.items.map((item) => (
        <View key={item.id} style={styles.item}>
          <Pressable accessibilityRole="checkbox" accessibilityLabel={item.text} accessibilityState={{ checked: item.done }} onPress={() => toggle(list.id, item.id)} hitSlop={8}>
            <MaterialCommunityIcons name={item.done ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={colors.primary} />
          </Pressable>
          <TextInput
            value={item.text}
            onChangeText={(v) => editItem(list.id, item.id, v)}
            style={[styles.itemText, { color: item.done ? colors.muted : colors.text }, item.done && styles.done]}
          />
          <IconButton icon="close" label={t('delete')} color={colors.muted} onPress={() => removeItem(list.id, item.id)} />
        </View>
      ))}
      <TextInput
        testID="new-item"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={submit}
        placeholder={t('checklist_add_item')}
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        style={[styles.newItem, { color: colors.text, borderColor: colors.border }]}
      />
      <Button variant="plain" label={t('checklist_reset')} onPress={() => reset(list.id)} />
      <Button
        variant="danger"
        label={confirmDelete ? t('checklist_delete_confirm') : t('checklist_delete')}
        onPress={() => {
          if (!confirmDelete) return setConfirmDelete(true);
          remove(list.id);
          goBack('/tools/checklists');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', borderBottomWidth: 1, paddingVertical: 8, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemText: { flex: 1, fontSize: 16, paddingVertical: 8 },
  done: { textDecorationLine: 'line-through' },
  newItem: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16, marginVertical: 12 },
});
```

- [ ] **Step 5: Run the tests and commit**

Run: `npx jest src/__tests__/checklists.test.tsx` → PASS.

```bash
git add app && git commit -m "feat(tools): checklists with kit, 72-hour and medical templates"
```

---

### Task 18: Emergency card

**Files:**
- Create: `app/src/app/tools/emergency-card.tsx`
- Test: `app/src/__tests__/emergency.test.tsx`

**Interfaces:**
- Consumes: `useEmergency`, `hasCard`, `EmergencyCard` (Task 7); `Button`, `IconButton`, `useTitle`.
- Produces: route `/tools/emergency-card`. The drawer pin already exists (Task 11).

- [ ] **Step 1: Write the failing test**

```tsx
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useKeepAwake } from 'expo-keep-awake';
import EmergencyCardScreen from '@/app/tools/emergency-card';
import { useEmergency } from '@/store/emergency';

const routes = { _layout: () => <Stack />, 'tools/emergency-card': EmergencyCardScreen };

beforeEach(() => useEmergency.setState(useEmergency.getInitialState(), true));

it('saves fields and contacts as you type and shows the rescuer view', () => {
  renderRouter(routes, { initialUrl: '/tools/emergency-card' });
  expect(screen.getByText('Stored only on this device. Never uploaded.')).toBeVisible();
  expect(screen.getByText('Show to rescuer')).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Blood type'), 'O-');
  fireEvent.press(screen.getByText('Add contact'));
  fireEvent.changeText(screen.getByLabelText('Contact name'), 'Ana');
  fireEvent.changeText(screen.getByLabelText('Phone'), '+351 900 000 000');
  expect(useEmergency.getState().card).toMatchObject({ bloodType: 'O-', contacts: [{ name: 'Ana', phone: '+351 900 000 000' }] });
  fireEvent.press(screen.getByText('Show to rescuer'));
  expect(screen.getByText('EMERGENCY INFORMATION')).toBeVisible();
  expect(screen.getByText('O-')).toBeVisible();
  expect(useKeepAwake).toHaveBeenCalled();
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/app/tools/emergency-card.tsx`**

```tsx
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { useTitle } from '@/lib/useTitle';
import { hasCard, useEmergency, type EmergencyCard } from '@/store/emergency';
import { useColors } from '@/theme';

type TextField = Exclude<keyof EmergencyCard, 'contacts'>;
const FIELDS: [TextField, string, boolean][] = [
  ['name', 'ec_name', false],
  ['bloodType', 'ec_blood', false],
  ['allergies', 'ec_allergies', true],
  ['medications', 'ec_medications', true],
  ['conditions', 'ec_conditions', true],
  ['notes', 'ec_notes', true],
];

export default function EmergencyCardScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('emergency_card'));
  const card = useEmergency((s) => s.card);
  const update = useEmergency((s) => s.update);
  const [rescuer, setRescuer] = useState(false);
  if (rescuer) return <RescuerView card={card} onClose={() => setRescuer(false)} />;

  const input = { color: colors.text, borderColor: colors.border };
  const setContact = (i: number, patch: Partial<EmergencyCard['contacts'][number]>) =>
    update({ contacts: card.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.note, { color: colors.muted }]}>{t('ec_local_only')}</Text>
      {FIELDS.map(([key, labelKey, multiline]) => (
        <View key={key} style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>{t(labelKey)}</Text>
          <TextInput accessibilityLabel={t(labelKey)} value={card[key]} multiline={multiline} onChangeText={(v) => update({ [key]: v })} style={[styles.input, input]} />
        </View>
      ))}
      <Text style={[styles.label, { color: colors.text }]}>{t('ec_contacts')}</Text>
      {card.contacts.map((c, i) => (
        <View key={i} style={styles.contact}>
          <TextInput accessibilityLabel={t('ec_contact_name')} placeholder={t('ec_contact_name')} placeholderTextColor={colors.muted} value={c.name} onChangeText={(name) => setContact(i, { name })} style={[styles.input, styles.flex, input]} />
          <TextInput accessibilityLabel={t('ec_contact_phone')} placeholder={t('ec_contact_phone')} placeholderTextColor={colors.muted} keyboardType="phone-pad" value={c.phone} onChangeText={(phone) => setContact(i, { phone })} style={[styles.input, styles.flex, input]} />
          <IconButton icon="close" label={t('delete')} color={colors.muted} onPress={() => update({ contacts: card.contacts.filter((_, j) => j !== i) })} />
        </View>
      ))}
      <Button variant="plain" label={t('ec_add_contact')} onPress={() => update({ contacts: [...card.contacts, { name: '', phone: '' }] })} />
      <Button label={t('ec_show_rescuer')} disabled={!hasCard(card)} onPress={() => setRescuer(true)} />
    </ScrollView>
  );
}

function RescuerView({ card, onClose }: { card: EmergencyCard; onClose: () => void }) {
  useKeepAwake('rescuer');
  const { t } = useTranslation();
  const rows = FIELDS.filter(([key]) => card[key].trim());
  return (
    <ScrollView style={styles.rescuer} contentContainerStyle={styles.content}>
      <Text style={styles.rescuerTitle}>{t('ec_rescuer_title')}</Text>
      {rows.map(([key, labelKey]) => (
        <View key={key} style={styles.field}>
          <Text style={styles.rescuerLabel}>{t(labelKey)}</Text>
          <Text style={styles.rescuerValue}>{card[key]}</Text>
        </View>
      ))}
      {card.contacts
        .filter((c) => c.name.trim() || c.phone.trim())
        .map((c, i) => (
          <Text key={i} style={styles.rescuerValue} onPress={c.phone ? () => Linking.openURL(`tel:${c.phone.replace(/\s/g, '')}`) : undefined}>
            {`${c.name} ${c.phone}`.trim()}
          </Text>
        ))}
      <Button label={t('close')} onPress={onClose} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  note: { fontSize: 14, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  flex: { flex: 1 },
  rescuer: { backgroundColor: '#000000' },
  rescuerTitle: { color: '#ff5252', fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  rescuerLabel: { color: '#bbbbbb', fontSize: 18 },
  rescuerValue: { color: '#ffffff', fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
});
```

- [ ] **Step 3: Run the tests and commit**

Run: `npx jest src/__tests__/emergency.test.tsx && npx tsc --noEmit` → PASS and exit 0.

```bash
git add app && git commit -m "feat(tools): local-only emergency card with rescuer view"
```

---

### Task 19: Morse encoder, timeline and beep asset

**Files:**
- Create: `app/src/tools/morse.ts`, `app/scripts/make-beep.mts`, `app/assets/beep.wav` (generated, then committed)
- Test: `app/src/tools/__tests__/morse.test.ts`

**Interfaces:**
- Produces:
  - `encode(text: string): { code: string; skipped: string[] }`
  - `type Step = { on: boolean; units: number }`
  - `toTimeline(code: string): Step[]`
  - `unitMs(wpm: number): number`
  - `runTimeline(steps: Step[], unit: number, onChange: (on: boolean) => void, loop: boolean, onDone?: () => void): () => void`
  - `assets/beep.wav`: a 1 s, 600 Hz, 16-bit mono tone that loops seamlessly

- [ ] **Step 1: Write the failing tests**

```ts
import { encode, runTimeline, toTimeline, unitMs } from '@/tools/morse';

describe('encode', () => {
  it('encodes letters and words', () => {
    expect(encode('SOS')).toEqual({ code: '... --- ...', skipped: [] });
    expect(encode('Hi there').code).toBe('.... .. / - .... . .-. .');
  });
  it('folds accents and reports characters without a code', () => {
    expect(encode('é').code).toBe('.');
    expect(encode('a#🆘b')).toEqual({ code: '.- -...', skipped: ['#', '🆘'] });
  });
  it('returns an empty code when nothing is encodable', () => {
    expect(encode('### 漢字')).toEqual({ code: '', skipped: ['#', '漢', '字'] });
    expect(encode('   ').code).toBe('');
  });
});

describe('toTimeline', () => {
  const units = (code: string) => toTimeline(code).reduce((n, s) => n + s.units, 0);
  it('uses standard timing', () => {
    expect(toTimeline('.-')).toEqual([{ on: true, units: 1 }, { on: false, units: 1 }, { on: true, units: 3 }, { on: false, units: 7 }]);
    expect(toTimeline('. .')[1]).toEqual({ on: false, units: 3 });
    expect(toTimeline('. / .')[1]).toEqual({ on: false, units: 7 });
    expect(units('... --- ...')).toBe(34);
  });
  it('is empty for an empty code', () => expect(toTimeline('')).toEqual([]));
});

it('derives the unit from words per minute', () => expect(unitMs(20)).toBe(60));

describe('runTimeline', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const steps = [{ on: true, units: 1 }, { on: false, units: 1 }];

  it('plays once and finishes', () => {
    const onChange = jest.fn();
    const onDone = jest.fn();
    runTimeline(steps, 100, onChange, false, onDone);
    expect(onChange.mock.calls).toEqual([[true]]);
    jest.advanceTimersByTime(100);
    expect(onChange).toHaveBeenLastCalledWith(false);
    jest.advanceTimersByTime(100);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('loops until cancelled', () => {
    const onChange = jest.fn();
    const cancel = runTimeline(steps, 100, onChange, true);
    jest.advanceTimersByTime(200);
    expect(onChange).toHaveBeenLastCalledWith(true);
    cancel();
    expect(onChange).toHaveBeenLastCalledWith(false);
    const calls = onChange.mock.calls.length;
    jest.advanceTimersByTime(1000);
    expect(onChange.mock.calls.length).toBe(calls);
  });

  it('does nothing harmful with an empty timeline', () => {
    const onDone = jest.fn();
    runTimeline([], 100, jest.fn(), true, onDone);
    expect(onDone).toHaveBeenCalled();
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/tools/morse.ts`**

```ts
const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...',
  ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '@': '.--.-.',
};

export type Step = { on: boolean; units: number };

export function encode(text: string): { code: string; skipped: string[] } {
  const skipped = new Set<string>();
  const words = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      [...word]
        .map((ch) => {
          const c = MORSE[ch];
          if (!c) skipped.add(ch);
          return c;
        })
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean);
  return { code: words.join(' / '), skipped: [...skipped] };
}

export function toTimeline(code: string): Step[] {
  const steps: Step[] = [];
  const words = code.split(' / ').map((w) => w.split(' ').filter(Boolean)).filter((w) => w.length);
  words.forEach((letters, wi) => {
    if (wi > 0) steps.push({ on: false, units: 7 });
    letters.forEach((letter, li) => {
      if (li > 0) steps.push({ on: false, units: 3 });
      [...letter].forEach((el, ei) => {
        if (ei > 0) steps.push({ on: false, units: 1 });
        steps.push({ on: true, units: el === '-' ? 3 : 1 });
      });
    });
  });
  if (steps.length) steps.push({ on: false, units: 7 });
  return steps;
}

export const unitMs = (wpm: number) => 1200 / wpm;

export function runTimeline(steps: Step[], unit: number, onChange: (on: boolean) => void, loop: boolean, onDone?: () => void): () => void {
  let i = 0;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = () => {
    if (cancelled) return;
    if (i >= steps.length) {
      if (loop && steps.length) i = 0;
      else {
        onChange(false);
        onDone?.();
        return;
      }
    }
    const step = steps[i++];
    onChange(step.on);
    timer = setTimeout(tick, step.units * unit);
  };
  tick();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    onChange(false);
  };
}
```

- [ ] **Step 3: Generate the beep**

`scripts/make-beep.mts`:

```ts
// One-off: writes assets/beep.wav (1 s, 600 Hz sine, 16-bit mono). 600 whole cycles → loops without a click.
import { writeFileSync } from 'node:fs';

const rate = 44100;
const n = rate;
const data = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 600 * i) / rate) * 0.5 * 32767), i * 2);
const h = Buffer.alloc(44);
h.write('RIFF', 0);
h.writeUInt32LE(36 + data.length, 4);
h.write('WAVE', 8);
h.write('fmt ', 12);
h.writeUInt32LE(16, 16);
h.writeUInt16LE(1, 20);
h.writeUInt16LE(1, 22);
h.writeUInt32LE(rate, 24);
h.writeUInt32LE(rate * 2, 28);
h.writeUInt16LE(2, 32);
h.writeUInt16LE(16, 34);
h.write('data', 36);
h.writeUInt32LE(data.length, 40);
writeFileSync(new URL('../assets/beep.wav', import.meta.url), Buffer.concat([h, data]));
```

Run: `npx tsx scripts/make-beep.mts && file assets/beep.wav`
Expected: `RIFF (little-endian) data, WAVE audio, Microsoft PCM, 16 bit, mono 44100 Hz`.

- [ ] **Step 4: Run the tests and commit**

Run: `npx jest src/tools` → PASS.

```bash
git add app && git commit -m "feat(tools): Morse encoder, signal timeline and beep tone"
```

---

### Task 20: SOS screen

**Files:**
- Create: `app/src/app/tools/sos.tsx`
- Test: `app/src/__tests__/sos.test.tsx`

**Interfaces:**
- Consumes: `encode`, `toTimeline`, `unitMs`, `runTimeline` (Task 19); `assets/beep.wav`; `expo-camera` (`CameraView`, `useCameraPermissions`); `expo-audio` (`useAudioPlayer`); `Button`, `useTitle`.
- Produces: route `/tools/sos`. The strobe overlay has `testID="strobe"`.

- [ ] **Step 1: Write the failing tests**

```tsx
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import SosScreen from '@/app/tools/sos';

jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: false }, jest.fn(async () => ({ granted: false }))],
}));
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(async () => {}), loop: false }),
}));

const routes = { _layout: () => <Stack />, 'tools/sos': SosScreen };

beforeEach(() => jest.useFakeTimers());
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
```

Run → FAIL.

- [ ] **Step 2: Implement `src/app/tools/sos.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAudioPlayer } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { useTitle } from '@/lib/useTitle';
import { useColors } from '@/theme';
import { encode, runTimeline, toTimeline, unitMs } from '@/tools/morse';

const beep = require('../../../assets/beep.wav');
const MIN_WPM = 5;
const MAX_WPM = 20;

export default function SosScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('sos'));
  const [message, setMessage] = useState('SOS');
  const [wpm, setWpm] = useState(8);
  const [outputs, setOutputs] = useState({ torch: false, screen: true, tone: false });
  const [loop, setLoop] = useState(true);
  const [running, setRunning] = useState(false);
  const [on, setOn] = useState(false);
  const [torchError, setTorchError] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const player = useAudioPlayer(beep);
  const cancel = useRef<(() => void) | null>(null);
  const { code, skipped } = useMemo(() => encode(message), [message]);
  const torchSupported = Platform.OS !== 'web' && !torchError;

  const stop = useCallback(() => {
    cancel.current?.();
    cancel.current = null;
    setRunning(false);
    setOn(false);
  }, []);

  const start = () => {
    if (!code) return;
    setRunning(true);
    cancel.current = runTimeline(toTimeline(code), unitMs(wpm), setOn, loop, () => setRunning(false));
  };

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!outputs.tone) return;
    if (running && on) {
      player.loop = true;
      void player.seekTo(0);
      player.play();
    } else {
      player.pause();
    }
  }, [on, running, outputs.tone, player]);

  const setTorch = async (value: boolean) => {
    if (value && !permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setOutputs((o) => ({ ...o, torch: value }));
  };

  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <View style={styles.switchRow}>
      <Text style={[styles.switchLabel, { color: colors.text }]}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, { color: colors.text }]}>{t('sos_message')}</Text>
      <View style={styles.messageRow}>
        <TextInput
          accessibilityLabel={t('sos_message')}
          value={message}
          onChangeText={setMessage}
          autoCapitalize="characters"
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        <Button variant="plain" label="SOS" onPress={() => setMessage('SOS')} />
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{t('sos_code')}</Text>
      <Text selectable style={[styles.code, { color: colors.text }]}>
        {code}
      </Text>
      {skipped.length > 0 && <Text style={{ color: colors.danger }}>{t('sos_skipped', { chars: skipped.join(' ') })}</Text>}

      <View style={styles.speedRow}>
        <IconButton icon="minus" label={t('sos_slower')} color={colors.text} onPress={() => setWpm((w) => Math.max(MIN_WPM, w - 1))} />
        <Text style={{ color: colors.text }}>{t('sos_speed', { wpm })}</Text>
        <IconButton icon="plus" label={t('sos_faster')} color={colors.text} onPress={() => setWpm((w) => Math.min(MAX_WPM, w + 1))} />
      </View>

      {Platform.OS !== 'web' && toggle(t('sos_torch'), outputs.torch, (v) => void setTorch(v), !torchSupported)}
      {Platform.OS !== 'web' && torchError && <Text style={{ color: colors.muted }}>{t('sos_no_torch')}</Text>}
      {Platform.OS !== 'web' && permission && !permission.granted && !permission.canAskAgain && <Text style={{ color: colors.muted }}>{t('sos_torch_permission')}</Text>}
      {toggle(t('sos_screen'), outputs.screen, (v) => setOutputs((o) => ({ ...o, screen: v })))}
      {toggle(t('sos_tone'), outputs.tone, (v) => setOutputs((o) => ({ ...o, tone: v })))}
      {toggle(t('sos_loop'), loop, setLoop)}

      {running ? <Button variant="danger" label={t('sos_stop')} onPress={stop} /> : <Button label={t('sos_start')} disabled={!code} onPress={start} />}

      {outputs.torch && torchSupported && permission?.granted && (
        <CameraView style={styles.hiddenCamera} enableTorch={running && on} onMountError={() => setTorchError(true)} />
      )}

      <Modal visible={running && outputs.screen} animationType="none" onRequestClose={stop}>
        <Pressable testID="strobe" accessibilityLabel={t('sos_stop')} onPress={stop} style={[styles.fill, { backgroundColor: on ? '#ffffff' : '#000000' }]} />
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  label: { fontSize: 15, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 18 },
  code: { fontSize: 22, letterSpacing: 2, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 },
  switchLabel: { fontSize: 16 },
  hiddenCamera: { width: 1, height: 1, opacity: 0 },
  fill: { flex: 1 },
});
```

- [ ] **Step 3: Run the tests and check by hand**

Run: `npx jest src/__tests__/sos.test.tsx` → PASS.

On a physical Android device (`npm run android`): enable the flashlight and check that SOS blinks visibly. Check the tone and the strobe. On Web, check that the flashlight switch is hidden and that the strobe works. Write down any torch lag in the task report.

- [ ] **Step 4: Commit**

```bash
git add app && git commit -m "feat(tools): SOS/Morse signaling via flashlight, screen strobe and tone"
```

---

### Task 21: Compass

**Files:**
- Create: `app/src/tools/cardinal.ts`, `app/src/tools/CompassUnavailable.tsx`, `app/src/tools/Compass.tsx`, `app/src/tools/Compass.web.tsx`, `app/src/app/tools/compass.tsx`
- Test: `app/src/tools/__tests__/compass.test.tsx`

**Interfaces:**
- Consumes: `expo-location` (`requestForegroundPermissionsAsync`, `watchHeadingAsync`); `Button`, `useColors`, `useTitle`.
- Produces: `cardinal(deg: number): string`; `Compass` (native) / `Compass` (web, unavailable); route `/tools/compass`.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { cardinal } from '@/tools/cardinal';
import { Compass } from '@/tools/Compass';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn(), watchHeadingAsync: jest.fn() }));
const perm = Location.requestForegroundPermissionsAsync as jest.Mock;
const watch = Location.watchHeadingAsync as jest.Mock;

it('names the eight cardinal directions', () => {
  expect([0, 44, 46, 90, 180, 270, 359, -90, 720].map(cardinal)).toEqual(['N', 'NE', 'NE', 'E', 'S', 'W', 'N', 'W', 'N']);
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
```

Run → FAIL.

- [ ] **Step 2: Implement the compass modules**

`src/tools/cardinal.ts`:

```ts
const NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function cardinal(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  return NAMES[Math.round(d / 45) % 8];
}
```

`src/tools/CompassUnavailable.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { useColors } from '@/theme';

export function CompassUnavailable() {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={styles.box}>
      <Text style={[styles.text, { color: colors.text }]}>{t('compass_unavailable')}</Text>
      <Button label={t('compass_learn')} onPress={() => router.push('/chapter/DirectionFinding')} />
    </View>
  );
}

const styles = StyleSheet.create({ box: { flex: 1, padding: 24, justifyContent: 'center' }, text: { fontSize: 18, textAlign: 'center', marginBottom: 16 } });
```

`src/tools/Compass.web.tsx`:

```tsx
export { CompassUnavailable as Compass } from './CompassUnavailable';
```

`src/tools/Compass.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { useColors } from '@/theme';
import { cardinal } from './cardinal';
import { CompassUnavailable } from './CompassUnavailable';

type Reading = { degrees: number; isTrue: boolean; accuracy: number };

export function Compass() {
  const { t } = useTranslation();
  const colors = useColors();
  const [reading, setReading] = useState<Reading | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let sub: { remove(): void } | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted && !cancelled) setPermissionDenied(true);
        const s = await Location.watchHeadingAsync((h) => {
          const isTrue = h.trueHeading >= 0;
          setReading({ degrees: isTrue ? h.trueHeading : h.magHeading, isTrue, accuracy: h.accuracy });
        });
        if (cancelled) s.remove();
        else sub = s;
      } catch {
        if (!cancelled) setUnavailable(true);
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  if (unavailable) return <CompassUnavailable />;

  const deg = reading?.degrees ?? 0;
  return (
    <View style={styles.box}>
      <View style={[styles.dial, { borderColor: colors.border, transform: [{ rotate: `${-deg}deg` }] }]}>
        {(['N', 'E', 'S', 'W'] as const).map((d, i) => (
          <Text key={d} style={[styles.mark, MARKS[i], { color: d === 'N' ? colors.danger : colors.text }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={[styles.needle, { backgroundColor: colors.danger }]} />
      <Text style={[styles.heading, { color: colors.text }]}>{reading ? `${Math.round(deg)}° ${cardinal(deg)}` : '…'}</Text>
      {reading && <Text style={{ color: colors.muted }}>{reading.isTrue ? t('compass_true') : t('compass_magnetic')}</Text>}
      {permissionDenied && <Text style={[styles.note, { color: colors.muted }]}>{t('compass_permission')}</Text>}
      {reading && reading.accuracy <= 1 && <Text style={[styles.note, { color: colors.danger }]}>{t('compass_calibrate')}</Text>}
      <Button variant="plain" label={t('compass_learn')} onPress={() => router.push('/chapter/DirectionFinding')} />
    </View>
  );
}

const SIZE = 260;
const MARKS = [
  { top: 8, alignSelf: 'center' as const },
  { right: 12, top: SIZE / 2 - 14 },
  { bottom: 8, alignSelf: 'center' as const },
  { left: 12, top: SIZE / 2 - 14 },
];

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dial: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3 },
  mark: { position: 'absolute', fontSize: 22, fontWeight: 'bold' },
  needle: { position: 'absolute', width: 4, height: SIZE / 2 - 30, top: '50%', marginTop: -SIZE / 2 + 30, borderRadius: 2 },
  heading: { fontSize: 36, fontWeight: 'bold', marginTop: 24 },
  note: { textAlign: 'center', marginTop: 8 },
});
```

The `needle` position is a visual detail; check it by hand in Step 4 and adjust it if it isn't centred over the dial.

`src/app/tools/compass.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { useTitle } from '@/lib/useTitle';
import { Compass } from '@/tools/Compass';

export default function CompassScreen() {
  const { t } = useTranslation();
  useTitle(t('compass'));
  return <Compass />;
}
```

- [ ] **Step 3: Run the tests**

Run: `npx jest src/tools && npx tsc --noEmit` → PASS and exit 0.

- [ ] **Step 4: Check by hand on a physical Android device**

Rotate the phone. Check that N tracks north and that the number and the cardinal name update. Deny the location permission and check that magnetic north and the explanation appear. On Web, check that the unavailable message appears.

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat(tools): compass with true/magnetic heading and web fallback"
```

---

### Task 22: Offline PWA

**Files:**
- Create: `app/src/app/+html.tsx`, `app/public/manifest.json`, `app/public/icon-192.png`, `app/public/icon-512.png`, `app/src/pwa/register.ts`, `app/src/pwa/register.web.ts`, `app/scripts/pwa.mjs`
- Modify: `app/src/app/_layout.tsx`, `app/package.json`

**Interfaces:**
- Produces: `registerServiceWorker(): void`; the npm script `export:web`, which builds `dist/` with `sw.js`.

- [ ] **Step 1: Add the icons and manifest**

```bash
mkdir -p public
cp ../android/src/main/res/mipmap-xxxhdpi/ic_launcher.png public/icon-192.png
cp ../assets/icon_512.png public/icon-512.png
```

`public/manifest.json`:

```json
{
  "name": "Survival Manual",
  "short_name": "Survival",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#121412",
  "theme_color": "#455440",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Write the HTML root and service-worker registration**

`src/app/+html.tsx`:

```tsx
import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#455440" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

`src/pwa/register.ts`:

```ts
export function registerServiceWorker() {}
```

`src/pwa/register.web.ts`:

```ts
export function registerServiceWorker() {
  if (__DEV__ || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('service worker registration failed', e));
}
```

In `src/app/_layout.tsx`, add `import { registerServiceWorker } from '@/pwa/register';` and, next to the language effect:

```tsx
useEffect(() => {
  registerServiceWorker();
}, []);
```

- [ ] **Step 3: Write `scripts/pwa.mjs` and the script**

```js
// Precache the whole static export so the manual works offline after the first visit.
import { generateSW } from 'workbox-build';

const { count, size, warnings } = await generateSW({
  globDirectory: 'dist',
  globPatterns: ['**/*.{html,js,css,json,png,jpg,jpeg,svg,ico,ttf,woff,woff2,wav}'],
  swDest: 'dist/sw.js',
  maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
  // /chapter/Water?block=3 must hit the precached /chapter/Water.html
  ignoreURLParametersMatching: [/.*/],
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
});
warnings.forEach((w) => console.warn(w));
console.log(`sw.js: precached ${count} files, ${(size / 1024 / 1024).toFixed(1)} MB`);
```

Add to `package.json` `scripts`:

`"export:web": "npm run content && expo export -p web && node scripts/pwa.mjs"`

- [ ] **Step 4: Build and check offline behaviour**

Run: `npm run export:web`
Expected: the export succeeds and `sw.js: precached N files` is printed.

Run: `ls dist/chapter | head && grep -c 'chapter/Water.html' dist/sw.js`
Expected: one `.html` file per chapter is listed, and the count is ≥ 1.

Run: `npx serve dist -l 4173`. Open http://localhost:4173 in Chrome. Then:
- In DevTools → Application, check that the manifest loads and the service worker is activated.
- Go to Network → Offline and reload `/chapter/Water?block=3`. The chapter must render.
- Check that images render too.

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat(web): installable offline PWA with precached static export"
```

---

### Task 23: Import legacy Android settings

**Files:**
- Create: `app/modules/legacy-prefs/` (local Expo module), `app/src/lib/legacyImport.ts`
- Modify: `app/src/app/_layout.tsx`
- Test: `app/src/lib/__tests__/legacyImport.test.ts`

**Interfaces:**
- Consumes: `useSettings`, `useReading`, `tocBySlug`.
- Produces:
  - Native module `LegacyPrefs.read(): { nightMode: string | null; fontSize: string | null; lastUrl: string | null } | null` (Android only)
  - `readLegacyPrefs()`, which returns `null` on iOS/Web or on error
  - `mapLegacy(raw): { theme?: ThemeMode; fontStep?: number; lastSlug?: string }`
  - `importLegacyOnce(read?: () => RawLegacyPrefs | null): void`

- [ ] **Step 1: Write the failing tests**

```ts
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
```

Run → FAIL.

- [ ] **Step 2: Create the local Android module**

Run:

```bash
npx create-expo-module@latest legacy-prefs --local --name LegacyPrefs --package expo.modules.legacyprefs --platform android --features Function --description "Reads legacy Survival Manual preferences" --license MIT --module-version 0.1.0
find modules/legacy-prefs -type f | sort
```

If the command still prompts, answer with the same values. Keep `expo-module.config.json` and `android/build.gradle`. Make sure `expo-module.config.json` lists only Android and names `expo.modules.legacyprefs.LegacyPrefsModule`. Delete any generated iOS, web-view and example `src/` files.

Replace the generated Kotlin module, `modules/legacy-prefs/android/src/main/java/expo/modules/legacyprefs/LegacyPrefsModule.kt`:

```kotlin
package expo.modules.legacyprefs

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Reads the preferences written by the legacy Kotlin app (same package, so same data dir).
class LegacyPrefsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LegacyPrefs")

    Function("read") {
      val ctx = appContext.reactContext ?: return@Function null
      val defaults = ctx.getSharedPreferences("${ctx.packageName}_preferences", Context.MODE_PRIVATE)
      val state = ctx.getSharedPreferences("State", Context.MODE_PRIVATE) // Kotpref file name = object name
      if (defaults.all.isEmpty() && state.all.isEmpty()) return@Function null
      mapOf(
        "nightMode" to defaults.getString("NIGHTMODE", null),
        "fontSize" to defaults.getString("FONTSIZETOGGLE", null),
        "lastUrl" to state.getString("lastVisitedURL", null),
      )
    }
  }
}
```

Replace `modules/legacy-prefs/index.ts`:

```ts
import { requireOptionalNativeModule } from 'expo';

export type RawLegacyPrefs = { nightMode: string | null; fontSize: string | null; lastUrl: string | null };

const native = requireOptionalNativeModule<{ read(): RawLegacyPrefs | null }>('LegacyPrefs');

export function readLegacyPrefs(): RawLegacyPrefs | null {
  try {
    return native?.read() ?? null;
  } catch (e) {
    console.warn('legacy prefs unreadable', e);
    return null;
  }
}
```

If `requireOptionalNativeModule` isn't exported from `expo` in SDK 56, import it from `expo-modules-core`; check Context7 to confirm.

- [ ] **Step 3: Implement `src/lib/legacyImport.ts`**

```ts
import { readLegacyPrefs, type RawLegacyPrefs } from '../../modules/legacy-prefs';
import { useReading } from '@/store/reading';
import { useSettings, type SettingsValues, type ThemeMode } from '@/store/settings';
import { tocBySlug } from '@/toc';

export type LegacyImport = { theme?: ThemeMode; fontStep?: number; lastSlug?: string };

const THEMES: Record<string, ThemeMode> = { day: 'day', night: 'night', darknight: 'amoled' };

export function mapLegacy(raw: RawLegacyPrefs | null): LegacyImport {
  if (!raw) return {};
  const out: LegacyImport = {};
  if (raw.nightMode) out.theme = THEMES[raw.nightMode] ?? 'system';
  if (raw.fontSize != null && /^[0-4]$/.test(raw.fontSize)) out.fontStep = Number(raw.fontSize);
  const slug = raw.lastUrl?.split('#')[0];
  if (slug && tocBySlug.has(slug)) out.lastSlug = slug;
  return out;
}

export function importLegacyOnce(read: () => RawLegacyPrefs | null = readLegacyPrefs) {
  const settings = useSettings.getState();
  if (settings.legacyImported) return;
  const m = mapLegacy(read());
  const patch: Partial<SettingsValues> = { legacyImported: true };
  if (m.theme) patch.theme = m.theme;
  if (m.fontStep !== undefined) patch.fontStep = m.fontStep;
  settings.set(patch);
  if (m.lastSlug) useReading.getState().setLast(m.lastSlug, 0);
}
```

- [ ] **Step 4: Run the import before the first render**

In `src/app/_layout.tsx`, add `import { importLegacyOnce } from '@/lib/legacyImport';` and `useState` to the React import. Then replace `if (!hydrated) return null;` with:

```tsx
const [ready, setReady] = useState(false);
useEffect(() => {
  if (!hydrated) return;
  importLegacyOnce();
  setReady(true);
}, [hydrated]);

if (!ready) return null;
```

Hooks must stay above the early return: put the `useState` and `useEffect` before the `return null`.

- [ ] **Step 5: Run the tests**

Run: `npx jest src/lib && npx tsc --noEmit` → PASS and exit 0.

- [ ] **Step 6: Check the migration on an emulator**

```bash
npm run android            # installs the debug build as org.ligi.survivalmanual
adb shell pm clear org.ligi.survivalmanual
mkdir -p /tmp/legacy && cat > /tmp/legacy/p.xml <<'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="NIGHTMODE">darknight</string>
    <string name="FONTSIZETOGGLE">4</string>
</map>
EOF
cat > /tmp/legacy/s.xml <<'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="lastVisitedURL">Fire</string>
</map>
EOF
adb push /tmp/legacy/p.xml /tmp/legacy/s.xml /data/local/tmp/
adb shell run-as org.ligi.survivalmanual mkdir -p shared_prefs
adb shell run-as org.ligi.survivalmanual cp /data/local/tmp/p.xml shared_prefs/org.ligi.survivalmanual_preferences.xml
adb shell run-as org.ligi.survivalmanual cp /data/local/tmp/s.xml shared_prefs/State.xml
adb shell monkey -p org.ligi.survivalmanual 1
```

Expected: the app opens on Fire with a true-black theme and huge text. Kill the app and change the theme in Settings, then reopen it. The import must not run again.

- [ ] **Step 7: Commit**

```bash
git add app && git commit -m "feat(android): import theme, text size and last chapter from the legacy app"
```

---

### Task 24: Release configuration, end-to-end flow, README

**Files:**
- Create: `app/eas.json`, `app/.maestro/search-bookmark.yaml`
- Modify: `app/package.json`, `README.md`

**Interfaces:**
- Produces: EAS profiles `preview` and `production`; build hooks; one Maestro flow; release documentation.

- [ ] **Step 1: Write `eas.json`**

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "local" },
  "build": {
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": {}
  },
  "submit": { "production": {} }
}
```

- [ ] **Step 2: Add the EAS hooks to `package.json` `scripts`**

```json
"eas-build-pre-install": "cd .. && git submodule update --init --depth 1",
"eas-build-post-install": "npm run content"
```

- [ ] **Step 3: Write the Maestro flow**

`app/.maestro/search-bookmark.yaml`:

```yaml
appId: org.ligi.survivalmanual
---
- launchApp:
    clearState: true
- openLink: survivalmanual://search
- tapOn:
    id: search-input
- inputText: fire
- tapOn:
    id: search-result-0-0
- assertVisible:
    id: find-status
- tapOn: Add bookmark
- openLink: survivalmanual://bookmarks
- assertVisible: Fire
```

With Maestro installed and an emulator running a `preview` build or `npm run android`, run: `maestro test .maestro/search-bookmark.yaml` → all steps pass. If Maestro isn't installed, say so in the task report and leave this step unchecked; don't install global tools without asking the user.

- [ ] **Step 4: Check the full configuration**

Run: `npx expo config --type public | head -40`
Expected: `android.package` and `ios.bundleIdentifier` are `org.ligi.survivalmanual`, and `android.versionCode` is 600.

Run: `npx expo-doctor`. Fix any dependency-version mismatch it reports with `npx expo install --fix`.

Run: `npx tsc --noEmit && npx expo lint && npm run test:content && npx jest` → all exit 0.

- [ ] **Step 5: Document releasing in `README.md`**

Insert this after the `## About` section:

```markdown
## Expo app (v6)

The `app/` folder holds the React Native + Expo rewrite that ships to Android, iOS and the web from one codebase. The Kotlin app in `android/` stays in the repo until the Expo app has fully replaced it on Google Play, and it remains the version published on F-Droid.

    git submodule update --init   # chapter content
    cd app && npm install
    npm start                     # Expo dev server (builds content first)
    npm test                      # unit + component tests
    npm run export:web            # offline PWA in app/dist

### Releasing

1. `npx eas-cli login`, then `npx eas-cli init` once to link the project.
2. Android: upload the existing Play upload keystore with `npx eas-cli credentials` so updates install over the current app. Bump `android.versionCode` in `app/app.json`.
3. `npx eas-cli build --profile production --platform all`
4. `npx eas-cli submit --platform android` (internal track first) and `npx eas-cli submit --platform ios`.
5. iOS needs a 1024×1024 app icon at `app/assets/icon.png` before App Store submission (the current one is 512×512).
```

The README uses indented code blocks here to avoid nested fences inside this plan; using fenced blocks in the real README is fine.

- [ ] **Step 6: Commit**

```bash
cd /home/guido/DevPessoal/SurvivalManual
git add app README.md
git commit -m "chore(release): EAS profiles, submodule build hooks, Maestro flow and release docs"
```

- [ ] **Step 7: Hand off the manual release steps**

Tell the user what still needs their accounts, because these steps can't be done from the repo:
- EAS login and project init
- uploading the Play keystore
- creating the App Store Connect app
- a 1024 px icon
- running the production builds and submissions
- deleting `android/` once the Play rollout has been stable for 2 weeks (spec §12.6)
