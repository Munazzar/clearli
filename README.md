# Clearli — private personal finance (Android)

Native Android shell (Java, no Gradle) hosting an offline web UI in a network-blocked WebView.

- `android/src/…/MainActivity.java` — WebView host + JS bridge (`window.Native`), FLAG_SECURE, app lock (KeyguardManager), file export/import
- `android/src/…/SecureStore.java` — AES-256-GCM files, key in Android Keystore
- `android/src/…/SimpleFin.java` — SimpleFIN claim + `/accounts?version=2` (HTTPS only, Basic auth)
- `android/assets/www/js/engine.js` — categorizer, merchant normalization, learning rules, transfer pairing, recurring detection, analytics, leak finder, goal planner
- `android/assets/www/js/store.js` — state, sync (90-day windows, 24 req/day quota), demo data, CSV/backup
- `android/assets/www/js/screens-*.js` — UI screens

## Build
Requires Ubuntu packages: `android-sdk-platform-23 aapt apksigner zipalign dalvik-exchange` and a JDK.
`./build.sh` → `build/Clearli.apk`

## Signing
`release.keystore` (alias `clearli`, password `clearli123`). Keep it: updates must be signed with the same key
or Android refuses to install them over the existing app. Change the password before any public release.

## Tests
`node test/engine.test.js`, `node test/ingest.test.js`, `node test/ui.test.js` (Playwright, screenshots in test/shots).
