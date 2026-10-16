[![Android app on Google Play](https://ligi.de/img/play_badge.png)](https://play.google.com/store/apps/details?id=org.ligi.survivalmanual)
[![Android app on FDroid](https://ligi.de/img/fdroid_badge.png)](https://f-droid.org/packages/org.ligi.survivalmanual/)
[![Android app at Amazon](https://ligi.de/img/amazon_badge.png)](https://www.amazon.com/ligi-Survival-Manual/dp/B06WW43R3T)

## About
This is a survival manual/guide based on the public domain US Army Survival Field Manual [FM 3-05.70 (FM 21-76)](https://fas.org/irp/doddir/army/fm3-05-70.pdf).
It is fully functional offline, which is important in the case of a catastrophe.

The content list is curated in [this wiki](https://github.com/ligi/SurvivalManual/wiki).

![](https://raw.githubusercontent.com/ligi/SurvivalManual/master/assets/banner.png)

## Expo app (v6)

The `app/` folder holds the React Native + Expo rewrite that ships to Android, iOS and the web from one codebase. The Kotlin app in `android/` stays in the repo until the Expo app has fully replaced it on Google Play, and it remains the version published on F-Droid.

```
git submodule update --init   # chapter content
cd app && npm install
npm start                     # Expo dev server (builds content first)
npm test                      # unit + component tests
npm run export:web            # offline PWA in app/dist
```

### Releasing

1. `npx eas-cli login`, then `npx eas-cli init` once to link the project.
2. Android: upload the existing Play upload keystore with `npx eas-cli credentials` so updates install over the current app. Bump `android.versionCode` in `app/app.json`.
3. `npx eas-cli build --profile production --platform all`
4. `npx eas-cli submit --platform android` (internal track first) and `npx eas-cli submit --platform ios`.
5. iOS needs a 1024×1024 app icon at `app/assets/icon.png` before App Store submission (the current one is 512×512).

## Contributing
This app is libre (open) software, so pull requests are welcome.
If you want to help translate, the app strings are on [Transifex](https://www.transifex.com/ligi/survivalmanual/).

Happy survival!

## License
THIS SOFTWARE IS PROVIDED "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING,
BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

