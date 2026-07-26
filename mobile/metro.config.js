const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// lucide-react-native ships its ESM build as .mjs files with relative .mjs
// imports between them (e.g. icons/a-arrow-down.mjs). Metro's default
// sourceExts doesn't include mjs, so it can't resolve those internal
// imports even though the files exist on disk.
config.resolver.sourceExts.push('mjs')

// Package-exports resolution (Expo's default since SDK 53) re-checks every file
// Metro resolves inside a package that declares "exports" — including that
// package's OWN relative imports. lucide's map declares only "." and "./icons",
// while its root barrel re-exports ~1500 icons as `./icons/<name>.mjs`, so every
// icon this app touches logged a "not listed in the exports … falling back to
// file-based resolution" warning: ~185 lines on every bundle, burying anything
// real. The fallback it describes is the correct resolution, so the only thing
// lost by turning the check off is the noise.
//
// A resolver.resolveRequest hook scoped to lucide's directory was tried first
// and had no effect — @expo/cli installs its own resolveRequest at server
// start, replacing whatever metro.config.js sets.
//
// Revisit if a dependency ever ships an exports-only React Native entry point:
// the symptom would be a "module not found" for a package that plainly exists.
config.resolver.unstable_enablePackageExports = false

module.exports = config
