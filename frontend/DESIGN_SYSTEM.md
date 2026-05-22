# StayNear Design System — Web

## Design Philosophy
Map-first. The map IS the product — everything else floats on top of it.
Think Google Maps with a rental layer, not a listing website with a map widget.

---

## Color System (`tailwind.config.js`)

### Brand (Orange)
| Token      | Hex       | Usage                              |
|------------|-----------|-------------------------------------|
| brand-50   | `#fff3ef` | Tinted backgrounds, hover fills     |
| brand-100  | `#ffe4d8` | Chip/badge backgrounds              |
| brand-200  | `#ffc9b1` | Subtle borders, dividers            |
| brand-300  | `#ffa480` | Decorative, illustrations           |
| brand-400  | `#fd8a5a` | Secondary interactive               |
| brand-500  | `#f97142` | Icons, active rings                 |
| brand-600  | `#f4511e` | **PRIMARY**: buttons, links, CTAs   |
| brand-700  | `#d94318` | Button hover, active states         |
| brand-800  | `#b33714` | Dark brand text on light bg         |
| brand-900  | `#7d1f08` | Darkest brand, rarely used          |

### Neutrals (Slate — Tailwind defaults)
| Token      | Usage                     |
|------------|---------------------------|
| slate-50   | Page backgrounds          |
| slate-100  | Card alt bg, hover fills  |
| slate-200  | Borders, dividers         |
| slate-300  | Disabled borders          |
| slate-400  | Placeholder, muted icons  |
| slate-500  | Secondary body text       |
| slate-600  | Body text                 |
| slate-700  | Labels, strong body       |
| slate-800  | Headings                  |
| slate-900  | Near-black, rare          |

### Semantic
| Token        | Hex       | Usage                     |
|--------------|-----------|---------------------------|
| error-600    | `#dc2626` | Form errors, destructive  |
| success-600  | `#16a34a` | Verified, active listings |
| warning-600  | `#d97706` | Pending, caution          |

Each has -50, -100, -500, -600, -700 shades.

---

## Typography

| Token          | Font  | Weights  | Usage                         |
|----------------|-------|----------|-------------------------------|
| `font-display` | Sora  | 600–800  | Logo, hero headings, prices   |
| `font-sans`    | Inter | 400–600  | Everything else               |

### Scale
| Use           | Classes                                    |
|---------------|---------------------------------------------|
| Page heading  | `text-xl font-semibold text-slate-800`      |
| Section head  | `text-lg font-semibold text-slate-800`      |
| Card title    | `text-base font-medium text-slate-800`      |
| Body          | `text-sm text-slate-600`                    |
| Label         | `text-sm font-medium text-slate-700`        |
| Caption/muted | `text-xs text-slate-400`                    |
| Price badge   | `font-display font-semibold text-brand-700` |

---

## Elevation
| Token        | Usage                              |
|--------------|------------------------------------|
| shadow-xs    | Subtle depth on inputs             |
| shadow-sm    | Cards at rest                      |
| shadow-md    | Floating panels (header, search)   |
| shadow-lg    | Modals, popovers                   |
| shadow-xl    | Dragged elements                   |
| shadow-float | Hero cards, prominent CTAs         |

---

## Border Radius
| Token        | Size  | Usage                        |
|--------------|-------|------------------------------|
| rounded-lg   | 8px   | Buttons, inputs, badges      |
| rounded-xl   | 12px  | Cards, modals, panels        |
| rounded-2xl  | 16px  | Hero sections, images        |
| rounded-full | 9999  | Avatars, pills, toggle knobs |

---

## Spacing Rules
Base: 4px grid (Tailwind default).

- Icon + text gap: `gap-2` (8px)
- Between form fields: `gap-4` (16px)
- Card padding: `p-4` (16px)
- Section gap: `gap-6` (24px)
- Page edge: `px-4` mobile, `px-6` desktop
- **Never** `p-1` or `p-2` for containers

---

## Motion
| Token           | Duration | Usage                     |
|-----------------|----------|---------------------------|
| duration-fast   | 150ms    | Hover, toggles            |
| duration-normal | 200ms    | Fade, scale               |
| duration-slow   | 300ms    | Slide panels, modals      |

Animations: `animate-fade-in`, `animate-slide-up`, `animate-slide-down`, `animate-scale-in`.

---

## Components (`@components/common/`)

Barrel export: `import { Button, Input, ... } from '@components/common'`

| Component   | Key Props                                                  |
|-------------|-------------------------------------------------------------|
| Button      | `variant`: primary / secondary / ghost, `size`: sm/md/lg   |
| Input       | `label`, `error`, `prefix`, `suffix`                       |
| Select      | `label`, `error`, `options`, `placeholder`                 |
| Textarea    | `label`, `error`, `rows`                                   |
| Modal       | `isOpen`, `onClose`, `title`                               |
| Badge       | `variant`: default / success / warning / info              |
| Avatar      | `src`, `name`, `size`: sm/md/lg                            |
| Card        | `padding`, `shadow`, `hoverable`                           |
| Toggle      | `checked`, `onChange`, `label`, `disabled`                  |
| Tooltip     | `text`, `position`: top/bottom/left/right                  |
| IconButton  | `icon`, `size`, `variant`: ghost/outline, `label` (aria)   |
| Divider     | `orientation`, `label`                                     |
| Spinner     | `size`: sm/md/lg                                           |

---

## CSS Custom Properties
All design tokens are also exposed as CSS custom properties in `index.css` (`:root`).
Use `var(--color-brand-600)` when you need values outside Tailwind context.

---

## Rules
1. Tailwind-only styling — no inline styles
2. All components accept `className` for extension
3. Disabled: `opacity-50 cursor-not-allowed`
4. Loading: inline spinner + disabled
5. Error: red border + red helper text
6. Focus: `:focus-visible` ring (global), no outline on mouse click
7. Map pins: `aria-label` required
8. Use `.floating-panel` utility for any UI floating over the map
