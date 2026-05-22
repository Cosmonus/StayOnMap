import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { toast } from '@components/common/Toaster'
import Toggle from '@components/common/Toggle'
import ImageUploader from './ImageUploader'
import LocationPicker from './LocationPicker'

const STEPS = ['Basic Info', 'Location', 'Photos', 'Amenities & Rules']

const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'VILLA', 'PG', 'INDEPENDENT_HOUSE', 'COMMERCIAL']
const FURNISHED_OPTS = ['UNFURNISHED', 'SEMI', 'FULLY']
const FURNISHED_LABEL = { UNFURNISHED: 'Unfurnished', SEMI: 'Semi-Furnished', FULLY: 'Fully Furnished' }
const FACING_OPTS = [
  { value: 'EAST',  label: 'East'  },
  { value: 'WEST',  label: 'West'  },
  { value: 'NORTH', label: 'North' },
  { value: 'SOUTH', label: 'South' },
]

const INIT = {
  title: '', description: '', type: 'APARTMENT', furnished: 'UNFURNISHED',
  bhk: '1', sharing: '1',
  sqft: '', floor: '', totalFloors: '', facingDirection: '',
  rent: '', deposit: '', maintenance: '',
  landmark: '', address: '', city: '', state: '', pincode: '',
  lat: null, lng: null,
  images: [], amenityIds: [],
  nonVegAllowed: false, smokingAllowed: false, petsAllowed: false,
  bachelorAllowed: true, visitorsAllowed: true, alcoholAllowed: false,
  appointmentWindowStart: '', appointmentWindowEnd: '',
}

