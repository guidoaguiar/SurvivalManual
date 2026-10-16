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

The `app/` folder is the Expo app (Expo SDK 57). The `wiki/` folder is a git submodule with the chapter content (this project's GitHub wiki); `npm run content` turns it into the app's chapters, images and search index.

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

Both the app's interface and the guide's chapters can be translated. Partial translations are fine: anything not translated yet shows in English.

Language codes follow the usual tags: `fr`, `de`, `pt-BR`, `es-MX`, …

#### The interface

Each language is one JSON file in [`app/src/i18n/locales/`](app/src/i18n/locales), named after its code (`en.json`, `fr.json`, `pt-BR.json`). [`en.json`](app/src/i18n/locales/en.json) is the reference and has every string, including the chapter titles.

- Only change the **values**. Keep every key (the part before the `:`) exactly as it is.
- Keep placeholders such as `{{current}}`, `{{q}}` or `{{wpm}}` unchanged. They are filled in by the app.
- Set `language_name` to your language's own name (e.g. `"Deutsch"`). It is shown in Settings → Language.

To add a language, copy `en.json` to `<code>.json` and translate it. That's all: the app picks the file up automatically.

#### The guide's chapters

Chapters live in the [wiki](https://github.com/guidoaguiar/SurvivalManual/wiki), which is the `wiki/` submodule in this repo. English chapters sit at the top of the wiki. Translations go in a folder named after the language code, with **the same file names**:

```
wiki/Water.md          English
wiki/pt-BR/Water.md    Brazilian Portuguese
```

When translating a chapter:

- **Keep figure anchors and images exactly as they are.** Lines such as `<a name="fig7-4"></a>` and `![Figure 7-4. …](fig07-04.png)` must stay. You can translate the caption text, but don't change the file name. Images are shared by every language.
- **Keep links to other chapters unchanged**, e.g. `[comida](Food)`. The part in parentheses is the English chapter name.
- **Links to a heading inside a chapter** use that heading's anchor in your language. The anchor is the heading in lowercase, with punctuation removed and spaces replaced by `-`. For example, `## Purificação da água` becomes `#purificação-da-água` and `## Fogo: básico` becomes `#fogo-básico`. If two headings are identical, the second one gets `-1`, the third `-2`, and so on.
- **Start the file with a status comment**, so others know whether it has been checked:
  ```
  <!-- translated-from: <wiki commit of the English page> · status: machine | reviewed -->
  ```
  Use `machine` for automatic or unchecked translations and `reviewed` once a fluent speaker has read it. Safety-critical chapters (first aid, poisonous plants, water, cold) deserve a careful human review.

#### Checking your translation

```
cd app
npm run content   # builds every language; warnings start with your language code
npm start         # open Settings → Language and pick your language
```

`npm run content` fails if an image is missing, and it warns about links to headings that don't exist or figure anchors your translation dropped.

You don't need to be a developer to help. If git is not for you, open an issue with your translated file attached and we'll add it.

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
