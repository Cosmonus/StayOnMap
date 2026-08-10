// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Jest's globals exist only in test files. Declaring them repo-wide would
    // let a stray `describe` in app code lint clean and then crash at runtime.
    files: ['**/*.test.js', 'src/test/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        // Node's CommonJS globals. Jest runs these files under Node, not in
        // the RN runtime, so a lint that reads source off disk (api-paths)
        // legitimately needs __dirname and require.
        __dirname: 'readonly',
        require: 'readonly',
      },
    },
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
