# Survival Manual

![](assets/banner.png)

An offline survival guide for **Android, iOS and the web**, based on the public domain US Army Survival Field Manual [FM 3-05.70 (FM 21-76)](https://fas.org/irp/doddir/army/fm3-05-70.pdf). Once installed it needs no connection at all, which matters most when everything else has failed.

This project is a fork of [ligi/SurvivalManual](https://github.com/ligi/SurvivalManual), rebuilt from scratch in React Native + Expo. It keeps the original's offline-first spirit and content, and adds:

- **One codebase for Android, iOS and an installable offline web app (PWA)**
- **Better search**: fuzzy, accent-insensitive, jumps to the exact section and highlights every match
- **Bookmarks and recently read** chapters, plus resume where you left off
- **Checklists**: survival kit, 72-hour plan and medical kit templates, or your own
- **Emergency card**: medical info and contacts, stored only on the device, with a large high-contrast "show to rescuer" view
- **SOS / Morse signalling** by flashlight, screen strobe or tone
- **Compass** with true and magnetic north
- **Read aloud**, keep-screen-awake while reading, and a true-black AMOLED theme

The chapter content lives in [this project's wiki](https://github.com/guidoaguiar/SurvivalManual/wiki), so it is easy to improve.

## Development

```
git submodule update --init   # chapter content (the wiki)
cd app && npm install
npm start                     # Expo dev server (builds content first)
npm test                      # unit + component tests
npm run export:web            # offline PWA in app/dist
```

The `app/` folder is the Expo app (Expo SDK 57). The `android/` folder holds the original Kotlin app this project was forked from; it is kept for reference and is not part of the build.

### Releasing

The app ID is `com.midnightcoder.survivalmanual`.

1. `npx eas-cli login`, then `npx eas-cli init` once to link the project.
2. `npx eas-cli build --profile production --platform all`. On the first build, let EAS generate the Android keystore and iOS credentials.
3. `npx eas-cli submit --platform android` (internal track first) and `npx eas-cli submit --platform ios`.
4. iOS needs a 1024×1024 app icon at `app/assets/icon.png` before App Store submission (the current one is 512×512).

For each release, bump `version` and `android.versionCode` in `app/app.json`.

## Contributing

Pull requests are welcome, for both the app and the content. To improve a chapter, edit the [wiki](https://github.com/guidoaguiar/SurvivalManual/wiki).

### Translating

The app's interface can be translated: menus, buttons, settings, tool screens and chapter titles. The chapter text itself comes from the wiki and is English only for now.

Translations are plain JSON files in [`app/src/i18n/locales/`](app/src/i18n/locales), sent as a normal pull request. English is the reference:

| File | Contains |
|---|---|
| `legacy.en.json` | Chapter titles and the original app's strings |
| `en.json` | Strings for the newer features: search, bookmarks, checklists, emergency card, SOS, compass and so on |

When translating:

- Only change the **values**. Keep every key (the part before the `:`) exactly as it is.
- Keep placeholders such as `{{current}}`, `{{q}}` or `{{wpm}}` unchanged. They are filled in by the app.
- Anything you leave out falls back to English, so a partial translation is fine.

**Improving an existing language (French).** `legacy.fr.json` already covers the original strings. To translate the newer ones, create `fr.json` with the keys from `en.json`, then in [`app/src/i18n/index.ts`](app/src/i18n/index.ts) import it and change the French entry to `fr: { translation: { ...legacyFr, ...fr } }`.

**Adding a new language**, e.g. Portuguese (`pt`):

1. Copy `legacy.en.json` to `legacy.pt.json` and `en.json` to `pt.json`, then translate the values.
2. In [`app/src/i18n/index.ts`](app/src/i18n/index.ts), add `'pt'` to `languages`, import both files, and add `pt: { translation: { ...legacyPt, ...pt } }` to `resources`.
3. In [`app/src/app/settings.tsx`](app/src/app/settings.tsx), add `['pt', 'Português']` to the language options.
4. Check it: run `npm test` in `app/`, then `npm start`, open **Settings → Language** and pick your language.

You don't need to be a developer to help. If editing code is not for you, open an issue with your translated JSON file attached and we'll wire it in.

## Credits

Survival Manual was created by [ligi](https://github.com/ligi) and its contributors, who built the original app and the wiki content this project is based on. Thank you! See the in-app Credits chapter for the full list.

Maintained by [Guido Aguiar](https://github.com/guidoaguiar).

## License

GPLv3. See [COPYING](COPYING).

THIS SOFTWARE IS PROVIDED "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING,
BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
