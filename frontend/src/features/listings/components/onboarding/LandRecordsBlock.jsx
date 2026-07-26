import Select from '@components/common/Select'
import Toggle from '@components/common/Toggle'
import { ShieldCheck } from 'lucide-react'
import { landRecordsFor, CONVERSION_OPTIONS, EC_YEAR_OPTIONS } from '@/config/landRecords'
import { FieldLabel, Txt } from './FieldControl'

// LAND only, and on the LOCATION step rather than step 1 — deliberately, twice
// over. A survey number IS location information: it is how the state identifies
// this exact piece of ground. And the labels can only be written once the city
// is known, because the record is called something different in each state
// (config/landRecords.js explains which and why).
//
// Before this block existed, a plot listing carried no identifier that could be
// checked against any government record — the first thing a buyer's lawyer asks
// for, and the thing our own land-intelligence module says out loud it cannot
// derive from a coordinate.
export default function LandRecordsBlock({ draft, setDraft }) {
  const city = draft.location.city
  const records = landRecordsFor(city)
  const f = draft.fields
  const set = (key, value) => setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }))

  if (!city) {
    return (
      <div className="p-4 rounded-2xl bg-slate-50">
        <p className="text-sm text-slate-600">
          Pick a city above and we&apos;ll ask for the right land record — patta, khata, 7/12 and
          porcha are all different documents, and we&apos;d rather ask by name.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-slate-900">Land records</h3>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
          What a buyer&apos;s lawyer will ask for first. Everything here is optional — say
          &ldquo;not available yet&rdquo; rather than guessing.
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50">
        <ShieldCheck size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        <p className="text-sm text-slate-600 leading-relaxed">
          Survey and record <strong className="font-semibold">numbers are never shown on your public
          listing</strong> — only our verification team sees them. Buyers see the record
          <em> type</em>, which is what tells them whether a bank will lend.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        <div>
          <FieldLabel>Survey number</FieldLabel>
          <Txt value={f.surveyNumber} onChange={(v) => set('surveyNumber', v)} ph="Sy. No. 12/3B" label="Survey number" />
        </div>
        <div>
          <FieldLabel>Subdivision <span className="font-normal text-slate-500">(optional)</span></FieldLabel>
          <Txt value={f.subdivisionNumber} onChange={(v) => set('subdivisionNumber', v)} ph="2A" label="Subdivision number" />
        </div>

        <div>
          <FieldLabel>{records.typeLabel}</FieldLabel>
          <Select
            value={f.landRecordType}
            onChange={(v) => set('landRecordType', v)}
            options={records.options}
            placeholder="Select…"
          />
        </div>
        <div>
          <FieldLabel>{records.numberLabel}</FieldLabel>
          <Txt
            value={f.landRecordNumber}
            onChange={(v) => set('landRecordNumber', v)}
            ph={records.numberPlaceholder}
            label={records.numberLabel}
          />
        </div>

        <div>
          <FieldLabel>Land use</FieldLabel>
          <Select
            value={f.conversionStatus}
            onChange={(v) => set('conversionStatus', v)}
            options={CONVERSION_OPTIONS}
            placeholder="Select…"
          />
          <p className="text-xs text-slate-500 mt-1.5">{records.conversionHint}</p>
        </div>
        <div>
          <FieldLabel>Government guideline value <span className="font-normal text-slate-500">(per unit)</span></FieldLabel>
          <Txt value={f.guidelineValue} onChange={(v) => set('guidelineValue', v.replace(/[^\d]/g, ''))} ph="3200" label="Guideline value" />
          <p className="text-xs text-slate-500 mt-1.5">The circle rate, not your asking price</p>
        </div>

        <div className="sm:col-span-2 flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex items-center justify-between gap-4 py-3 px-4 rounded-xl bg-slate-50 min-w-[280px]">
            <span className="text-sm text-slate-700">Encumbrance certificate on hand</span>
            <Toggle checked={!!f.ecAvailable} onChange={(v) => set('ecAvailable', v)} />
          </div>
          {f.ecAvailable && (
            <div className="min-w-[200px]">
              <FieldLabel>Years covered</FieldLabel>
              <Select
                value={f.ecYears}
                onChange={(v) => set('ecYears', v)}
                options={EC_YEAR_OPTIONS}
                placeholder="Select…"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
