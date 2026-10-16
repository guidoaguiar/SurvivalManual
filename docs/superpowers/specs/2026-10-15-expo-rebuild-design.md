# Survival Manual — Expo Rebuild Design

Date: 2026-10-15 · Status: Draft for review

## 1. Intent

Rebuild the Survival Manual app (currently ~950 lines of Kotlin, Android-only) in React Native + Expo so one codebase ships to **iOS, Android and Web**, fully offline once installed. Release 1 reaches feature parity with the current app (minus the already-disabled edit mode) and adds bookmarks, recents, improved search, checklists, an emergency info card, SOS/Morse signaling, a compass, read-aloud, keep-awake and an AMOLED theme.

### Decisions made
- Platforms: iOS + Android + Web (PWA).
- F-Droid is dropped for the new app; EAS Build/Submit and non-FOSS libraries are allowed. The Kotlin app stays frozen on F-Droid.
- One spec covers everything (no sub-project split).
- Content rendering: build-time markdown AST + custom native renderer (Approach A).

### Success criteria
1. All chapters and appendices in `NavigationDefinitions.kt` render on iOS, Android and Web with images, tables, lists, quotes and internal links working.
2. Works with networking disabled after install (native) or after first visit (web).
3. A search for "water purification" lists the Water chapter first, opens at the matching section, and highlights every match.
4. Existing Play Store users update in place (same package ID, same signing key) and keep their last chapter, theme and font size.
5. CI is green: content build, typecheck, lint, Jest.

## 2. Project layout

```
SurvivalManual/
  android/                 existing Kotlin app (untouched until cutover, then deleted)
  app/                     new Expo project (TypeScript, Expo SDK 57)
    src/app/               Expo Router routes
      _layout.tsx          Drawer + ThemeProvider + i18n provider
      index.tsx            redirects to last-read chapter (fallback: Introduction)
      chapter/[slug].tsx   reader; query params ?anchor=<blockId>&q=<term>
      search.tsx
      bookmarks.tsx
      recents.tsx
      settings.tsx
      tools/checklists.tsx, tools/checklist.tsx (?id=)
      tools/emergency-card.tsx
      tools/sos.tsx
      tools/compass.tsx    (uses src/tools/Compass(.web).tsx)
      image/[name].tsx     full-screen zoom modal
    src/content/           GENERATED, gitignored
      chapters/<slug>.json
      search-index.json
      images.ts
    src/toc.ts             chapter list (port of NavigationDefinitions.kt)
    src/render/            AST → React Native renderer
    src/search/            MiniSearch wrapper + highlight splitter
    src/store/             Zustand stores
    src/tools/             morse.ts, checklist templates
    src/i18n/              i18next setup + locales/<lang>.json
    scripts/build-content.ts
    scripts/convert-strings.ts   one-off strings.xml → JSON
    modules/legacy-prefs/    local Expo module (Android) for settings migration
```

Content source remains the `SurvivalManual.wiki` git submodule at `android/src/main/assets/md`; it moves to `app/content/md` at cutover.

## 3. Content pipeline (`scripts/build-content.ts`)

Runs before `start`, `export`, `test` and EAS builds (npm `pre*` scripts + `eas-build-pre-install` hook).

1. Read every slug in `src/toc.ts`; load `<slug>.md` from the submodule.
2. Parse with `unified` + `remark-parse` + `remark-gfm` → `remark-rehype` (`allowDangerousHtml`) → `rehype-raw` → `rehype-slug`. The wiki contains raw HTML (153 `<a name="figX-Y">` anchors, HTML tables/lists in Fire, Animals, Food and Tools, plus `<font>`, `<center>`, `<sub>`, `<sup>`), so the HTML tree (hast) is the single input to the converter.
3. Convert hast → app `Block[]` (see `src/types/content.ts`): known elements map to blocks/inlines; unknown wrapper elements (`div`, `center`, `font`, `span`, `sub`, `sup`, `tbody`, `thead`) are unwrapped. Paragraphs made only of images become image blocks.
4. Anchors: every `id` (headings, via rehype-slug) and every `<a name>` is mapped to the index of the top-level block that contains it (or the next one, if the anchor sits in an otherwise empty element).
5. Write `chapters/<slug>.json`: `{ slug, blocks: Block[], anchors: Record<anchor, blockIndex> }`.
6. Build search docs, one per section (a heading plus the blocks after it until the next heading): `{ id: "<slug>#<blockIndex>", slug, block, heading, body }`. Index with MiniSearch (`fields: [heading, body]`, `storeFields: [slug, heading]`) and write `MiniSearch.toJSON` output.
7. Copy every referenced image into `assets/content/` (gitignored) and write `images.ts`: `export const images = { "x.png": require("../../assets/content/x.png"), … }`. (No wiki page uses the legacy `.vd` vector format, so it is dropped.)
8. Write a chapter loader map `chapters.ts` with lazy `require` per slug.

