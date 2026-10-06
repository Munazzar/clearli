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
`release.keystore` (alias `clearli`) sits next to `build.sh` and is **never committed** (`.gitignore`).
Keep it safe offline: updates must be signed with the same key or Android refuses to install them over the existing app.
Build with `KEYSTORE_PASS=… ./build.sh`.

## Tests
`bash test/run-all.sh` runs everything (Node + Playwright, screenshots in test/shots); CI runs the same on every PR.

## Google sign-in and Drive sync
People sign in with Google **on the web or in the app, whichever they like**. Each person's data lives in their own
Google Drive, in the hidden app folder (scope `drive.appdata`): Clearli can't see their other files and there is no
Clearli server.

- **Every device is an equal.** The web and any number of phones signed in with the same Google account read and
  write the same vault (`clearli-vault.json`, appProperties `sv=2`). On each sync a device pulls what the others
  saved, re-applies its own edits on top and saves (`Drive.peerSync` in `js/drive.js`), so edits made at the same time
  on two devices are both kept. A vault still written by a 1.4.0 phone (no `sv`) is followed the old way (op files)
  until that phone updates.
- **Getting transactions in.** Import CSV/OFX/QFX statements from any bank in any country, on the web or the phone
  (comma or dot decimals, day-first dates, month names, local-language headers, UTF-8/UTF-16/Windows-1252).
  SimpleFIN (US/Canada) is optional and runs in the phone app.
- **SimpleFIN only after sign-in.** When this build has Google sign-in configured, SimpleFIN sync and history
  loading run only while the phone is signed in. Connecting SimpleFIN during onboarding asks for Google sign-in
  first; a signed-out or revoked phone pauses bank sync and shows "Sign in with Google" on the Connection page.

### One-time setup (Google Cloud project `clearli-8c132`)
1. **APIs & Services → Library:** enable the Google Drive API.
2. **OAuth consent screen:** External, scope `.../auth/drive.appdata` only, then **Publish app** (In production).
   In Testing mode only listed test users can sign in and refresh tokens expire after 7 days.
3. **Credentials → Create OAuth client ID → Web application:** authorized JavaScript origin
   `https://munazzar.github.io`, authorized redirect URI `https://munazzar.github.io/clearli/`.
4. **Credentials → Create OAuth client ID → Desktop app** (for the Android app; loopback + PKCE).
5. **GitHub → Settings → Secrets and variables → Actions → Variables:** `GOOGLE_WEB_CLIENT_ID` = the Web client ID.
   **Settings → Pages → Source:** GitHub Actions. Pushing to `main` then deploys the dashboard (`.github/workflows/pages.yml`).
6. **Android build:** `GOOGLE_APP_CLIENT_ID=… GOOGLE_APP_CLIENT_SECRET=… KEYSTORE_PASS=… ./build.sh`
   (or fill `android/assets/www/js/gconfig.js` locally). Without a client ID the app works as before, with no
   Google gate.
