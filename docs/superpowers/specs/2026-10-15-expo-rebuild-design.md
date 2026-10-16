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
  app/                     new Expo project (TypeScript, Expo SDK 56)
    app/                   Expo Router routes
      _layout.tsx          Drawer + ThemeProvider + i18n provider
      index.tsx            redirects to last-read chapter (fallback: Introduction)
      chapter/[slug].tsx   reader; query params ?anchor=<blockId>&q=<term>
      search.tsx
      bookmarks.tsx
      recents.tsx
      settings.tsx
      tools/checklists/index.tsx, tools/checklists/[id].tsx
      tools/emergency-card.tsx
      tools/sos.tsx
      tools/compass.tsx
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
    plugins/with-legacy-prefs.js Expo config plugin for settings migration
```

Content source remains the `SurvivalManual.wiki` git submodule at `android/src/main/assets/md`; it moves to `app/content/md` at cutover.

## 3. Content pipeline (`scripts/build-content.ts`)

Runs before `start`, `export`, `test` and EAS builds (npm `pre*` scripts + `eas-build-pre-install` hook).

1. Read every slug in `src/toc.ts`; load `<slug>.md` from the submodule.
2. Parse with `unified` + `remark-parse` + `remark-gfm`.
3. Normalize: keep supported node types (heading, paragraph, text, emphasis, strong, link, list, listItem, blockquote, table, tableRow, tableCell, image, code, inlineCode, thematicBreak, break); unsupported nodes are dropped with a warning. Strip `position` data.
4. Assign each top-level block a stable id `"<slug>#<n>"` and each heading an anchor slug (GitHub-style) so wiki links `Chapter#heading` resolve.
5. Write `chapters/<slug>.json`: `{ slug, blocks: Block[], anchors: Record<anchor, blockIndex> }`.
6. Build search docs, one per section (heading + following blocks until next heading of same or higher level): `{ id: blockId, slug, heading, body }`. Index with MiniSearch (`fields: [heading, body]`, `storeFields: [slug, heading]`) and write `MiniSearch.toJSON` output.
7. Write `images.ts`: `export const images = { "x.png": require("../../content/md/x.png"), … }` for every referenced image. The legacy `med_open_airway.vd` vector becomes `med_open_airway.svg` rendered via `react-native-svg`.
8. Write a chapter loader map `chapters.ts` with lazy `require` per slug.

**Fail the build** when: a toc slug has no markdown file; an image reference has no file; an internal link targets an unknown slug or anchor.

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
- Scroll restore: persist `{ slug, blockIndex, offsetInBlock }` on scroll end (debounced 500 ms); restore on open. `index.tsx` redirects to the last chapter.
- Search jump: with `anchor` + `q`, scroll to the block, highlight all matches in the chapter, show a "n of m" bar with prev/next.
- Keep-awake via `expo-keep-awake` while the reader is focused, unless disabled in settings.
- Recents: on open, push slug to front of the recents list (dedupe, max 10).

### Image viewer
Pinch-zoom, pan and double-tap zoom with `react-native-gesture-handler` + `react-native-reanimated`. Close via button or swipe-down.

## 6. Search

- `MiniSearch.loadJSON` once, lazily on first search, cached in memory.
- Options: `prefix: true`, `fuzzy: 0.2`, `boost: { heading: 2 }`, `combineWith: 'AND'` falling back to `'OR'` when AND has no results.
- Results grouped by chapter (chapter title, then section headings with an excerpt of about 160 characters around the first match, highlighted).
- `src/search/highlight.ts`: `splitHighlights(text, terms): { text, match: boolean }[]` — case- and diacritic-insensitive; pure function, unit-tested. Replaces `Hightlight.kt` / `TextSplitter.kt`.

## 7. State and persistence

Zustand stores with `persist` middleware on `expo-sqlite/kv-store` (works on iOS, Android, Web). Each store has `version` + `migrate`.

| Store | Shape |
|---|---|
| `settings` | `theme: 'system'|'day'|'night'|'amoled'`, `fontStep: 0–4`, `keepAwake: boolean`, `ttsRate: number`, `ttsVoice?: string`, `language?: string` |
| `reading` | `last: { slug, blockIndex, offsetInBlock }`, `recents: string[]` |
| `bookmarks` | `{ id, slug, blockId, label?, createdAt }[]` |
| `checklists` | `{ id, title, templateId?, items: { id, text, done }[] }[]` |
| `emergency` | `{ name, bloodType, allergies, medications, conditions, contacts: { name, phone }[], notes }` |

A load failure resets that store to defaults and logs a warning; it never crashes the app.

