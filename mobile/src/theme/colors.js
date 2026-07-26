// Terrain Jade — ported verbatim from web's tailwind.config.js (the
// 2026 design-system overhaul: jade brand, warm neutral slates, sun-orange
// accent). Web and mobile now share one palette; only typography stays
// platform-specific (Sora/Inter here vs Plus Jakarta Sans on web).
export const colors = {
  brand50: '#edfaf7',
  brand100: '#d0f3e8',
  brand200: '#9de5cc',
  brand300: '#5dcfad',
  brand400: '#2bba8d',
  brand500: '#12a374',
  brand600: '#0d8a5f',
  brand700: '#0a6e4b',
  brand800: '#085539',
  brand900: '#053d29',

  // Warm neutral slate override — replaces the cold blue-gray Tailwind scale
  slate50: '#fafaf8',
  slate100: '#f5f4f0',
  slate200: '#eceae4',
  slate300: '#d6d2c8',
  slate400: '#a8a49b',
  slate500: '#78736a',
  slate600: '#524e47',
  slate700: '#312e28',
  slate800: '#1c1a16',
  slate900: '#0d0c0a',

  // Map accent — Sun Orange (search pin, navigation)
  accent400: '#ff6b3d',
  accent500: '#f4511e',
  accent600: '#c93d11',

  white: '#FFFFFF',
  black: '#0A0A0A',

  danger: '#EF4444',
  danger50: '#fef2f2',
  warning: '#F59E0B',
  warning50: '#fffbeb',
  // Tailwind amber-100 — the hairline that keeps a warning50 card from bleeding
  // into a white surface. Web uses amber-50/amber-100 as the same pair.
  warning100: '#fef3c7',
  // Tailwind amber-700, the same value web uses. `warning` above is tuned to
  // sit on `warning50` inside a chip; at ~2.1:1 on white it is too light for
  // body text, and the caveat lines under a confidence meter are body text.
  warning700: '#b45309',
  success: '#22C55E',
  success50: '#f0fdf4',
}
