module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@lib': './src/lib',
            '@services': './src/services',
            '@store': './src/store',
            '@theme': './src/theme',
            '@navigation': './src/navigation',
            '@features': './src/features',
            '@components': './src/components',
            '@utils': './src/utils',
            '@config': './src/config',
          },
        },
      ],
      // must stay last
      'react-native-reanimated/plugin',
    ],
  }
}
