// Base unit 4px, matches web's Tailwind spacing scale (.claude/ui-ux.md).
//
// `smd` (12) is ON that scale — `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`
// — and was simply missing from this file, so the one gap between 8 and 16 had
// no token and anything needing it either rounded up to 16 or hardcoded a 12.
// Added rather than hardcoded, per the standard's own instruction: extend the
// token file, don't work around it.
export const spacing = {
  xs: 4,
  sm: 8,
  smd: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
}