const WINDOW_SLOTS = Array.from({ length: 29 }, (_, i) => {
  const totalMins = 8 * 60 + i * 30
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

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

function StepBasic({ data, set, errors }) {
  const isPG = data.type === 'PG'
  return (
    <div className="space-y-4">

      {/* Title & Description */}
      <Field label="Title *" error={errors.title}>
        <input value={data.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Spacious 2 BHK in Koramangala" className="input" />
      </Field>
      <Field label="Description *" error={errors.description}>
        <textarea value={data.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Describe the property, surroundings, and unique features" className="input resize-none" />
      </Field>

      {/* Type & Furnished */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type *" error={errors.type}>
          <select value={data.type} onChange={(e) => set('type', e.target.value)} className="input">
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Furnished *" error={errors.furnished}>
          <select value={data.furnished} onChange={(e) => set('furnished', e.target.value)} className="input">
            {FURNISHED_OPTS.map((f) => <option key={f} value={f}>{FURNISHED_LABEL[f]}</option>)}
          </select>
        </Field>
      </div>

      {/* BHK / Sharing + Area */}
      <div className="grid grid-cols-2 gap-4">
        {isPG ? (
          <Field label="Sharing *" error={errors.sharing}>
            <input type="number" min="1" max="6" value={data.sharing} onChange={(e) => set('sharing', e.target.value)} className="input" />
          </Field>
        ) : (
          <Field label="BHK *" error={errors.bhk}>
            <input type="number" min="1" max="10" value={data.bhk} onChange={(e) => set('bhk', e.target.value)} className="input" />
          </Field>
        )}
        <Field label="Area (sq.ft)" error={errors.sqft} hint="Built-up area">
          <input type="number" min="1" value={data.sqft} onChange={(e) => set('sqft', e.target.value)} placeholder="1100" className="input" />
        </Field>
      </div>

      {/* Floor + Total Floors + Facing */}
      <div className="grid grid-cols-3 gap-4">
        <Field label="Unit Floor" error={errors.floor} hint="Which floor is this unit on?">
          <input type="number" min="0" max="200" value={data.floor} onChange={(e) => set('floor', e.target.value)} placeholder="4" className="input" />
        </Field>
        <Field label="Total Floors" error={errors.totalFloors} hint="Floors in the building">
          <input type="number" min="1" max="200" value={data.totalFloors} onChange={(e) => set('totalFloors', e.target.value)} placeholder="10" className="input" />
        </Field>
        <Field label="House Facing" error={errors.facingDirection}>
          <select value={data.facingDirection} onChange={(e) => set('facingDirection', e.target.value)} className="input">
            <option value="">Not specified</option>
            {FACING_OPTS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Pricing */}
      <div className="pt-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Pricing</p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Rent / mo (₹) *" error={errors.rent}>
            <input type="number" min="0" value={data.rent} onChange={(e) => set('rent', e.target.value)} placeholder="28000" className="input" />
          </Field>
          <Field label="Deposit (₹) *" error={errors.deposit}>
            <input type="number" min="0" value={data.deposit} onChange={(e) => set('deposit', e.target.value)} placeholder="56000" className="input" />
          </Field>
          <Field label="Maintenance / mo (₹) *" error={errors.maintenance} hint="Enter 0 if not applicable">
            <input type="number" min="0" value={data.maintenance} onChange={(e) => set('maintenance', e.target.value)} placeholder="1500" className="input" />
          </Field>
        </div>
      </div>

    </div>
  )
}

function StepLocation({ data, set, errors }) {
  return (
    <div className="space-y-4">
      <Field label="Full Address *" error={errors.address}>
        <input value={data.address} onChange={(e) => set('address', e.target.value)} placeholder="5th Cross, Koramangala" className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="City *" error={errors.city}>
          <select
            value={data.city}
            onChange={(e) => {
              const city = e.target.value
              set('city', city)
              set('state', city === 'Bengaluru' ? 'Karnataka' : city === 'Chennai' ? 'Tamil Nadu' : '')
            }}
            className="input"
          >
            <option value="">Select city</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Chennai">Chennai</option>
          </select>
        </Field>
        <Field label="State *" error={errors.state}>
          <input value={data.state} readOnly placeholder="Auto-filled" className="input bg-slate-50 cursor-not-allowed" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Pincode *" error={errors.pincode}>
          <input value={data.pincode} onChange={(e) => set('pincode', e.target.value)} placeholder="560034" maxLength={6} className="input" />
        </Field>
        <Field label="Landmark">
          <input value={data.landmark} onChange={(e) => set('landmark', e.target.value)} placeholder="Near bus stop" className="input" />
        </Field>
      </div>
      <Field label="Pin on Map *" error={errors.lat}>
        <LocationPicker value={data.lat != null ? { lat: data.lat, lng: data.lng } : null} onChange={({ lat, lng }) => { set('lat', lat); set('lng', lng) }} />
      </Field>
    </div>
  )
}

function StepPhotos({ data, set, errors }) {
  return (
    <div className="space-y-2">
      {errors.images && <p className="text-xs text-red-500">{errors.images}</p>}
      <ImageUploader value={data.images} onChange={(urls) => set('images', urls)} />
    </div>
  )
}

function WindowSlotLabel(t) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function StepAmenitiesRules({ data, set, amenities }) {
  return (
    <div className="space-y-6">

      {/* Amenities */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">Select all amenities available at this property.</p>
        <div className="grid grid-cols-2 gap-2">
          {amenities.map((a) => {
            const checked = data.amenityIds.includes(a.id)
            return (
              <label key={a.id} className="flex items-center gap-2 cursor-pointer min-w-0">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => set('amenityIds', checked ? data.amenityIds.filter((id) => id !== a.id) : [...data.amenityIds, a.id])}
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
      <div className="border-t border-slate-100 pt-5">
        <p className="text-sm font-medium text-slate-700 mb-3">House Rules</p>
        <div className="space-y-2">
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
              <Toggle checked={data[key]} onChange={(val) => set(key, val)} />
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

function validate(step, data) {
  const e = {}
  if (step === 0) {
    if (data.title.trim().length < 5)       e.title = 'Min 5 characters'
    if (data.description.trim().length < 10) e.description = 'Min 10 characters'
    if (data.type === 'PG') {
      if (!data.sharing || Number(data.sharing) < 1) e.sharing = 'Required'
    } else {
      if (!data.bhk || Number(data.bhk) < 1) e.bhk = 'Required'
    }
    if (!data.rent || Number(data.rent) <= 0)         e.rent    = 'Must be positive'
    if (data.deposit === '' || Number(data.deposit) < 0) e.deposit = 'Must be 0 or more'
    if (data.sqft && Number(data.sqft) <= 0)          e.sqft    = 'Must be positive'
    if (data.totalFloors && Number(data.totalFloors) < 1) e.totalFloors = 'Must be at least 1'
    if (data.floor !== '' && data.totalFloors !== '' && Number(data.floor) > Number(data.totalFloors))
      e.floor = `Cannot exceed total floors (${data.totalFloors})`
    if (data.maintenance === '' || data.maintenance === undefined) e.maintenance = 'Required — enter 0 if none'
    else if (Number(data.maintenance) < 0) e.maintenance = 'Must be 0 or more'
  }
  if (step === 1) {
    if (data.address.trim().length < 5)                          e.address = 'Min 5 characters'
    if (!['Bengaluru', 'Chennai'].includes(data.city))          e.city    = 'Select Bengaluru or Chennai'
    if (data.state.trim().length < 2)                           e.state   = 'Required'
    if (!/^\d{6}$/.test(data.pincode))   e.pincode = 'Must be 6 digits'
    if (data.lat == null)                e.lat     = 'Pin location on the map'
  }
  if (step === 2) {
    if (data.images.length < 1) e.images = 'Add at least one photo'
  }
  return e
}

export default function AddListingForm({ onSuccess }) {
  const qc = useQueryClient()
  const [step, setStep]           = useState(0)
  const [data, setData]           = useState(INIT)
  const [errors, setErrors]       = useState({})
  const [submitError, setSubmitError] = useState('')

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: () => propertyService.getAmenities().then((r) => r.data),
  })

  const { mutate: create, isPending } = useMutation({
    mutationFn: (payload) => propertyService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success('Created', 'Your listing has been saved as a draft')
      onSuccess?.()
    },
    onError: (err) => { setSubmitError(err.message ?? 'Failed to create listing'); toast.error('Error', err.message ?? 'Failed to create listing') },
  })

  function set(key, val) {
    setData((d) => ({ ...d, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function next() {
    const e = validate(step, data)
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    setStep((s) => s + 1)
  }

  function back() {
    setErrors({})
    setStep((s) => s - 1)
  }

  function submit() {
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
    setSubmitError('')
    create(payload)
  }

  const isLast = step === STEPS.length - 1

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1 rounded-full ${i <= step ? 'bg-brand-600' : 'bg-slate-100'}`} />
            <p className={`text-xs mt-1 ${i === step ? 'text-brand-600 font-medium' : 'text-slate-400'}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div>
        {step === 0 && <StepBasic data={data} set={set} errors={errors} />}
        {step === 1 && <StepLocation data={data} set={set} errors={errors} />}
        {step === 2 && <StepPhotos data={data} set={set} errors={errors} />}
        {step === 3 && <StepAmenitiesRules data={data} set={set} amenities={amenities} />}
      </div>

      {submitError && <p className="text-sm text-red-500">{submitError}</p>}

      {/* Navigation */}
      <div className="flex justify-between pt-2 border-t border-slate-100">
        {step > 0 ? (
          <button type="button" onClick={back} className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors">
            ← Back
          </button>
        ) : (
          <div />
        )}
        {isLast ? (
          <button type="button" onClick={submit} disabled={isPending} className="px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {isPending ? 'Submitting…' : 'Submit for Review'}
          </button>
        ) : (
          <button type="button" onClick={next} className="px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700">
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
