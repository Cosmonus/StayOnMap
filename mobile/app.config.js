export default {
  expo: {
    name: 'StayOnMap',
    slug: 'stayonmap',
    owner: 'cosmonus-stayonmap',
    version: '1.0.0',
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
      // "Display over other apps" — a sensitive permission Play surfaces on the
      // store listing, and one a rental app has no business requesting. It is
      // not ours: Expo's prebuild template puts it in the MAIN manifest, so it
      // was shipping in release builds. Dev builds are unaffected — React
      // Native declares it in its own debug manifest
      // (android/app/src/debug/AndroidManifest.xml) for the dev overlay, and
      // that variant is merged only into debug.
      blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'],
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
          // ./assets/splash-icon.png IS INTENTIONALLY 100% TRANSPARENT.
          // Do not "fix" it by dropping a logo back in.
          //
          // There is exactly ONE launch screen and it is the wordmark —
          // components/common/BrandSplash.js. It has to be JS, because this
          // plugin can only place an image and Android 12+ masks that image
          // into a 192dp circle: "StayOnMap" baked in here would be clipped to
          // "ayOnMa", and shrunk to fit the circle it would be illegible. So
          // the native splash paints a flat brand colour and nothing else, and
          // the wordmark animates in the instant JS is up.
          //
          // Omitting `image` entirely does NOT give a blank splash — Android 12+
          // then falls back to the launcher icon, putting the S back on screen.
          // A transparent drawable is what actually suppresses it. imageWidth is
          // vestigial with no pixels to size, and kept only so a future logo has
          // a sane starting value.
          //
          // backgroundColor is brand-600, NOT brand-50. brand-50 is #edfaf7 —
          // 97% luminance, indistinguishable from white on a phone — so with a
          // transparent image the entire pre-JS launch read as a blank white
          // screen, which is precisely what a user reported. brand-600 is
          // unmistakably the brand from the first frame, and it is also
          // GetStartedScreen's background, so the whole launch is one colour.
          //
          // It MUST stay in sync with BrandSplash.js's root background AND
          // GetStartedScreen's container — three surfaces pretending to be one,
          // and any drift shows up as a flash on every cold start.
          image: './assets/splash-icon.png',
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
