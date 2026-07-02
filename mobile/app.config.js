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
        backgroundColor: '#E9F9F1',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-font',
      'expo-splash-screen',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#0E9D66',
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
        projectId: process.env.EAS_PROJECT_ID,
      },
    },
  },
}
