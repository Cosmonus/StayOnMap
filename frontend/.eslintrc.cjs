// Design-system rules live at the bottom of this file. They exist because
// every one of them is debt this codebase has paid off at least once and would
// otherwise pay again: 642 slate-400 text sites, 121 sub-11px sites, a retired
// orange ramp that survived as ten hardcoded literals after the ramp itself was
// deleted, and ~45 emoji standing in for icons. A convention nothing enforces
// is a convention that comes back.
//
// Deliberate exceptions carry an eslint-disable-next-line with a reason. That
// is the point: the exception documents itself at the site, rather than in a
// doc nobody reads next to the code.
//
// NOT enforced here, deliberately: off-scale spacing (py-2.5, mt-0.5, px-3.5,
// pt-[132px]). There are ~500 such sites and `.claude/ui-ux.md` records the
// decision — fix them in files you touch, because a blind global sweep would
// change visual density on every screen at once. An error would force exactly
// that sweep; a warning would print 500 lines on every lint run and bury the
// real ones, which is a failure mode this repo has already hit once (the 185
// Metro package-exports warnings). It stays a review item until someone does
// the sweep screen by screen.

// Anything a class string can arrive as: a plain literal, a template chunk, or
// a string inside a ternary or array. All three matter — roughly half this
// codebase builds className from a template.
const inClassName = (pattern, message) => [
  { selector: `JSXAttribute[name.name="className"] Literal[value=${pattern}]`, message },
  { selector: `JSXAttribute[name.name="className"] TemplateElement[value.raw=${pattern}]`, message },
]

const EMOJI = '/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}]/u'
const EMOJI_MSG =
  'No emoji in the UI — use a lucide icon. An emoji renders in the OS font: a different shape on ' +
  'every platform, at a weight and size we do not control, beside text set in Plus Jakarta Sans.'

module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  // This file is the only CommonJS one in `frontend/` — package.json is
  // `"type": "module"`, which is why it has to be `.cjs` at all. Without a Node
  // env its own `module.exports` is an undefined global under `env.browser`,
  // so the config reports an error in itself.
  //
  // `npm run lint` cannot see that: it runs `eslint src`, and this file is not
  // in src. Only an editor linting the open file surfaces it, which is exactly
  // how it went unnoticed.
  overrides: [
    {
      files: ['*.cjs'],
      env: { node: true },
      parserOptions: { sourceType: 'script' },
    },
  ],
  plugins: ['react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    'react/prop-types': 'off',
    'react/display-name': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'warn',
    'no-var': 'error',

    // ── Design system ────────────────────────────────────────────────────
    'no-restricted-syntax': [
      'error',

      // slate-300/400 are 1.6:1 and 2.5:1 on white — they fail the 4.5:1 text
      // floor AND the 3:1 icon/control floor. slate-500 is the muted-text
      // token; on a tinted surface it takes slate-600. `disabled:` prefixes are
      // exempt (WCAG exempts disabled controls) and the pattern lets them
      // through by requiring a preceding boundary that is not a colon.
      ...inClassName(
        '/(?:^|\\s)(?:hover:|group-hover:|focus:)?text-slate-[34]00/',
        'slate-300/400 are not text colours (1.6:1 and 2.5:1 on white). Use text-slate-500, or ' +
        'text-slate-600 on a tinted surface. Genuinely decorative? eslint-disable it with the reason.',
      ),

      // A hex inside a class is a colour outside the token layer — which is
      // exactly how the retired orange ramp survived as ten literals after the
      // ramp was deleted. #111111 / #2a2a2a are the documented dark-CTA pair.
      ...inClassName(
        '/-\\[#(?!111111|2a2a2a)[0-9a-fA-F]{3,8}\\]/',
        'No raw hex in a class — use a token from tailwind.config.js. The only literals allowed ' +
        'are #111111 and #2a2a2a (the dark CTA and its hover).',
      ),

      // Named tokens exist for every elevation this app uses (card / panel /
      // float / sheet, plus xs-xl). An inline one is a shadow nobody can find
      // when the scale changes.
      {
        selector: 'JSXAttribute[name.name="style"] Property[key.name="boxShadow"]',
        message:
          'Use a shadow token (shadow-card / shadow-panel / shadow-float / shadow-sheet / shadow-sm…), ' +
          'not an inline boxShadow.',
      },

      // JSX text, string literals and template chunks — most of the emoji this
      // codebase had lived in config objects, not in markup.
      { selector: `JSXText[value=${EMOJI}]`, message: EMOJI_MSG },
      { selector: `Literal[value=${EMOJI}]`, message: EMOJI_MSG },
      { selector: `TemplateElement[value.raw=${EMOJI}]`, message: EMOJI_MSG },
    ],
  },
}
