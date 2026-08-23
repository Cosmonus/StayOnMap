// Indian land records, per city — because the record genuinely differs by state
// and one generic "Patta number" field would be wrong in five of the six states
// we operate in.
//
// Seven states, six land-record systems (Delhi has none — see below).
//
// What each option is, so nobody edits this list from memory:
//   Patta / Chitta        Tamil Nadu. Patta = ownership record; Chitta adds the
//                         classification (nanjai/wet vs punjai/dry).
//   A-khata / B-khata     Karnataka. A-khata is a legal, BBMP-approved property;
//                         B-khata is a tax record for an irregular one, and banks
//                         generally will not lend against it. This distinction is
//                         the single most consequential land fact in Bengaluru,
//                         which is why both are offered rather than one "khata".
//   7/12 (Satbara)        Maharashtra + Gujarat, rural/non-urban land.
//   Property Card (CTS)   Maharashtra, city-survey land inside urban limits.
//   Pahani / ROR          Telangana (issued through Dharani).
//   Porcha / LR khatian   West Bengal.
//   Freehold / Leasehold  Delhi has no patta system at all; ownership is the
//   / GPA                 deed type. GPA (general power of attorney) sales are
//                         common and are NOT ownership — offered so an owner can
//                         say so honestly rather than pick a wrong label.
//
// "Not available yet" is a first-class option everywhere on purpose: an owner
// mid-purchase who cannot produce a number should be able to say that instead
// of abandoning the listing or inventing one.

import { CITIES } from '@/config/cities'

const NOT_YET = { value: 'Not available yet', label: 'Not available yet', hint: 'You can add it before publishing later' }

const TAMIL_NADU = {
  typeLabel: 'Land record',
  options: [
    { value: 'Patta', label: 'Patta', hint: 'Ownership record from the Taluk office' },
    { value: 'Chitta', label: 'Chitta', hint: 'Ownership plus wet/dry classification' },
    { value: 'Patta + Chitta', label: 'Patta + Chitta', hint: 'Both on hand' },
    NOT_YET,
  ],
  numberLabel: 'Patta number',
  numberPlaceholder: '1234',
  conversionHint: 'Agricultural land needs a land-use change before you can build',
}

const KARNATAKA = {
  typeLabel: 'Khata type',
  options: [
    { value: 'A-khata', label: 'A-khata', hint: 'Legal and approved — banks will lend' },
    { value: 'B-khata', label: 'B-khata', hint: 'Tax record only; most banks will not lend' },
    { value: 'RTC (Pahani)', label: 'RTC / Pahani', hint: 'Revenue record for rural land' },
    NOT_YET,
  ],
  numberLabel: 'Khata number',
  numberPlaceholder: '1234/567',
  conversionHint: 'DC conversion is what turns agricultural land into buildable land',
}

const MAHARASHTRA = {
  typeLabel: 'Land record',
  options: [
    { value: '7/12 extract', label: '7/12 extract (Satbara)', hint: 'Village-level record for non-urban land' },
    { value: 'Property Card (CTS)', label: 'Property Card (CTS)', hint: 'City-survey record inside urban limits' },
    NOT_YET,
  ],
  numberLabel: 'Survey / CTS number',
  numberPlaceholder: '123/4A',
  conversionHint: 'An NA (non-agricultural) order is what permits construction',
}

const GUJARAT = {
  typeLabel: 'Land record',
  options: [
    { value: '7/12 extract', label: '7/12 extract', hint: 'Village form recording the holder' },
    { value: '8-A khata', label: '8-A khata', hint: 'Account of all land held by one owner' },
    NOT_YET,
  ],
  numberLabel: 'Survey / khata number',
  numberPlaceholder: '123/4',
  conversionHint: 'An NA order is what permits construction',
}

const TELANGANA = {
  typeLabel: 'Land record',
  options: [
    { value: 'Pahani / ROR', label: 'Pahani / ROR', hint: 'Record of Rights, issued through Dharani' },
    { value: 'Dharani record', label: 'Dharani record', hint: 'Current digital land record' },
    NOT_YET,
  ],
  numberLabel: 'Survey number',
  numberPlaceholder: '123/A',
  conversionHint: 'Agricultural land needs conversion before it can be built on',
}

const WEST_BENGAL = {
  typeLabel: 'Land record',
  options: [
    { value: 'Porcha (RoR)', label: 'Porcha (RoR)', hint: 'Record of Rights' },
    { value: 'LR khatian', label: 'LR khatian', hint: 'Land Reforms holding record' },
    NOT_YET,
  ],
  numberLabel: 'Khatian / plot number',
  numberPlaceholder: '1234',
  conversionHint: 'Conversion changes the recorded land classification',
}

const DELHI = {
  typeLabel: 'Ownership type',
  options: [
    { value: 'Freehold', label: 'Freehold', hint: 'Full ownership of land and structure' },
    { value: 'Leasehold (DDA)', label: 'Leasehold (DDA)', hint: 'Held on lease from the authority' },
    { value: 'Registered sale deed', label: 'Registered sale deed', hint: 'Registered transfer on record' },
    { value: 'GPA / Power of attorney', label: 'GPA / Power of attorney', hint: 'Not ownership — say so plainly if this is what you hold' },
    NOT_YET,
  ],
  numberLabel: 'Registration number',
  numberPlaceholder: 'Reg. 1234/2019',
  conversionHint: 'Land use is set by the DDA master plan, not by conversion',
}

// Keyed by STATE via CITIES[].state (2026-08-24 — it was a nine-entry BY_CITY
// table until the city list grew to 47). The land-record system is a fact
// about the state, so this is the honest key; the lookup still takes a city.
const BY_STATE = {
  'Tamil Nadu':  TAMIL_NADU,
  'Karnataka':   KARNATAKA,
  'Maharashtra': MAHARASHTRA,
  'Gujarat':     GUJARAT,
  'Telangana':   TELANGANA,
  'West Bengal': WEST_BENGAL,
  'Delhi':       DELHI,
}

// A city we don't have a record system written for. Never guessed at — the
// generic form asks for a document name in the owner's own words instead of
// putting a Tamil Nadu label on a Punjab plot.
const GENERIC = {
  typeLabel: 'Land record',
  options: [
    { value: 'Record of Rights', label: 'Record of Rights', hint: 'The state’s ownership record' },
    { value: 'Registered sale deed', label: 'Registered sale deed', hint: 'Registered transfer on record' },
    NOT_YET,
  ],
  numberLabel: 'Record number',
  numberPlaceholder: '1234',
  conversionHint: 'Agricultural land usually needs conversion before construction',
}

export function landRecordsFor(city) {
  const state = CITIES.find((c) => c.name === city)?.state
  return BY_STATE[state] ?? GENERIC
}

// Whether the survey/record block can be shown at all. Before a city is chosen
// there is no way to know what to call the record, so the block waits rather
// than asking for a "patta number" that may be the wrong words entirely.
export function hasLandRecords(city) {
  return Boolean(city)
}

export const CONVERSION_OPTIONS = [
  { value: 'Converted', label: 'Converted', hint: 'Cleared for non-agricultural use' },
  { value: 'Not converted', label: 'Not converted', hint: 'Still agricultural on the record' },
  { value: 'Not applicable', label: 'Not applicable', hint: 'Already a residential or commercial layout' },
]

// 13 and 30 years are the two searches lawyers actually order in India.
export const EC_YEAR_OPTIONS = [
  { value: 13, label: '13 years', hint: 'The standard search' },
  { value: 30, label: '30 years', hint: 'The thorough search most banks want' },
]
