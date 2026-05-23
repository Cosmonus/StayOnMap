/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Primary brand — Terrain Jade ───────────────────────────────────
        brand: {
          50:  '#edfaf7',
          100: '#d0f3e8',
          200: '#9de5cc',
          300: '#5dcfad',
          400: '#2bba8d',
          500: '#12a374',  // Terrain Jade — primary interactive
          600: '#0d8a5f',  // default interactive
          700: '#0a6e4b',  // hover
          800: '#085539',
          900: '#053d29',
        },

        // ── Warm neutral slate override (replaces cold blue-gray slate) ────
        slate: {
          50:  '#fafaf8',
          100: '#f5f4f0',
          200: '#eceae4',
          300: '#d6d2c8',
          400: '#a8a49b',
          500: '#78736a',
          600: '#524e47',
          700: '#312e28',
          800: '#1c1a16',
          900: '#0d0c0a',
          950: '#060504',
        },

        // ── Map accent — Sun Orange (search pin, navigation) ───────────────
        accent: {
          400: '#ff6b3d',
          500: '#f4511e',
          600: '#c93d11',
        },

        // ── Semantic state colors ──────────────────────────────────────────
        error: {
          50:  '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
      },

      fontFamily: {
        sans:    ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui'],
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui'], // hero headlines
        serif:   ['Fraunces', 'Georgia', 'ui-serif'],  // large numerics only (stat blocks)
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'], // prices, data, IDs
      },

      borderRadius: {
        'xs':  '0.125rem',  /*  2px */
        'sm':  '0.25rem',   /*  4px */
        'md':  '0.375rem',  /*  6px */
        'lg':  '0.5rem',    /*  8px */
        'xl':  '0.75rem',   /* 12px */
        '2xl': '1rem',      /* 16px */
        '3xl': '1.5rem',    /* 24px */
      },

      boxShadow: {
        'xs':    '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'sm':    '0 1px 3px 0 rgb(0 0 0 / 0.10), 0 1px 2px -1px rgb(0 0 0 / 0.08)',
        'md':    '0 4px 8px -2px rgb(0 0 0 / 0.12), 0 2px 4px -2px rgb(0 0 0 / 0.08)',
        'lg':    '0 10px 20px -4px rgb(0 0 0 / 0.14), 0 4px 8px -4px rgb(0 0 0 / 0.08)',
        'xl':    '0 20px 40px -8px rgb(0 0 0 / 0.18), 0 8px 16px -8px rgb(0 0 0 / 0.10)',
        // ── Terrain design tokens ────────────────────────────────────────
        'pin':          '0 4px 16px rgb(13 138 95 / 0.35)',
        'pin-selected': '0 4px 20px rgb(13 138 95 / 0.50)',
        'card':         '0 2px 8px rgb(0 0 0 / 0.08), 0 0 0 1px rgb(0 0 0 / 0.04)',
        'panel':        '0 12px 40px rgb(0 0 0 / 0.22), 0 4px 12px rgb(0 0 0 / 0.10)',
        'float':        '0 8px 32px rgb(0 0 0 / 0.18), 0 2px 8px rgb(0 0 0 / 0.08)',
        'sheet':        '0 -4px 24px rgb(0 0 0 / 0.16)',
        'focus':        '0 0 0 3px rgb(18 163 116 / 0.25)',
      },

      animation: {
        'fade-in':    'fadeIn 200ms ease-out',
        'fade-out':   'fadeOut 150ms ease-in',
        'slide-up':   'slideUp 350ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'slide-down': 'slideDown 350ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'scale-in':   'scaleIn 200ms ease-out',
        'slide-in':   'slideIn 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'pin-drop':   'pinDrop 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',  // map pin entrance
        'pin-pulse':  'pinPulse 2000ms ease-in-out infinite',             // selected pin
        'sheet-up':   'sheetUp 350ms cubic-bezier(0.32, 0.72, 0, 1)',     // bottom sheet
      },

      keyframes: {
        fadeIn:    { from: { opacity: '0' },                               to: { opacity: '1' } },
        fadeOut:   { from: { opacity: '1' },                               to: { opacity: '0' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(8px)' },  to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { from: { opacity: '0', transform: 'translateY(-8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { from: { opacity: '0', transform: 'scale(0.95)' },     to: { opacity: '1', transform: 'scale(1)' } },
        slideIn:   { from: { opacity: '0', transform: 'translateX(100%)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pinDrop: {
          '0%':   { opacity: '0', transform: 'translateY(-12px) scale(0.8)' },
          '60%':  { transform: 'translateY(3px) scale(1.05)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        pinPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(13 138 95 / 0.4)' },
          '50%':      { boxShadow: '0 0 0 8px rgb(13 138 95 / 0)' },
        },
        sheetUp: {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
      },

      transitionDuration: {
        'fast':   '150ms',
        'normal': '250ms',
        'slow':   '350ms',
        'map':    '400ms',  // map pan / fly-to transitions
      },

      transitionTimingFunction: {
        'map':    'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'sheet':  'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
}
