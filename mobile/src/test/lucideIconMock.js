// Stands in for any single lucide icon module in tests.
//
// babel.config.js rewrites every `import { Home } from 'lucide-react-native'`
// to `lucide-react-native/dist/esm/icons/home.mjs` — the transform that keeps
// 1.2 MB of unused icons out of the bundle. Jest cannot resolve those `.mjs`
// paths, so the first component test to render an Icon failed at import with
// "Cannot find module .../compass.mjs", which reads as a missing dependency
// rather than a resolution quirk.
//
// Mapped by name in package.json's jest.moduleNameMapper. A View keeps the
// tree renderable and queryable; nothing in this suite asserts on icon glyphs,
// and an icon is decorative by definition here — every icon-only control
// carries its own accessibilityLabel (AGENTS.md §6), which is what the tests
// actually query by.
const { View } = require('react-native')

module.exports = View
module.exports.default = View
