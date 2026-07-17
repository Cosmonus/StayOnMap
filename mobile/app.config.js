export default {
  expo: {
    name: 'StayOnMap',
    slug: 'stayonmap',
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
          image: './assets/splash-icon.png',
          imageWidth: 500,
          backgroundColor: '#edfaf7',
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
        projectId: '73936213-4d88-4224-a821-e6056cb8807c',
      },
    },
  },
}
