const fs = require('fs')
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// lucide-react-native ships its ESM build as .mjs files with relative .mjs
// imports between them (e.g. icons/a-arrow-down.mjs). Metro's default
// sourceExts doesn't include mjs, so it can't resolve those internal
// imports even though the files exist on disk.
config.resolver.sourceExts.push('mjs')

// babel.config.js rewrites `import { Home } from 'lucide-react-native'` to that
// icon's own file, because Metro does not tree-shake and the barrel import
// pulled the ENTIRE library (1,214 KB, 26.8% of the JS bundle) to deliver ~24
// icons. But lucide's package.json `exports` map declares only "." and
// "./icons" — there is NO subpath pattern for an individual icon — so every
// rewritten import is an unlisted subpath. Metro still resolves it by falling
// back to file-based resolution and everything works, but it prints a
// paragraph-long warning PER ICON PER BUNDLE: several hundred lines that bury
// every other warning in the dev-server output.
//
// Resolving these ourselves skips the exports-map check for exactly this one
// package and nothing else. If a path stops existing we fall through to normal
// resolution rather than hard-failing, so a lucide upgrade that moves files
// degrades back to the warning instead of breaking the build.
const LUCIDE_ICON = /^lucide-react-native\/dist\/esm\/icons\/(.+)\.mjs$/
const LUCIDE_ICON_DIR = path.join(__dirname, 'node_modules', 'lucide-react-native', 'dist', 'esm', 'icons')

const upstreamResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const match = moduleName.match(LUCIDE_ICON)
  if (match) {
    const filePath = path.join(LUCIDE_ICON_DIR, `${match[1]}.mjs`)
    if (fs.existsSync(filePath)) return { type: 'sourceFile', filePath }
  }
  return upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform)
}

module.exports = config
