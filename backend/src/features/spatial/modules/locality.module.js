// Locality — "where is this, administratively?"
//
// Every other module in this layer answers what is NEAR a place. This one
// answers what the place IS: which ward, which zone, which municipality.
//
// That matters more in India than the thinness of the card suggests. A ward is
// the unit that decides which civic body collects the rubbish, which water
// connection applies, and which councillor a complaint goes to — and it is the
// unit essentially all Indian open civic data is published against. So this
// module is both something a renter can use today and the join key that makes
// ward-level demographics possible later, which is why boundary GEOMETRY is
// stored rather than just the resolved name.
//
// Honesty note specific to this module: OSM ward coverage in India is uneven.
// Chennai and Bengaluru are mapped to ward level; several supported cities stop
// at municipality. The declared inputs below make that visible as reduced
// confidence rather than as a card that quietly shows less.
//
// See docs/spatial-intelligence.md §5.9.
import { fact, PROVENANCE } from '../envelope.js'
import { boundariesAt } from '../boundaryLookup.js'
import { OSM_SOURCE } from '../providers.js'
import { ALL_TYPES } from '../propertyTypes.js'

// Below this, a boundary is too coarse to tell two listings in the same city
// apart, so it is context rather than a finding.
const LOCAL_LEVEL = 8

export default {
  key: 'locality',
  version: 1,
  // Knowing which ward you are in is type-agnostic: a shop's trade licence, a
  // plot's approval authority and a flat's water connection all follow it.
  appliesTo: ALL_TYPES,
  ttlHours: 60 * 24, // municipal boundaries change on a multi-year cadence
  // Polygon containment against surveyed boundaries — no model in the middle.
  maxConfidence: 1,

  inputs: [
    { key: 'admin_boundaries', weight: 2 }, // municipality/district level
    { key: 'ward_boundaries',  weight: 3 }, // the level that is actually useful
    // Declared, absent. This is the payoff the geometry is stored for, and
    // until it lands the module should not read as a complete answer.
    { key: 'ward_demographics', weight: 2 }, // needs a data.gov.in ward dataset
  ],

  async compute({ lat, lng }) {
    const hits = await boundariesAt(lat, lng)

    if (hits === null) {
      return {
        facts: [],
        assessment: null,
        missing: ['We could not look up administrative areas for this location.', ...DEFERRED_NOTES],
        inputsPresent: [],
        sources: [],
      }
    }

    if (!hits.length) {
      return {
        facts: [],
        assessment: null,
        missing: [
          // The distinction this layer exists to preserve, stated plainly:
          // unmapped is not the same as nonexistent.
          'No administrative boundaries are mapped for this location yet. Every ' +
          'place in India sits in a ward — this one simply has not been drawn in ' +
          'OpenStreetMap.',
          ...DEFERRED_NOTES,
        ],
        inputsPresent: [],
        sources: [],
      }
    }

    const facts = hits.map((b) => fact({
      key: `admin_${b.adminLevel}`,
      label: b.label,
      value: b.name,
      display: b.nameLocal && b.nameLocal !== b.name ? `${b.name} (${b.nameLocal})` : b.name,
      // A surveyed boundary, recorded by a mapper. Containment adds arithmetic
      // but no assumption, so the fact is as measured as its source.
      provenance: PROVENANCE.MEASURED,
      source: 'openstreetmap',
    }))

    const inputsPresent = ['admin_boundaries']
    // Only claim the ward input when a genuinely local boundary was found.
    // A district-level match is not a ward, and counting it as one is how a
    // module ends up looking better mapped than it is.
    if (hits.some((b) => b.adminLevel >= 9)) inputsPresent.push('ward_boundaries')

    return {
      facts,
      assessment: assess(hits),
      missing: [
        ...(hits.some((b) => b.adminLevel >= 9) ? [] : [
          'Ward-level boundaries are not mapped here yet, so this shows the ' +
          'broader municipality rather than the specific ward.',
        ]),
        ...DEFERRED_NOTES,
      ],
      inputsPresent,
      sources: [OSM_SOURCE],
    }
  },
}

const DEFERRED_NOTES = [
  'Ward-level population, literacy and household data are not yet available. ' +
  'India publishes these against exactly these boundaries, so this is a matter ' +
  'of loading them, not of whether they exist.',
]

function assess(hits) {
  const local = hits.filter((b) => b.adminLevel >= LOCAL_LEVEL)
  const primary = local[0] ?? hits[0]
  const context = (local[1] ?? hits[1])?.name

  return {
    label: context ? `${primary.name}, ${context}` : primary.name,
    detail: `This address falls in ${primary.label.toLowerCase()} ${primary.name}` +
      (context ? `, within ${context}.` : '.') +
      ' That determines which civic body handles water, waste and local approvals here.',
  }
}
