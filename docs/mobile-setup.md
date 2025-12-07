# Mobile Build Setup

Nota supports Android and iOS builds via Tauri 2.x.

## Prerequisites

### All Platforms
- Rust: https://rustup.rs
- Node.js 18+ or Bun

### Android
1. Android Studio: https://developer.android.com/studio
2. Android SDK (installed via Android Studio)
3. Android NDK (install via SDK Manager)
4. Set environment variables:
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export NDK_HOME=$ANDROID_HOME/ndk/<version>
   ```

### iOS (macOS only)
1. Xcode from App Store
2. Xcode Command Line Tools: `xcode-select --install`
3. CocoaPods: `sudo gem install cocoapods`
4. Apple Developer account for device deployment

## Setup

### Android
```bash
# Initialize Android project (creates src-tauri/gen/android/)
bun run android:init

# Run on emulator or connected device
bun run android:dev

# Build release APK/AAB
bun run android:build
```

### iOS
```bash
# Initialize iOS project (creates src-tauri/gen/apple/)
bun run ios:init

# Run on simulator or device (requires signing)
bun run ios:dev

# Build release IPA
bun run ios:build
```

## Build Outputs

- Android: `src-tauri/gen/android/app/build/outputs/`
  - Debug APK: `apk/debug/app-debug.apk`
  - Release AAB: `bundle/release/app-release.aab`

- iOS: `src-tauri/gen/apple/build/`
  - Archive/IPA for distribution

## Notes

- Mobile builds require the platform toolchains installed locally
- iOS builds require macOS with Xcode
- Android builds work on Windows, macOS, and Linux
- Some desktop plugins may have limited mobile support
- The app window size adapts automatically on mobile

## Troubleshooting

### Android: SDK not found
Ensure ANDROID_HOME is set correctly:
```bash
echo $ANDROID_HOME  # Should show your SDK path
```

### iOS: Signing issues
1. Open the generated Xcode project in `src-tauri/gen/apple/`
2. Select your team in Signing & Capabilities
3. Update bundle identifier if needed

### Rust not found
Install via rustup:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```
