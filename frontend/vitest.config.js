import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

// Extends the app's own vite config rather than restating it — the path
// aliases (@features, @services, …) are load-bearing in every component, and a
// second copy here would drift the first time one is added.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    // Deliberately quiet: a passing suite should say almost nothing, so the
    // one line that matters when something breaks is not buried.
    reporters: 'dot',
  },
}))
