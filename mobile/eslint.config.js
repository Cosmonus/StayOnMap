// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Teaches import/no-unresolved about the @lib/@services/@theme/etc.
    // aliases babel.config.js's module-resolver plugin defines — without
    // this every aliased import falsely errors as unresolved.
    settings: {
      'import/resolver': {
        'babel-module': {},
      },
    },
  },
]);
