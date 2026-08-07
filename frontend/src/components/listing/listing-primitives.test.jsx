/**
 * The listing primitives — Price, SpecLine, and the tables behind them.
 *
 * Two bugs are pinned here, both of the same shape: a per-type lookup with a
 * plausible-looking default HIDES a missing case instead of failing.
 *
 *   1. PropertyCard's private TYPE_LABEL had six of eight entries. LAND and
 *      SHORT_STAY resolved to undefined, `.filter(Boolean)` dropped them, and a
 *      plot in the browse grid simply had no type on it — indistinguishable
 *      from a design choice. Mobile hit the identical bug on its map pins
 *      (mobile/src/config/propertyTypes.test.js).
 *   2. Three surfaces each derived the "spec" line differently, so the same
 *      listing described itself in three ways: the popup knew about plots, PGs
 *      and stays; the grid card knew only BHK; the saved list knew BHK and
 *      sharing. Each was written for flats and left the other types to the
 *      generic branch, which for a plot is not plainer — it is absurd.
 *
 * CLAUDE.md's standing question is "does it work for all 6?", and the only way
 * to make that answer countable is to enumerate the enum.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TYPE_LABEL, TYPE_ICON, typeLabel, typeIcon } from '@/config/propertyTypes'
import { propertySpec } from '@utils/propertySpec'
import Price from './Price'
import SpecLine from './SpecLine'

// The PropertyType enum, verbatim from backend/prisma/schema.prisma. Restated
// rather than imported — the frontend cannot import the schema, and a hardcoded
// list that must be updated by hand is the point: it fails loudly on drift.
const PROPERTY_TYPES = [
  'APARTMENT', 'HOUSE', 'VILLA', 'PG',
  'INDEPENDENT_HOUSE', 'COMMERCIAL', 'LAND', 'SHORT_STAY',
]

describe('every property type has a word and a glyph', () => {
  it.each(PROPERTY_TYPES)('%s has a label', (type) => {
    expect(TYPE_LABEL[type]).toBeTruthy()
  })

  it.each(PROPERTY_TYPES)('%s has an icon', (type) => {
    expect(TYPE_ICON[type]).toBeTruthy()
  })

  it('calls a plot a Plot and a short stay a Stay', () => {
    // Not "Land" and "Short stay" — these are the words the wizard and search
    // use, and the enum name is not a user-facing string.
    expect(typeLabel('LAND')).toBe('Plot')
    expect(typeLabel('SHORT_STAY')).toBe('Stay')
  })

  it('returns null for an unknown type instead of a house', () => {
    // The fallback that caused bug 1 was `?? Home` / `?? 'Property'`: a real
    // value, so a missing category rendered as a plausible wrong one. Null is
    // visible at the call site.
    expect(typeLabel('SPACE_STATION')).toBeNull()
    expect(typeIcon('SPACE_STATION')).toBeNull()
    expect(typeLabel(undefined)).toBeNull()
  })
})

describe('the spec is the number that type actually cares about', () => {
  it('reads BHK for a flat, and does not lose a studio', () => {
    expect(propertySpec({ type: 'APARTMENT', bhk: 2 }).text).toBe('2 BHK')
    // bhk 0 is falsy — the reason every studio needs an explicit branch.
    expect(propertySpec({ type: 'APARTMENT', bhk: 0 }).text).toBe('Studio')
  })

  it('reads sharing for a PG', () => {
    expect(propertySpec({ type: 'PG', sharing: 3 }).text).toBe('3-sharing PG')
  })

  it('reads extent for a plot', () => {
    expect(propertySpec({ type: 'LAND', extent: 4, extentUnit: 'Grounds' }).text).toBe('4 grounds')
  })

  it('reads guests for a short stay', () => {
    expect(propertySpec({ type: 'SHORT_STAY', maxGuests: 6 }).text).toBe('Up to 6 guests')
  })

  it('reads carpet area for a shop', () => {
    expect(propertySpec({ type: 'COMMERCIAL', carpetArea: 900 }).text).toBe('900 sq.ft carpet')
  })

  it('never substitutes another type’s number when its own is missing', () => {
    // A plot with a bhk column set (they are all nullable on one table) must
    // not report "2 BHK" — the generic branch is exactly what this returns to
    // when a switch case is forgotten.
    expect(propertySpec({ type: 'LAND', bhk: 2 })).toBeNull()
    expect(propertySpec({ type: 'PG', bhk: 2 })).toBeNull()
    expect(propertySpec({ type: 'SHORT_STAY', bhk: 2 })).toBeNull()
  })
})

describe('SpecLine', () => {
  it('names the type for a plot, which the grid card never used to', () => {
    render(<SpecLine property={{ type: 'LAND', extent: 3, extentUnit: 'Cents' }} />)
    expect(screen.getByText(/3 cents · Plot/)).toBeInTheDocument()
  })

  it('reads as a sentence for a flat', () => {
    render(<SpecLine property={{ type: 'APARTMENT', bhk: 2, furnished: 'SEMI', area: 1050 }} />)
    expect(screen.getByText('2 BHK · Semi furnished · Apartment · 1,050 sq.ft')).toBeInTheDocument()
  })

  it('does not print a shop’s size twice', () => {
    // carpetArea is already the spec; `area` would render a second, different
    // square-footage beside it and read as two rooms.
    render(<SpecLine property={{ type: 'COMMERCIAL', carpetArea: 900, area: 1200 }} />)
    expect(screen.queryByText(/1,200/)).not.toBeInTheDocument()
  })

  it('still names the type when its own number is missing', () => {
    // A plot with no extent recorded is not nothing — "Plot" is the most
    // useful true thing left, and dropping the whole line to avoid a partial
    // one would hide the category as well.
    render(<SpecLine property={{ type: 'LAND' }} />)
    expect(screen.getByText('Plot')).toBeInTheDocument()
  })

  it('renders nothing rather than an empty line', () => {
    const { container } = render(<SpecLine property={{}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Price takes the property, never the number', () => {
  it('suffixes a monthly rent', () => {
    render(<Price property={{ rent: 28000, pricingModel: 'RENT' }} />)
    expect(screen.getByText('/mo')).toBeInTheDocument()
  })

  it('never says /mo on a LEASE lump sum', () => {
    // The one that costs real money: a ₹18,00,000 refundable lease deposit
    // shown as a monthly rent.
    render(<Price property={{ rent: 1800000, pricingModel: 'LEASE' }} />)
    expect(screen.getByText(/lease/)).toBeInTheDocument()
    expect(screen.queryByText('/mo')).not.toBeInTheDocument()
  })

  it('gives a SALE price no unit at all', () => {
    render(<Price property={{ rent: 9500000, pricingModel: 'SALE' }} />)
    expect(screen.queryByText('/mo')).not.toBeInTheDocument()
    expect(screen.queryByText(/lease/)).not.toBeInTheDocument()
  })

  it('prices a short stay per night whatever its pricing model says', () => {
    render(<Price property={{ rent: 3200, type: 'SHORT_STAY', pricingModel: 'RENT' }} />)
    expect(screen.getByText('/night')).toBeInTheDocument()
  })

  it('renders a free listing rather than swallowing a zero', () => {
    render(<Price property={{ rent: 0, pricingModel: 'RENT' }} />)
    expect(screen.getByText(/₹0/)).toBeInTheDocument()
  })
})
