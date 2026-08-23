export default {
  expo: {
    name: 'StayOnMap',
    slug: 'stayonmap',
    owner: 'cosmonus-stayonmap',
    version: '1.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'stayonmap',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.stayonmap.app',
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
      infoPlist: {
        // StayOnMap only uses standard HTTPS/TLS, no custom cryptography —
        // declaring this upfront skips App Store Connect's export-compliance
        // prompt on every single submission.
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.stayonmap.app',
      // Auto Backup copies all of AsyncStorage to Google Drive and restores it
      // onto a new device — including `user_token` and the 30-day rotating
      // `refreshToken`. It could never yield a working login anyway
      // (session.service.js treats a rotated-out refresh token as a
      // stolen-token replay and revokes the session), so backup here is pure
      // credential exposure with zero user benefit. This was set on 2026-07-25
      // and verified in the generated manifest, but the config edit never
      // reached the repo — the manifest read allowBackup="true" again on
      // 2026-08-14. Verify `android:allowBackup="false"` in the generated
      // manifest after any prebuild; app.config.js is the input, not the truth.
      allowBackup: false,
      // "Display over other apps" — a sensitive permission Play surfaces on the
      // store listing, and one a rental app has no business requesting. It is
      // not ours: Expo's prebuild template puts it in the MAIN manifest, so it
      // was shipping in release builds. Dev builds are unaffected — React
      // Native declares it in its own debug manifest
      // (android/app/src/debug/AndroidManifest.xml) for the dev overlay, and
      // that variant is merged only into debug.
      blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'],
      // https App Links, so stayonmap.com/property/123 opens the app instead of
      // the browser. The custom scheme (stayonmap://property/:id) already
      // worked; this is the half that needs Google's blessing.
      //
      // `autoVerify` makes Android fetch
      // https://www.stayonmap.com/.well-known/assetlinks.json on install and
      // check that its SHA-256 matches the signing key. WWW ONLY — the apex
      // 302s and drops the path, so it can never satisfy verification.
      //
      // Failure here is SILENT: a fingerprint mismatch just means links keep
      // opening in the browser, with no error anywhere. Confirm with
      // `adb shell pm get-app-links com.stayonmap.app` after installing a
      // build, and expect `verified` — anything else means the file and the
      // key disagree.
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          category: ['BROWSABLE', 'DEFAULT'],
          data: [{ scheme: 'https', host: 'www.stayonmap.com', pathPrefix: '/property' }],
        },
      ],
      // The foreground S is 46% of the 108dp canvas, giving it a ~57% bounding
      // diagonal — clear of the 66dp (61%) circle Android guarantees is visible
      // on every launcher shape. It was 62% tall, i.e. TALLER than that
      // guaranteed circle, so round-mask launchers cropped the terminals and
      // the letter filled the badge edge to edge.
      adaptiveIcon: {
        backgroundColor: '#0d8a5f',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-font',
      'expo-status-bar',
      [
        'expo-splash-screen',
        {
          // The adaptive icon's FOREGROUND — the white S, on transparent — so
          // the very first frame carries the same mark as the icon the user
          // just tapped, instead of a blank green field.
          //
          // A 100%-transparent PNG used to sit here specifically to suppress
          // the mark, which bought an empty screen for the whole pre-JS
          // launch. Blank was the complaint; the mark is the fix.
          //
          // Reusing the icon foreground rather than a bespoke asset is
          // deliberate twice over: it already carries the safe-area padding
          // Android's circular splash mask needs, and it cannot drift from the
          // launcher icon because it IS the launcher icon.
          //
          // Do NOT drop `image` to get this "for free" from Android's
          // launcher-icon fallback: expo's prebuild still writes
          // `windowSplashScreenAnimatedIcon="@drawable/splashscreen_logo"`
          // into styles.xml while generating no such drawable, and the
          // resource link fails.
          //
          // Do not put the WORDMARK here. This plugin can only place an image,
          // and Android 12+ masks it into a circle: "StayOnMap" would clip to
          // "ayOnMa", and shrunk to fit it would be illegible. That is what
          // components/common/BrandSplash.js is for — the mark greets you, the
          // name arrives the instant JS is up. The icon-then-wordmark order is
          // not two brand moments competing; it is the mark resolving into the
          // name, and it is why the first frame is no longer empty.
          //
          // backgroundColor is brand-600, NOT brand-50. brand-50 is #edfaf7 —
          // 97% luminance, indistinguishable from white on a phone — so the
          // entire pre-JS launch read as a blank white screen, which is
          // precisely what a user reported. brand-600 is unmistakably the
          // brand, and it is also GetStartedScreen's background, so the whole
          // launch is one colour.
          //
          // It MUST stay in sync with BrandSplash.js's root background AND
          // GetStartedScreen's container — three surfaces pretending to be one,
          // and any drift shows up as a flash on every cold start.
          image: './assets/android-icon-foreground.png',
          imageWidth: 288,
          backgroundColor: '#0d8a5f',
        },
      ],
      [
        'expo-notifications',
        {
          // MUST be a white silhouette on transparency — Android masks the
          // notification small icon by its alpha channel and paints every
          // opaque pixel white. This pointed at ./assets/icon.png, which is
          // 100% opaque, so every StayOnMap notification showed a solid white
          // square in the status bar instead of the logo. The monochrome
          // adaptive icon is already exactly the right shape (15% opaque,
          // pure white), so it doubles as the notification icon.
          icon: './assets/android-icon-monochrome.png',
          color: '#0d8a5f',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow StayOnMap to access your photos to upload property images.',
          // Both `false` on purpose. The app only ever calls
          // launchImageLibraryAsync (ImageUploader.js, ConversationScreen.js)
          // — it never opens the camera and never records audio. Left unset,
          // this plugin ADDS RECORD_AUDIO to the manifest and permits CAMERA
          // (see its withAndroidImagePickerPermissions), so a rental app was
          // asking Play reviewers and users for microphone access it never
          // uses. `false` also blocks any other package from re-adding them.
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Allow StayOnMap to use your location to show nearby rentals.',
        },
      ],
    ],
    extra: {
      eas: {
        // Public project identifier, not a secret — EAS CLI requires this as a
        // literal for dynamic (.js) app configs; it won't write it in for you
        // the way it would for a static app.json.
        projectId: 'e2805a13-9fb1-43f4-b6e1-6ae28c070f18',
      },
    },
  },
}
