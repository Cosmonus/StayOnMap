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
    },
    android: {
      package: 'com.stayonmap.app',
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
          icon: './assets/icon.png',
          color: '#0d8a5f',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow StayOnMap to access your photos to upload property images.',
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
