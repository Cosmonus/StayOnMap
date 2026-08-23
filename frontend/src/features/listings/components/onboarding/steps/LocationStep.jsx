import { useQuery } from '@tanstack/react-query'
import Select from '@components/common/Select'
import { CITIES, CITY_OPTIONS, CITY_LIST_LABEL } from '@/config/cities'
import { placesService } from '@services/places.service'
import LocationPicker from '../../LocationPicker'
import AreaPeek from '../AreaPeek'
import LandRecordsBlock from '../LandRecordsBlock'
import { StepHead } from '../WizardChrome'
import { FieldLabel, Txt } from '../FieldControl'

// Step 2 — the pin is the product, so it gets half the screen.

// What India Post says the typed pincode is — so a typo dies here, in front of
// the owner, instead of reaching a moderator after publish.
//
// Three states and a deliberate silence:
//   matches / no city   → the ground truth, quietly confirming
//   contradicts city    → amber warning naming BOTH places
//   unknown pincode     → amber, phrased as "double-check" — a typo is far more
//                         likely than fraud, and this line talks to the owner
//   directory unseeded  → nothing at all. "We cannot check" must never wear
//                         the clothes of a warning.
function PincodeTruth({ pincode, city }) {
  const valid = /^\d{6}$/.test(pincode ?? '')
  const { data } = useQuery({
    queryKey: ['pincode', pincode, city],
    queryFn: () => placesService.getPincode(pincode, city).then((r) => r.data),
    enabled: valid,
    staleTime: 24 * 60 * 60 * 1000, // pincodes change glacially
  })

  if (!valid || !data || !data.available) return null

  if (!data.found) {
    return (
      <p className="text-xs text-amber-700 mt-1.5">
        India Post has no pincode {pincode} — double-check for a typo.
      </p>
    )
  }

  const office = data.found.offices?.[0]?.name
  const place = `${data.found.districts.join('/')}, ${data.found.state}`

  if (data.matchesCity === false) {
    return (
      <p className="text-xs text-amber-700 mt-1.5">
        This pincode is in {place} — not {city}. Double-check before publishing.
      </p>
    )
  }

  return <p className="text-xs text-slate-500 mt-1.5">{office ? `${office} — ` : ''}{place} (India Post)</p>
}

export default function LocationStep({ categoryKey, draft, setDraft }) {
  const loc = draft.location
  const set = (key, value) => setDraft((d) => ({ ...d, location: { ...d.location, [key]: value } }))

  return (
    <div>
      <StepHead
        title="Where is it?"
        sub="Drop the pin exactly — every area report on the listing is calculated from this point."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-5">
          <div>
            <FieldLabel>Address</FieldLabel>
            <Txt value={loc.address} onChange={(v) => set('address', v)} ph="Door no, street, area" label="Address" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>City</FieldLabel>
              <Select
                value={loc.city}
                onChange={(city) => {
                  set('city', city)
                  set('state', CITIES.find((c) => c.name === city)?.state ?? '')
                }}
                placeholder="Select city"
                options={CITY_OPTIONS}
                // Through Select's own `hint`, not a sibling <p>. A sibling sits
                // 6px below the trigger, which is exactly where the panel opens
                // — flush here rather than slicing, but the same latent overlap
                // that made the signup city field unreadable (bug 1, 2026-08-07).
                // Select owns the spacing so the two numbers cannot drift.
                hint={`Live in ${CITY_LIST_LABEL}`}
              />
            </div>
            <div>
              <FieldLabel>Pincode</FieldLabel>
              <Txt value={loc.pincode} onChange={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))} ph="560095" label="Pincode" />
              <PincodeTruth pincode={loc.pincode} city={loc.city} />
            </div>
          </div>

          <div>
            <FieldLabel>Nearest landmark <span className="font-normal text-slate-500">(optional)</span></FieldLabel>
            <Txt value={loc.landmark} onChange={(v) => set('landmark', v)} ph="Opposite the bus stop" label="Nearest landmark" />
          </div>

          <AreaPeek lat={loc.lat} lng={loc.lng} />
        </div>

        <div>
          <FieldLabel>Drop the pin</FieldLabel>
          <LocationPicker
            value={loc.lat != null ? { lat: loc.lat, lng: loc.lng } : null}
            onChange={({ lat, lng }) => setDraft((d) => ({ ...d, location: { ...d.location, lat, lng } }))}
          />
        </div>
      </div>

      {categoryKey === 'land' && (
        <>
          <hr className="my-8 border-slate-100" />
          <LandRecordsBlock draft={draft} setDraft={setDraft} />
        </>
      )}
    </div>
  )
}
