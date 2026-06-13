# HelloCal — Native iOS & Android (Capacitor)

HelloCal ships as a real App Store / Play Store app by wrapping the Vite PWA in
[Capacitor](https://capacitorjs.com). The same React codebase powers web, iOS, and Android.

## Architecture

- The web app builds to `dist/` (`npm run build`).
- Capacitor copies `dist/` into the native projects (`android/`, `ios/`) on `cap sync`.
- `src/services/native.ts` is the bridge: it detects the platform (`Capacitor.isNativePlatform()`)
  and uses native plugins on device while safely no-opping in the browser. The web build never
  breaks — every native call is guarded and dynamically imported.

### Native capabilities wired up
| Feature | Plugin | Where |
|---------|--------|-------|
| Status bar + splash | `@capacitor/status-bar`, `@capacitor/splash-screen` | `initNative()` in `App.tsx` mount |
| Camera meal scan | `@capacitor/camera` | `capturePhotoNative()` → `VoiceInput.tsx` |
| Haptics on log/goal-hit | `@capacitor/haptics` | `haptic()` / `hapticSuccess()` in `App.tsx` |
| Share / backup export | `@capacitor/share` | `shareText()` → `Settings.tsx` |
| Keyboard, app lifecycle | `@capacitor/keyboard`, `@capacitor/app` | config |

The service worker is **disabled inside the native webview** (see `index.html`) since the native
shell handles its own asset bundling; the SW remains active for the web/PWA build.

## Commands

```bash
npm run build        # typecheck + vite build -> dist/
npm run cap:sync     # build + copy web assets into android/ & ios/
npm run android      # build + sync + open Android Studio
npm run ios          # build + sync + open Xcode (macOS only)
```

## Building Android (works on Windows/macOS/Linux)

Prereqs: **Android Studio** + JDK 17, with `ANDROID_HOME` set.

```bash
npm run android        # opens Android Studio
# In Android Studio: Run ▶ on a device/emulator, or
# Build > Generate Signed Bundle / APK for a Play Store .aab
```

`minSdk`/`targetSdk` are managed in `android/variables.gradle`.

## Building iOS (requires macOS)

iOS **cannot be built on Windows** — Xcode and CocoaPods are macOS-only. On this Windows dev
machine the Xcode project is scaffolded but `pod install` was skipped. On a Mac:

```bash
sudo gem install cocoapods   # if needed
npm run ios                  # build + sync + open Xcode
cd ios/App && pod install    # first time
# In Xcode: select a team, set signing, Run ▶ or Archive for the App Store
```

Permission strings live in `ios/App/App/Info.plist` (camera, photo library, microphone) and are
already filled in.

## Releasing without a Mac — GitHub Actions

`.github/workflows/mobile-build.yml` provides a CI template that builds the Android bundle on
Ubuntu and the iOS app on a macOS runner. Add signing secrets in the repo settings:

- Android: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
- iOS: `IOS_CERTIFICATE_P12_BASE64`, `IOS_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64`, `APPLE_TEAM_ID`

## App identity

- App ID: `com.hellocal.app`
- App name: `HelloCal`
- Config: `capacitor.config.ts`

## TODO (store-readiness polish)
- Generate branded launcher icons + splash for all densities (`@capacitor/assets` from a 1024×1024 source).
- App Store / Play Store listing assets (screenshots, descriptions).