## 8. Theming and i18n

- Theme tokens in `src/theme.ts` for four modes. AMOLED uses `#000` background. Colors taken from the existing `values/colors.xml` / `values-night`.
- i18next + `expo-localization`. `scripts/convert-strings.ts` converts every `android/src/main/res/values*/strings.xml` to `src/i18n/locales/<lang>.json` once; the output is committed. New strings get English and are left for translators. Chapter content stays English (the wiki has English only).

## 9. Tools

### Checklists
Templates in `src/tools/checklist-templates.ts`: Survival kit (from Kits), 72-hour plan (Planning), Medical kit (Medicine). The user creates a list from a template or a blank list, then adds, edits, deletes, ticks, resets or deletes the whole list.

### Emergency card
Form with the fields in §7. Stored on the device only; the screen states this. A "Show to rescuer" mode displays it in large high-contrast text and keeps the screen on.

### SOS / Morse
- `src/tools/morse.ts`: `encode(text) → string` and `toTimeline(code, unitMs) → { on: boolean, ms: number }[]` using standard timing (dot 1, dash 3, gap within a letter 1, between letters 3, between words 7). Unit-tested.
- Speed: 5–20 WPM (`unitMs = 1200 / wpm`).
- Outputs, any combination: torch (native, `expo-camera` `enableTorch`, needs camera permission), full-screen strobe (all platforms), tone (`expo-audio`, short generated sine sample). Presets: SOS, loop toggle.
- No torch or permission denied → torch option disabled with an explanation.

### Compass
- Native: `Location.watchHeadingAsync` (true heading when available, else magnetic), with a calibration hint when accuracy is low. Links to the DirectionFinding chapter.
- Web (`compass.web.tsx`): message that it isn't available, plus the chapter link.

### Read-aloud
`expo-speech` speaks blocks one after another starting at the first visible block; the current block is highlighted and auto-scrolled into view. Play, pause and stop controls, plus rate from settings. Stops when you leave the screen. On Web it uses the browser's SpeechSynthesis through the same API.

## 10. Web / PWA

- `app.json`: `web.output: "static"`, `web.bundler: "metro"`.
- After `expo export -p web`, a `workbox-build` `generateSW` step precaches everything in `dist/` (JS, chapter JSON, images); `manifest.json` with icons from existing launcher assets. The service worker is registered in a web-only module.
- Hosting is out of scope; GitHub Pages is the default target.

## 11. Testing

- **Jest (jest-expo):** content script on a fixture `__fixtures__/md/` (snapshot output + each failure rule); `splitHighlights`; search ranking (fixture: "water purification" → Water first); `morse.encode` / `toTimeline`; store migrations.
- **React Native Testing Library:** renderer (one test per node type); reader scrolls to the anchor and highlights; checklist tick persists; bookmark toggle.
- **Maestro** (one flow, run manually or in EAS workflows): launch → search "fire" → open the first result → highlight visible → bookmark → appears in Bookmarks.
- **CI:** new `.github/workflows/expo.yml` (checkout with submodules, npm ci, build-content, `tsc --noEmit`, eslint, jest). The existing Android workflow remains until cutover.

## 12. Release and cutover

1. EAS Build profiles: `preview` (internal APK / ad-hoc), `production`.
2. Android: package `org.ligi.survivalmanual`, existing upload keystore uploaded to EAS credentials, `versionCode` 600+. Play internal testing track → production.
3. iOS: new bundle ID `org.ligi.survivalmanual`; App Store Connect app record; `eas submit`.
4. Settings migration: `plugins/with-legacy-prefs.js` adds a small native module (Android) that reads, once on first launch, the legacy default SharedPreferences keys `NIGHTMODE` (`day`/`night`/`darknight`/`system`, or missing/`auto`) and `FONTSIZETOGGLE` (`"0"`–`"4"` → `fontStep`), plus `lastVisitedURL` from the Kotpref `State` prefs file. Values are mapped into the stores (`day` → `day`, `night` → `night`, `darknight` → `amoled`, anything else → `system`), then a migration-done flag is set. Exposed to JS as `getLegacyPrefs(): Promise<{ nightMode?, fontStep?, lastUrl? } | null>`; returns `null` on iOS/Web.
5. README: new badges/instructions; note that F-Droid stays on the legacy 5.x build.
6. After the Play production rollout reaches 100% with no regressions for 2 weeks, delete `android/` and the Gradle files, and move the submodule to `app/content/md`.

## 13. Out of scope

Chapter content translation, accounts/sync, offline maps, OTA content updates (EAS Update), analytics/ads, re-enabling markdown editing, web hosting setup.