Only slugs listed in `src/toc.ts` are built. The wiki's unlisted drafts (Home, Weapons, CarRepair, BlackoutDriving, BasicMechanicalSkills) are excluded, including from search.

**Fail the build** when: a toc slug has no markdown file; an image reference has no file; an internal link targets an unknown slug. A link to an unknown anchor is a build warning (the chapter opens at the top). Links to slugs in `IGNORED_LINKS` (affiliate pages that don't exist in the wiki: `LifeStraw`, `SolarUSBCharger`, `OHTMultiTool`, `Audible`, `CampStoveUSB`, `HandCrankUSB`, `CarUSBCharger`, `PandaDubLionsDen`, `TreadMultiTool`) render as plain text.

## 4. Navigation

- Expo Router `Drawer` (`expo-router/drawer`). Permanent drawer when window width ≥ 900 (tablet/web), otherwise slide-in.
- Drawer order: Emergency card (only when filled in) · main chapters with Material icons (same mapping as current app) · collapsible "Appendix" group · Bookmarks · Recents · Tools (Checklists, SOS, Compass, Emergency card) · Settings. `isListed: false` entries (TranslatorNotes) are routable but hidden.
- Markdown links: internal (`Slug` or `Slug#anchor`) → `router.push('/chapter/Slug?anchor=…')`; external → `Linking.openURL`.
- Unknown slug → route error boundary: "Chapter not found" + back to contents.

## 5. Reader (`chapter/[slug].tsx`)

- `FlatList` over top-level blocks (`windowSize` tuned, `getItemLayout` not used — variable heights; `onScrollToIndexFailed` retry).
- `src/render/` maps each node type to RN components; inline children compose nested `Text`. Tables render in a horizontal `ScrollView`. Blockquotes use a left-bar style (port of `CustomQuoteSpan`). Images are tappable → `image/[name]`.
- Font scale: from settings, five steps matching the legacy formula `8 + 4n` sp (n = 0..4, default 2 → 16).
- Header actions: bookmark toggle, read-aloud play/pause, in-chapter find.
- Scroll restore: persist `{ slug, blockIndex }` (first visible block, same as the legacy app) whenever it changes; restore on open. `index.tsx` redirects to the last chapter.
- Search jump: route params `block` (index) or `anchor` (named anchor) plus `q`. Scroll to the block, highlight every match in the chapter, and show an "n of m" bar that steps through the blocks containing matches.
- Keep-awake via `expo-keep-awake` while the reader is focused, unless disabled in settings.
- Recents: on open, push slug to front of the recents list (dedupe, max 10).

### Image viewer
Pinch-zoom, pan and double-tap zoom with `react-native-gesture-handler` + `react-native-reanimated`. Close via the header button.

## 6. Search

- `MiniSearch.loadJSON` once, lazily on first search, cached in memory.
- Options: `prefix: true`, `fuzzy: 0.2`, `boost: { heading: 2 }`, `combineWith: 'AND'` falling back to `'OR'` when AND has no results.
- Results grouped by chapter (chapter title, then section headings with an excerpt of about 160 characters around the first match, highlighted).
- `src/search/highlight.ts`: `splitHighlights(text, terms): { text, match: boolean }[]` — case- and diacritic-insensitive; pure function, unit-tested. Replaces `Hightlight.kt` / `TextSplitter.kt`.

## 7. State and persistence

Zustand stores with `persist` middleware. Storage: `expo-sqlite/kv-store` on iOS/Android; `localStorage` on Web (`storage.web.ts`), because expo-sqlite on Web needs COOP/COEP headers that static hosts such as GitHub Pages can't set. Each store has `version` + `migrate`.

| Store | Shape |
|---|---|
| `settings` | `theme: 'system'|'day'|'night'|'amoled'`, `fontStep: 0–4`, `keepAwake: boolean`, `ttsRate: number`, `language?: string`, `legacyImported: boolean` |
| `reading` | `last: { slug, blockIndex }`, `recents: string[]` |
| `bookmarks` | `{ id, slug, blockIndex, label?, createdAt }[]` (keyed by block index; positions are clamped when content changes) |
| `checklists` | `{ id, title, templateId?, items: { id, text, done }[] }[]` |
| `emergency` | `{ name, bloodType, allergies, medications, conditions, contacts: { name, phone }[], notes }` |

A load failure resets that store to defaults and logs a warning; it never crashes the app.

## 8. Theming and i18n

- Theme tokens in `src/theme.ts` for four modes. AMOLED uses `#000` background. Colors taken from the existing `values/colors.xml` / `values-night`.
- i18next + `expo-localization`. `scripts/convert-strings.ts` converts `android/src/main/res/values*/strings.xml` (en, fr) to `src/i18n/locales/legacy.<lang>.json`; the output is committed. New UI strings live in hand-written `src/i18n/locales/<lang>.json` (English only at first), merged with the legacy file, so re-running the script never overwrites them. Chapter content stays English (the wiki has English only).

## 9. Tools

### Checklists
Templates in `src/tools/checklist-templates.ts`: Survival kit (from Kits), 72-hour plan (Planning), Medical kit (Medicine). The user creates a list from a template or a blank list, then adds, edits, deletes, ticks, resets or deletes the whole list.

### Emergency card
Form with the fields in §7. Stored on the device only; the screen states this. A "Show to rescuer" mode displays it in large high-contrast text and keeps the screen on.

### SOS / Morse
- `src/tools/morse.ts`: `encode(text) → string` and `toTimeline(code, unitMs) → { on: boolean, ms: number }[]` using standard timing (dot 1, dash 3, gap within a letter 1, between letters 3, between words 7). Unit-tested.
- Speed: 5–20 WPM (`unitMs = 1200 / wpm`).
- Outputs, any combination: torch (native only; a hidden 1×1 `CameraView` with `enableTorch`, needs camera permission), full-screen strobe (all platforms), tone (`expo-audio`, looping 600 Hz `beep.wav` generated once by a script and committed). Presets: SOS, loop toggle.
- No torch or permission denied → torch option disabled with an explanation.

### Compass
- Native: `Location.watchHeadingAsync` (true heading when location permission is granted, else its magnetic heading), with a calibration hint when accuracy is low. Links to the DirectionFinding chapter.
- Web (`src/tools/Compass.web.tsx`): message that it isn't available, plus the chapter link.

### Read-aloud
`expo-speech` speaks blocks one after another starting at the first visible block; the current block is highlighted and auto-scrolled into view. Play, pause and stop controls, plus rate from settings. Stops when you leave the screen. On Web it uses the browser's SpeechSynthesis through the same API.

## 10. Web / PWA

- `app.json`: `web.output: "static"`, `web.bundler: "metro"`.
- Dynamic routes (`chapter/[slug]`, `image/[name]`) export `generateStaticParams` so every page is pre-rendered. Checklists use a query parameter (`/tools/checklist?id=…`), not a dynamic segment.
- After `expo export -p web`, a `workbox-build` `generateSW` step precaches everything in `dist/` (JS, chapter JSON, images); `manifest.json` with icons from existing launcher assets. The service worker is registered in a web-only module.
- Hosting is out of scope; GitHub Pages is the default target.

## 11. Testing

- **Jest (jest-expo):** content script on a fixture `__fixtures__/md/` (snapshot output + each failure rule); `splitHighlights`; search ranking (fixture: "water purification" → Water first); `morse.encode` / `toTimeline`; store migrations.
- **React Native Testing Library:** renderer (one test per node type); reader scrolls to the anchor and highlights; checklist tick persists; bookmark toggle.
- **Maestro** (one flow, run manually or in EAS workflows): launch → search "fire" → open the first result → highlight visible → bookmark → appears in Bookmarks.
- **CI:** new `.github/workflows/expo.yml` (checkout with submodules, npm ci, build-content, `tsc --noEmit`, eslint, jest). The existing Android workflow remains until cutover.

## 12. Release and cutover

1. EAS Build profiles: `preview` (internal APK / ad-hoc), `production`.
2. Android: package `com.midnightcoder.survivalmanual` (this project is a fork, so it ships as a new listing with its own EAS-managed keystore; the original `org.ligi.survivalmanual` listing and keystore belong to the original author).
3. iOS: bundle ID `com.midnightcoder.survivalmanual`; App Store Connect app record; `eas submit`.
4. Settings migration: a local Expo module `modules/legacy-prefs` (Android Kotlin) that reads, once on first launch, the legacy default SharedPreferences keys `NIGHTMODE` (`day`/`night`/`darknight`/`system`, or missing/`auto`) and `FONTSIZETOGGLE` (`"0"`–`"4"` → `fontStep`), plus `lastVisitedURL` from the Kotpref `State` prefs file. Values are mapped into the stores (`day` → `day`, `night` → `night`, `darknight` → `amoled`, anything else → `system`), then a migration-done flag is set. Exposed to JS as `getLegacyPrefs(): Promise<{ nightMode?, fontStep?, lastUrl? } | null>`; returns `null` on iOS/Web.
5. README: new badges/instructions; note that F-Droid stays on the legacy 5.x build.
6. After the Play production rollout reaches 100% with no regressions for 2 weeks, delete `android/` and the Gradle files, and move the submodule to `app/content/md`.

## 13. Out of scope

Chapter content translation, accounts/sync, offline maps, OTA content updates (EAS Update), analytics/ads, re-enabling markdown editing, web hosting setup.
