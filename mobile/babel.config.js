// lucide's PascalCase icon names → their kebab-case filenames.
// Home → home, Building2 → building-2, BedDouble → bed-double. Verified against
// every icon the app imports (24/24 resolve) before this was enabled.
const lucideFile = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])([0-9])/g, '$1-$2')
    .toLowerCase()

module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Metro does not tree-shake, so `import { Home } from 'lucide-react-native'`
      // pulled the ENTIRE icon library into the bundle: 1,214 KB — 26.8% of all
      // JS — to deliver the 24 icons actually used (measured with
      // source-map-explorer, 2026-07-20). This rewrites each member import to
      // the icon's own file, so only those 24 ship.
      //
      // preventFullImport makes a future `import * as Icons` a build error
      // instead of a silent 1.2 MB regression.
      [
        'babel-plugin-transform-imports',
        {
          'lucide-react-native': {
            transform: (importName) =>
              `lucide-react-native/dist/esm/icons/${lucideFile(importName)}.mjs`,
            preventFullImport: true,
          },
        },
      ],
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
      'react-native-worklets/plugin',
    ],
  }
}
