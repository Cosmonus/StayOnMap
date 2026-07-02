import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { toast } from '@components/common/Toaster'
import Toggle from '@components/common/Toggle'
import ImageUploader from './ImageUploader'
import LocationPicker from './LocationPicker'
import { CITIES, CITY_NAMES, CITY_LIST_LABEL } from '@/config/cities'

const PROPERTY_TYPES  = ['APARTMENT', 'HOUSE', 'VILLA', 'PG', 'INDEPENDENT_HOUSE', 'COMMERCIAL']
const FURNISHED_OPTS  = ['UNFURNISHED', 'SEMI', 'FULLY']
const FURNISHED_LABEL = { UNFURNISHED: 'Unfurnished', SEMI: 'Semi-Furnished', FULLY: 'Fully Furnished' }
const FACING_OPTS     = [
  { value: 'EAST',  label: 'East'  },
  { value: 'WEST',  label: 'West'  },
  { value: 'NORTH', label: 'North' },
  { value: 'SOUTH', label: 'South' },
]

function Field({ label, error, children, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint  && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function SectionHeading({ children }) {
  return <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-2">{children}</p>
}

function fromProperty(p) {
  return {
    title:           p.title          ?? '',
    description:     p.description    ?? '',
    type:            p.type           ?? 'APARTMENT',
    furnished:       p.furnished      ?? 'UNFURNISHED',
    bhk:             p.bhk != null    ? String(p.bhk)            : '1',
    sharing:         p.sharing != null ? String(p.sharing)       : '1',
    sqft:            p.area != null   ? String(Number(p.area))   : '',
    floor:           p.floor != null  ? String(p.floor)          : '',
    totalFloors:     p.totalFloors != null ? String(p.totalFloors) : '',
    facingDirection: p.facingDirection ?? '',
    rent:            p.rent != null   ? String(Number(p.rent))   : '',
    deposit:         p.deposit != null ? String(Number(p.deposit)) : '',
    maintenance:     p.maintenance != null ? String(Number(p.maintenance)) : '',
    address:         p.address        ?? '',
    city:            p.city           ?? '',
    state:           p.state          ?? '',
    pincode:         p.pincode        ?? '',
    landmark:        p.landmark       ?? '',
    lat:             p.lat != null    ? Number(p.lat)            : null,
    lng:             p.lng != null    ? Number(p.lng)            : null,
    images:          p.images?.map(i => i.url) ?? [],
    amenityIds:      p.amenities?.map(a => a.amenityId ?? a.amenity?.id) ?? [],
    nonVegAllowed:   p.rules?.nonVegAllowed ?? false,
    smokingAllowed:  p.rules?.smokingAllowed ?? false,
    petsAllowed:     p.rules?.petsAllowed ?? false,
    bachelorAllowed: p.rules?.bachelorAllowed ?? true,
    visitorsAllowed: p.rules?.visitorsAllowed ?? true,
    alcoholAllowed:  p.rules?.alcoholAllowed ?? false,
    appointmentWindowStart: p.appointmentWindowStart ?? '',
    appointmentWindowEnd:   p.appointmentWindowEnd   ?? '',
  }
}

const WINDOW_SLOTS = Array.from({ length: 29 }, (_, i) => {
  const totalMins = 8 * 60 + i * 30
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

function WindowSlotLabel(t) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function validate(data) {
  const e = {}
  if (data.title.trim().length < 5)        e.title       = 'Min 5 characters'
  if (data.description.trim().length < 10) e.description = 'Min 10 characters'
  if (data.type === 'PG') {
    if (!data.sharing || Number(data.sharing) < 1) e.sharing = 'Required'
  } else {
    if (!data.bhk || Number(data.bhk) < 1) e.bhk = 'Required'
  }
  if (!data.rent || Number(data.rent) <= 0)               e.rent    = 'Must be positive'
  if (data.deposit === '' || Number(data.deposit) < 0)    e.deposit = 'Must be 0 or more'
  if (data.maintenance === '' || data.maintenance === undefined) e.maintenance = 'Required — enter 0 if none'
  else if (Number(data.maintenance) < 0) e.maintenance = 'Must be 0 or more'
  if (data.address.trim().length < 5)                     e.address = 'Min 5 characters'
  if (!CITY_NAMES.includes(data.city))                    e.city    = `Select a city — we're live in ${CITY_LIST_LABEL}`
  if (data.state.trim().length < 2)                       e.state   = 'Required'
  if (!/^\d{6}$/.test(data.pincode))                      e.pincode = 'Must be 6 digits'
  if (data.floor !== '' && data.totalFloors !== '' && Number(data.floor) > Number(data.totalFloors))
    e.floor = `Cannot exceed total floors (${data.totalFloors})`
  if (data.lat == null)                                   e.lat     = 'Pin location on the map'
  if (data.images.length < 1)                             e.images  = 'Add at least one photo'
  return e
}

export default function EditListingForm({ property, onSuccess }) {
  const qc = useQueryClient()
  const [data, setData]           = useState(() => fromProperty(property))
  const [errors, setErrors]       = useState({})
  const [submitError, setSubmitError] = useState('')
  const [activeTab, setActiveTab] = useState('basic')
  const [imageUploading, setImageUploading] = useState(false)

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: () => propertyService.getAmenities().then(r => r.data),
  })

  const { mutate: update, isPending } = useMutation({
    mutationFn: (payload) => propertyService.update(property.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      qc.invalidateQueries({ queryKey: ['property', property.id] })
      toast.success('Updated', 'Listing updated successfully')
      onSuccess?.()
    },
    onError: (err) => { setSubmitError(err.message ?? 'Failed to update listing'); toast.error('Error', err.message ?? 'Failed to update listing') },
  })

  function set(key, val) {
    setData(d => ({ ...d, [key]: val }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  function submit() {
    const e = validate(data)
    if (Object.keys(e).length) { setErrors(e); return }
    setSubmitError('')

    const payload = {
      title:       data.title.trim(),
      description: data.description.trim(),
      type:        data.type,
      furnished:   data.furnished,
      address:     data.address.trim(),
      city:        data.city.trim(),
      state:       data.state.trim(),
      pincode:     data.pincode.trim(),
      landmark:    data.landmark.trim() || undefined,
      lat:         data.lat,
      lng:         data.lng,
      rent:        Number(data.rent),
      deposit:     Number(data.deposit),
      images:      data.images,
      amenityIds:  data.amenityIds,
      ...(data.type === 'PG'
        ? { sharing: Number(data.sharing) }
        : { bhk: Number(data.bhk) }
      ),
      ...(data.sqft        && { area:             Number(data.sqft) }),
      ...(data.floor       && { floor:            Number(data.floor) }),
      ...(data.totalFloors && { totalFloors:      Number(data.totalFloors) }),
      ...(data.facingDirection && { facingDirection: data.facingDirection }),
      maintenance: Number(data.maintenance || 0),
      rules: {
        nonVegAllowed:   data.nonVegAllowed,
        smokingAllowed:  data.smokingAllowed,
        petsAllowed:     data.petsAllowed,
        bachelorAllowed: data.bachelorAllowed,
        visitorsAllowed: data.visitorsAllowed,
        alcoholAllowed:  data.alcoholAllowed,
      },
      ...(data.appointmentWindowStart && { appointmentWindowStart: data.appointmentWindowStart }),
      ...(data.appointmentWindowEnd   && { appointmentWindowEnd:   data.appointmentWindowEnd }),
    }
    update(payload)
  }

  const isPG = data.type === 'PG'
  const TABS = ['basic', 'location', 'photos', 'amenities']
  const TAB_LABEL = { basic: 'Basic Info', location: 'Location', photos: 'Photos', amenities: 'Amenities & Rules' }

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex border-b border-slate-100">
        {TABS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Tab: Basic Info */}
      {activeTab === 'basic' && (
        <div className="space-y-4">
          <Field label="Title *" error={errors.title}>
            <input value={data.title} onChange={e => set('title', e.target.value)} className="input" placeholder="e.g. Spacious 2 BHK in Koramangala" />
          </Field>
          <Field label="Description *" error={errors.description}>
            <textarea value={data.description} onChange={e => set('description', e.target.value)} rows={3} className="input resize-none" placeholder="Describe the property, surroundings, and unique features" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Type *" error={errors.type}>
              <select value={data.type} onChange={e => set('type', e.target.value)} className="input">
                {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Furnished *" error={errors.furnished}>
              <select value={data.furnished} onChange={e => set('furnished', e.target.value)} className="input">
                {FURNISHED_OPTS.map(f => <option key={f} value={f}>{FURNISHED_LABEL[f]}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {isPG ? (
              <Field label="Sharing *" error={errors.sharing}>
                <input type="number" min="1" max="6" value={data.sharing} onChange={e => set('sharing', e.target.value)} className="input" />
              </Field>
            ) : (
              <Field label="BHK *" error={errors.bhk}>
                <input type="number" min="1" max="10" value={data.bhk} onChange={e => set('bhk', e.target.value)} className="input" />
              </Field>
            )}
            <Field label="Area (sq.ft)" error={errors.sqft} hint="Built-up area">
              <input type="number" min="1" value={data.sqft} onChange={e => set('sqft', e.target.value)} placeholder="1100" className="input" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Unit Floor" error={errors.floor} hint="Which floor is this unit on?">
              <input type="number" min="0" max="200" value={data.floor} onChange={e => set('floor', e.target.value)} placeholder="4" className="input" />
            </Field>
            <Field label="Total Floors" error={errors.totalFloors} hint="Floors in the building">
              <input type="number" min="1" max="200" value={data.totalFloors} onChange={e => set('totalFloors', e.target.value)} placeholder="10" className="input" />
            </Field>
            <Field label="House Facing" error={errors.facingDirection}>
              <select value={data.facingDirection} onChange={e => set('facingDirection', e.target.value)} className="input">
                <option value="">Not specified</option>
                {FACING_OPTS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
          </div>

          <SectionHeading>Pricing</SectionHeading>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Rent / mo (₹) *" error={errors.rent}>
              <input type="number" min="0" value={data.rent} onChange={e => set('rent', e.target.value)} placeholder="28000" className="input" />
            </Field>
            <Field label="Deposit (₹) *" error={errors.deposit}>
              <input type="number" min="0" value={data.deposit} onChange={e => set('deposit', e.target.value)} placeholder="56000" className="input" />
            </Field>
            <Field label="Maintenance / mo (₹) *" error={errors.maintenance}>
              <input type="number" min="0" value={data.maintenance} onChange={e => set('maintenance', e.target.value)} placeholder="1500" className="input" />
            </Field>
          </div>
        </div>
      )}

      {/* Tab: Location */}
      {activeTab === 'location' && (
        <div className="space-y-4">
          <Field label="Full Address *" error={errors.address}>
            <input value={data.address} onChange={e => set('address', e.target.value)} placeholder="5th Cross, Koramangala" className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City *" error={errors.city} hint={`We're live in ${CITY_LIST_LABEL} — more cities opening soon`}>
              <select
                value={data.city}
                onChange={(e) => {
                  const city = e.target.value
                  set('city', city)
                  set('state', CITIES.find((c) => c.name === city)?.state ?? '')
                }}
                className="input"
              >
                <option value="">Select city</option>
                {CITY_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </Field>
            <Field label="State *" error={errors.state}>
              <input value={data.state} readOnly placeholder="Auto-filled" className="input bg-slate-50 cursor-not-allowed" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pincode *" error={errors.pincode}>
              <input value={data.pincode} onChange={e => set('pincode', e.target.value)} placeholder="560034" maxLength={6} className="input" />
            </Field>
            <Field label="Landmark">
              <input value={data.landmark} onChange={e => set('landmark', e.target.value)} placeholder="Near bus stop" className="input" />
            </Field>
          </div>
          <Field label="Pin on Map *" error={errors.lat}>
            <LocationPicker
              value={data.lat != null ? { lat: data.lat, lng: data.lng } : null}
              onChange={({ lat, lng }) => { set('lat', lat); set('lng', lng) }}
            />
          </Field>
        </div>
      )}

      {/* Tab: Photos */}
      {activeTab === 'photos' && (
        <div className="space-y-2">
          {errors.images && <p className="text-xs text-red-500">{errors.images}</p>}
          <ImageUploader value={data.images} onChange={urls => set('images', urls)} onUploadingChange={setImageUploading} />
        </div>
      )}

      {/* Tab: Amenities & Rules */}
      {activeTab === 'amenities' && (
        <div className="space-y-6">
          {/* Amenities */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Select all amenities available at this property.</p>
            <div className="grid grid-cols-2 gap-2">
              {amenities.map(a => {
                const checked = data.amenityIds.includes(a.id)
                return (
                  <label key={a.id} className="flex items-center gap-2 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => set('amenityIds', checked ? data.amenityIds.filter(id => id !== a.id) : [...data.amenityIds, a.id])}
                      className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0"
                    />
                    <span className="text-sm text-slate-700 truncate">{a.name}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Appointment Window */}
          <div className="border-t border-slate-100 pt-5">
            <p className="text-sm font-medium text-slate-700 mb-1">Visit Availability Window</p>
            <p className="text-xs text-slate-400 mb-3">Tenants can only request visits within this time range. Leave blank to allow all times.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
                <select value={data.appointmentWindowStart} onChange={e => set('appointmentWindowStart', e.target.value)} className="input">
                  <option value="">Any time</option>
                  {WINDOW_SLOTS.map(t => <option key={t} value={t}>{WindowSlotLabel(t)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
                <select value={data.appointmentWindowEnd} onChange={e => set('appointmentWindowEnd', e.target.value)} className="input">
                  <option value="">Any time</option>
                  {WINDOW_SLOTS.filter(t => !data.appointmentWindowStart || t > data.appointmentWindowStart).map(t => (
                    <option key={t} value={t}>{WindowSlotLabel(t)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* House Rules */}
          <div className="border-t border-slate-100 pt-5 space-y-2">
            <p className="text-sm font-medium text-slate-700 mb-3">House Rules</p>
            {[
              { key: 'nonVegAllowed',   label: 'Non-veg cooking',   desc: 'Tenants may cook non-vegetarian food' },
              { key: 'bachelorAllowed', label: 'Bachelors allowed', desc: 'Single tenants / bachelors welcome' },
              { key: 'visitorsAllowed', label: 'Visitors allowed',  desc: 'Guests may visit the property' },
              { key: 'smokingAllowed',  label: 'Smoking allowed',   desc: 'Smoking permitted on premises' },
              { key: 'alcoholAllowed',  label: 'Alcohol allowed',   desc: 'Alcohol consumption permitted' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
                <Toggle checked={data[key]} onChange={val => set(key, val)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {submitError && <p className="text-sm text-red-500">{submitError}</p>}

      {/* Save */}
      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={submit}
          disabled={isPending || imageUploading}
          className="px-6 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving…' : imageUploading ? 'Uploading photo…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
