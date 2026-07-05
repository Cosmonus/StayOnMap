const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// lucide-react-native ships its ESM build as .mjs files with relative .mjs
// imports between them (e.g. icons/a-arrow-down.mjs). Metro's default
// sourceExts doesn't include mjs, so it can't resolve those internal
// imports even though the files exist on disk.
config.resolver.sourceExts.push('mjs')

module.exports = config
