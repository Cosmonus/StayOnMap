// Mobile-specific palette per the StayOnMap Mobile PDF spec (#0E9D66 anchor).
// Deliberately distinct from web's brand-* Tailwind scale (#0284c7/sky-blue,
// see .claude/ui-ux.md) — not a reconciliation, two separate surfaces.
export const colors = {
  brand50: '#E9F9F1',
  brand100: '#CDF1E0',
  brand500: '#12B579',
  brand600: '#0E9D66',
  brand700: '#0B7D52',
  brand900: '#054A32',

  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',

  white: '#FFFFFF',
  black: '#0A0A0A',

  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
}
