import { useState } from 'react'
import { View, Text, TextInput, Pressable, Switch, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { placeIntelligenceService } from '@services/placeIntelligence.service'
import Dropdown from '@components/common/Dropdown'
import DatePickerSheet from '@features/filters/components/DatePickerSheet'
import PhotoBoard from './PhotoBoard'
import LocationPicker from '../LocationPicker'
import FieldControl, { toSelectOptions } from './FieldControl'
import AvailabilityCalendar from './AvailabilityCalendar'
import AreaPeek from './AreaPeek'
import LandRecordsBlock from './LandRecordsBlock'
import BenchmarkCard from './BenchmarkCard'
import PublishGate from './PublishGate'
import { CategoryCards } from './HostGates'
import Icon from '@components/common/Icon'
import { formatCurrency, imgUrl } from '@utils/format'
import { ALL_DAY_SLOTS, VISIT_SLOTS, timeOptions, formatTime } from '@utils/time'
import {
  CATEGORIES, DESCRIBE, FIELDS, FEATURES, FEATURES_VISIBLE, RULES,
  pricingRows, termRows, pricingModes, resolveMode, MODE_COPY,
  TITLE_HINTS, DESC_PROMPTS, PHOTO_HINTS,
} from '../../config/onboarding.js'
import { CITIES, CITY_NAMES, CITY_LIST_LABEL } from '@config/cities'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// The steps, in the same order and with the same questions as web
// (frontend/.../onboarding/steps/). Layout differs — one column, sheets
// instead of side panels, and web's step 1 split in two (config/wizardSteps.js)
// — capability does not.

function Head({ title, sub }) {
  return (
    <View style={styles.head}>
      <Text style={styles.headTitle}>{title}</Text>
      {!!sub && <Text style={styles.headSub}>{sub}</Text>}
    </View>
  )
}

function Label({ children }) {
  return <Text style={styles.fieldLabel}>{children}</Text>
}

function Section({ children }) {
  return <Text style={styles.section}>{children}</Text>
}

// Slots and their 12-hour labels come from @utils/time — the one vocabulary
// shared with the visit-request and suggest-a-time flows (and with web). A
// curfew listed "22:30" beside a visit slot listed "10:30 PM" is one listing
// describing itself two ways.
function TimeDropdown({ label, value, onChange, placeholder = 'Select time', slots = ALL_DAY_SLOTS, allowNone = false }) {
  const options = timeOptions(slots)
  return (
    <Dropdown
      label={label}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      options={allowNone ? [{ value: '', label: placeholder }, ...options] : options}
    />
  )
}

// Multi-select only. Single-choice questions are dropdowns (FieldControl.js) —
// a chip grid earns its space when you're picking many of thirty-five things
// and want to see what's on offer; it wastes it on "pick one of four".
function Chips({ opts, selected, onToggle }) {
  return (
    <View style={styles.chipRow}>
      {opts.map((name) => {
        const on = selected.includes(name)
        return (
          <Pressable
            key={name}
            onPress={() => onToggle(name)}
            style={[styles.chip, on && styles.chipActive]}
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <Text style={[styles.chipText, on && styles.chipTextActive]}>{name}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ── Step 1 ──────────────────────────────────────────────────────────
// The six categories, and nothing else. They shared a screen with the question
// they unlock until 2026-07-30 — six cards, a dropdown and up to five fields is
// one long phone scroll, and the choice driving all of it scrolled out of sight
// above its own consequences. See config/wizardSteps.js for why this is a
// mobile-only split.
export function TypeScreen({ categoryKey, onPickCategory }) {
  return (
    <View>
      <Head title="What are you listing?" sub="Your answer shapes every question after this one." />
      <CategoryCards activeKey={categoryKey} onPick={onPickCategory} />
    </View>
  )
}

// ── Step 2 ──────────────────────────────────────────────────────────
// Also the "Basic info" tab of EditListingScreen, which is where `typeLocked`
// comes from: a live listing becoming a different KIND of property is a relist,
// not an edit, so there the absence of a type picker needs explaining. In the
// wizard it doesn't — the picker is the screen you just came from.
export function BasicsScreen({ categoryKey, draft, setDraft, typeLocked = false }) {
  const describe = categoryKey ? DESCRIBE[categoryKey] : null
  const setField = (key, value) => setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }))

  return (
    <View>
      <Head
        title={`Your ${CATEGORIES[categoryKey]?.short.toLowerCase() ?? 'listing'}`}
        sub={typeLocked
          ? 'The basics renters filter on. Type can’t change on a live listing — relist instead.'
          : 'The basics renters filter on.'}
      />

      {describe && (
        <View style={{ gap: spacing.lg }}>
          {/* A dropdown, like every other single-choice question — the pill row
              this replaced wrapped to three lines on a narrow phone. */}
          <View>
            <Label>{describe.q}</Label>
            <Dropdown
              label={describe.q}
              value={draft.fields[describe.k]}
              onChange={(v) => setField(describe.k, v)}
              options={toSelectOptions(describe.opts)}
              placeholder="Select…"
            />
          </View>
          {FIELDS[categoryKey].map((f) => (
            <FieldControl key={f.k} field={f} values={draft.fields} onChange={setField} />
          ))}
        </View>
      )}
    </View>
  )
}

// What India Post says the typed pincode is — mirrors web's PincodeTruth. Same
// three states and the same deliberate silence: "directory unseeded" renders
// nothing, because "we cannot check" must never wear the clothes of a warning.
function PincodeTruth({ pincode, city }) {
  const valid = /^\d{6}$/.test(pincode ?? '')
  const { data } = useQuery({
    queryKey: ['pincode', pincode, city],
    queryFn: () => placeIntelligenceService.getPincode(pincode, city).then((r) => r.data),
    enabled: valid,
    staleTime: 24 * 60 * 60 * 1000, // pincodes change glacially
  })

  if (!valid || !data || !data.available) return null
  if (!data.found) {
    return <Text style={styles.warn}>India Post has no pincode {pincode} — double-check for a typo.</Text>
  }

  const office = data.found.offices?.[0]?.name
  const place = `${data.found.districts.join('/')}, ${data.found.state}`

  if (data.matchesCity === false) {
    return <Text style={styles.warn}>This pincode is in {place} — not {city}. Double-check before publishing.</Text>
  }
  return <Text style={styles.truth}>{office ? `${office} — ` : ''}{place} (India Post)</Text>
}

// ── Step 3 ──────────────────────────────────────────────────────────
export function LocationScreen({ categoryKey, draft, setDraft }) {
  const loc = draft.location
  const set = (key, value) => setDraft((d) => ({ ...d, location: { ...d.location, [key]: value } }))

  return (
    <View>
      <Head title="Where is it?" sub="Drop the pin exactly — every area report on your listing is calculated from this point." />
      {/* One field per row. A city dropdown beside a pincode box is ~150dp each
          on a 360dp phone, which truncates "Bengaluru" and the India Post line
          under it — the two things those fields exist to show. */}
      <View style={{ gap: spacing.lg }}>
        <View>
          <Label>Address</Label>
          <TextInput style={styles.input} value={loc.address} onChangeText={(v) => set('address', v)} placeholder="Door no, street, area" placeholderTextColor={colors.slate500} />
        </View>
        <View>
          <Label>City</Label>
          <Dropdown
            label="City"
            value={loc.city}
            options={CITY_NAMES.map((n) => ({ value: n, label: n }))}
            placeholder="Select city"
            onChange={(city) => { set('city', city); set('state', CITIES.find((c) => c.name === city)?.state ?? '') }}
          />
          <Text style={styles.truth}>We&apos;re live in {CITY_LIST_LABEL}</Text>
        </View>
        <View>
          <Label>Pincode</Label>
          <TextInput
            style={styles.input}
            value={loc.pincode}
            onChangeText={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))}
            placeholder="560095"
            placeholderTextColor={colors.slate500}
            keyboardType="numeric"
            maxLength={6}
          />
          <PincodeTruth pincode={loc.pincode} city={loc.city} />
        </View>
        <View>
          <Label>Nearest landmark (optional)</Label>
          <TextInput style={styles.input} value={loc.landmark} onChangeText={(v) => set('landmark', v)} placeholder="Opposite the bus stop" placeholderTextColor={colors.slate500} />
        </View>
        <View>
          <Label>Drop the pin</Label>
          <LocationPicker
            value={loc.lat != null ? { lat: loc.lat, lng: loc.lng } : null}
            onChange={({ lat, lng }) => setDraft((d) => ({ ...d, location: { ...d.location, lat, lng } }))}
          />
        </View>
        <AreaPeek lat={loc.lat} lng={loc.lng} />

        {categoryKey === 'land' && (
          <View style={{ marginTop: spacing.sm }}>
            <LandRecordsBlock draft={draft} setDraft={setDraft} />
          </View>
        )}
      </View>
    </View>
  )
}

// ── Step 4 ──────────────────────────────────────────────────────────
export function PhotosScreen({ categoryKey, draft, setDraft }) {
  return (
    <View>
      <Head title="Add photos" sub="The biggest factor in whether anyone enquires. Five or more, in daylight." />
      <Text style={styles.helperHint}>{PHOTO_HINTS[categoryKey]}</Text>
      <PhotoBoard value={draft.images} onChange={(urls) => setDraft((d) => ({ ...d, images: urls }))} />
    </View>
  )
}

// ── Step 5 ──────────────────────────────────────────────────────────
export function FeaturesScreen({ categoryKey, draft, setDraft }) {
  const [expanded, setExpanded] = useState(false)
  const f = FEATURES[categoryKey]
  const hidden = f.opts.length - FEATURES_VISIBLE
  const shown = expanded ? f.opts : f.opts.slice(0, FEATURES_VISIBLE)
  const hint = TITLE_HINTS[categoryKey]
  const rules = RULES[categoryKey] ?? []
  const answers = draft.rules ?? {}

  function toggleAmenity(name) {
    setDraft((d) => ({
      ...d,
      amenityNames: d.amenityNames.includes(name) ? d.amenityNames.filter((n) => n !== name) : [...d.amenityNames, name],
    }))
  }
  const setRule = (k, v) => setDraft((d) => ({ ...d, rules: { ...d.rules, [k]: v } }))

  return (
    <View style={{ gap: spacing.lg }}>
      <Head title="Features and the words renters read" sub="We have pre-written a title from what you have told us. Change it if you can do better." />

      <View>
        <Label>{f.label}</Label>
        <Chips opts={shown} selected={draft.amenityNames} onToggle={toggleAmenity} />
        {hidden > 0 && !expanded && (
          <Pressable
            onPress={() => setExpanded(true)}
            style={styles.moreButton}
            accessibilityRole="button"
            accessibilityLabel={`Show ${hidden} more amenities`}
          >
            <Icon name="plus" size={16} color={colors.brand700} />
            <Text style={styles.moreText}>{hidden} more</Text>
          </Pressable>
        )}
      </View>

      {rules.length > 0 && (
        <View>
          <Label>House rules</Label>
          <Text style={styles.blockHint}>Renters filter on these, so an unanswered rule keeps you out of their results.</Text>
          {rules.map((r, i) =>
            r.t === 'time' ? (
              <View key={r.k} style={{ marginTop: spacing.md }}>
                <TimeDropdown label={r.label} value={answers[r.k]} onChange={(v) => setRule(r.k, v)} placeholder="No curfew" allowNone />
                <Text style={styles.truth}>{r.label} — {r.hint}</Text>
              </View>
            ) : (
              <View key={r.k} style={[styles.ruleRow, i === rules.length - 1 && styles.ruleRowLast]}>
                <Text style={styles.ruleLabel}>{r.label}</Text>
                <Switch
                  value={!!answers[r.k]}
                  onValueChange={(v) => setRule(r.k, v)}
                  trackColor={{ true: colors.brand600, false: colors.slate200 }}
                  accessibilityLabel={r.label}
                />
              </View>
            )
          )}
        </View>
      )}

      <View>
        <Label>Listing title</Label>
        <TextInput
          style={styles.input}
          value={draft.title}
          onChangeText={(v) => setDraft((d) => ({ ...d, title: v.slice(0, 100) }))}
          placeholder={hint.placeholder}
          placeholderTextColor={colors.slate500}
        />
        <Text style={styles.truth}>
          {draft.titlePrefilled ? 'Pre-filled from type, size and locality · ' : `e.g. “${hint.example}” · `}
          {draft.title.length} of 100
        </Text>
      </View>

      <View>
        <Label>Description</Label>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={draft.description}
          onChangeText={(v) => setDraft((d) => ({ ...d, description: v.slice(0, 2000) }))}
          multiline
          numberOfLines={5}
          placeholder="Describe the space, the light, the neighbourhood…"
          placeholderTextColor={colors.slate500}
        />
        <View style={styles.promptList}>
          {DESC_PROMPTS[categoryKey].map((p) => (
            <Text key={p} style={styles.promptLine}>· {p}</Text>
          ))}
        </View>
      </View>
    </View>
  )
}

function Money({ label, value, onChange, ph }) {
  return (
    <View>
      <Label>{label}</Label>
      <View style={styles.priceInputWrap}>
        <Text style={styles.priceSymbol}>₹</Text>
        <TextInput
          style={styles.priceInput}
          value={value ?? ''}
          onChangeText={(v) => onChange(v.replace(/\D/g, ''))}
          placeholder={ph}
          placeholderTextColor={colors.slate500}
          keyboardType="numeric"
          accessibilityLabel={label}
        />
      </View>
    </View>
  )
}

// ── Step 6 ──────────────────────────────────────────────────────────
export function PriceScreen({ categoryKey, draft, setDraft }) {
  const [datePickerFor, setDatePickerFor] = useState(null)
  // Land's mode comes from its own "Sale or lease?" answer on step 1, so it gets
  // no picker here — see resolveMode().
  const mode = resolveMode(categoryKey, draft)
  const modes = pricingModes(categoryKey)
  const isLease = mode === 'LEASE'
  const isSale = mode === 'SALE'
  const isStay = categoryKey === 'stay'
  const rows = pricingRows(categoryKey, mode)
  const terms = termRows(categoryKey, mode)

  const setPrice = (k, v) => setDraft((d) => ({ ...d, pricing: { ...d.pricing, [k]: v } }))
  const setTerm = (k, v) => setDraft((d) => ({ ...d, terms: { ...d.terms, [k]: v } }))
  // Switching modes clears the money fields AND the terms: the rows differ
  // between modes, so a ₹28,000 monthly rent left behind in `rent` would
  // silently become a ₹28,000 asking price, and an 11-month minimum stay would
  // ride along onto a sale.
  const setMode = (pricingModel) => setDraft((d) => ({ ...d, pricingModel, pricing: {}, terms: {} }))

  return (
    <View style={{ gap: spacing.lg }}>
      <Head
        title={isSale ? 'Set your asking price' : 'Set your price'}
        sub="Priced with the locality beside you, not after you publish."
      />

      {modes.length > 1 && (
        <View>
          <Label>How are you offering it?</Label>
          <View style={styles.modeRow}>
            {modes.map((value) => {
              const m = MODE_COPY[value]
              const active = mode === value
              return (
                <Pressable
                  key={value}
                  onPress={() => setMode(value)}
                  style={[styles.modeCard, active && styles.modeCardActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Offer as ${m.label}`}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{m.label}</Text>
                  <Text style={styles.modeHint}>{m.hint}</Text>
                </Pressable>
              )
            })}
          </View>
          {isLease && (
            <Text style={styles.modeNote}>
              You&apos;ll hold the lease amount for the full term and return it when the tenant leaves.
              No monthly rent and no separate deposit.
            </Text>
          )}
          {isSale && (
            <Text style={styles.modeNote}>
              Buyers request a site visit the same way renters do. A sale has no rent, no deposit
              and no lease agreement — only the advance you take to hold it.
            </Text>
          )}
        </View>
      )}

      <View style={{ gap: spacing.md }}>
        {rows.map(([key, label, ph]) => (
          <Money key={key} label={label} value={draft.pricing[key]} onChange={(v) => setPrice(key, v)} ph={ph} />
        ))}
      </View>

      <BenchmarkCard categoryKey={categoryKey} draft={draft} />

      <View style={styles.toggleCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>Zero brokerage</Text>
          <Text style={styles.toggleBody}>Shown as a badge on your listing. Turn it off only if you charge a fee.</Text>
        </View>
        <Switch
          value={draft.zeroBrokerage !== false}
          onValueChange={(v) => setDraft((d) => ({ ...d, zeroBrokerage: v, brokerage: v ? '' : d.brokerage }))}
          trackColor={{ true: colors.brand600, false: colors.slate200 }}
          accessibilityLabel="Zero brokerage"
        />
      </View>
      {draft.zeroBrokerage === false && (
        <Money label="Brokerage you charge" value={draft.brokerage} onChange={(v) => setDraft((d) => ({ ...d, brokerage: v }))} ph="15000" />
      )}

      {/* This step carries three separate decisions — the price, the terms, and
          when people can come. Headings so the scroll reads as three chunks
          rather than one long column of boxes. */}
      <Section>Availability &amp; terms</Section>

      <View style={{ gap: spacing.md }}>
        {terms.map((t) => (
          <View key={t.k}>
            {t.t === 'bool' ? (
              <View style={styles.toggleCard}>
                <Text style={styles.toggleLabelInline}>{t.label}</Text>
                <Switch
                  value={!!draft.terms?.[t.k]}
                  onValueChange={(v) => setTerm(t.k, v)}
                  trackColor={{ true: colors.brand600, false: colors.slate200 }}
                  accessibilityLabel={t.label}
                />
              </View>
            ) : t.t === 'seg' ? (
              <>
                <Label>{t.label}</Label>
                <Dropdown
                  label={t.label}
                  value={draft.terms?.[t.k]}
                  onChange={(v) => setTerm(t.k, v)}
                  options={t.opts.map(([value, label]) => ({ value, label }))}
                  placeholder="Select…"
                />
              </>
            ) : t.t === 'date' ? (
              <>
                <Label>{t.label}</Label>
                <Pressable style={styles.input} onPress={() => setDatePickerFor(t)} accessibilityRole="button" accessibilityLabel={t.label}>
                  <Text style={draft.terms?.[t.k] ? styles.inputValue : styles.inputPlaceholder}>
                    {draft.terms?.[t.k] || 'Select a date'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Label>{t.label}</Label>
                <View style={styles.priceInputWrap}>
                <TextInput
                  style={styles.priceInput}
                  value={draft.terms?.[t.k] ?? ''}
                  onChangeText={(v) => setTerm(t.k, v.replace(/\D/g, ''))}
                  placeholder={t.ph}
                  placeholderTextColor={colors.slate500}
                  keyboardType="numeric"
                  accessibilityLabel={t.label}
                />
                  {!!t.suf && <Text style={styles.priceSuffix}>{t.suf}</Text>}
                </View>
              </>
            )}
          </View>
        ))}
      </View>

      <Section>{isStay ? 'Booking' : 'Visits'}</Section>

      {isStay ? (
        <View style={{ gap: spacing.md }}>
          <View style={styles.toggleCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Instant book</Text>
              <Text style={styles.toggleBody}>Guests can book without waiting for approval</Text>
            </View>
            <Switch
              value={!!draft.instantBook}
              onValueChange={(v) => setDraft((d) => ({ ...d, instantBook: v }))}
              trackColor={{ true: colors.brand600, false: colors.slate200 }}
              accessibilityLabel="Instant book"
            />
          </View>
          <AvailabilityCalendar blockedDates={draft.blockedDates} onChange={(dates) => setDraft((d) => ({ ...d, blockedDates: dates }))} />
        </View>
      ) : (
        <View>
          <Label>{isSale ? 'When can buyers visit?' : 'When can renters visit?'}</Label>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <TimeDropdown
                label="Visits from"
                value={draft.appointmentWindowStart}
                onChange={(v) => setDraft((d) => ({ ...d, appointmentWindowStart: v }))}
                placeholder="From"
                slots={VISIT_SLOTS}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TimeDropdown
                label="Visits until"
                value={draft.appointmentWindowEnd}
                onChange={(v) => setDraft((d) => ({ ...d, appointmentWindowEnd: v }))}
                placeholder="Until"
                slots={VISIT_SLOTS}
              />
            </View>
          </View>
          <Text style={styles.truth}>We offer {isSale ? 'buyers' : 'renters'} slots inside this window.</Text>
        </View>
      )}

      <DatePickerSheet
        visible={!!datePickerFor}
        title={datePickerFor?.label ?? ''}
        value={datePickerFor ? draft.terms?.[datePickerFor.k] : null}
        onSelect={(date) => { setTerm(datePickerFor.k, date); setDatePickerFor(null) }}
        onClose={() => setDatePickerFor(null)}
      />
    </View>
  )
}

// ── Step 7 ──────────────────────────────────────────────────────────
// The renter's view of the same data, at the top of the step. An owner who can
// see how thin their listing looks fixes it here, not after nobody enquires.
function RenterPreview({ categoryKey, draft, price, priceSuffix }) {
  const cat = CATEGORIES[categoryKey]
  const describeValue = draft.fields[DESCRIBE[categoryKey].k]
  const specs = [
    categoryKey === 'apartment' ? `${describeValue ?? '—'} BHK` : describeValue,
    draft.fields.furnished && { FULLY: 'Fully furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }[draft.fields.furnished],
    draft.fields.area && `${draft.fields.area} sq.ft`,
    draft.fields.carpetArea && `${draft.fields.carpetArea} sq.ft carpet`,
    draft.fields.extent && `${draft.fields.extent} ${draft.fields.extentUnit || 'sq.ft'}`,
  ].filter(Boolean)

  return (
    <View style={styles.previewCard}>
      <View style={styles.previewImage}>
        {draft.images[0]
          ? (
            // Same defect PhotoBoard had: the raw url is the ~1600px `_full`
            // variant, fetched with no disk cache, into a preview card. It
            // showed as a grey tile for as long as the download took.
            <Image
              source={{ uri: imgUrl(draft.images[0], 'card') }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          )
          : <Icon name="image" size={28} color={colors.slate500} />}
      </View>
      <View style={{ padding: spacing.md }}>
        <Text style={styles.previewPrice}>
          {price ? formatCurrency(price) : '—'}
          <Text style={styles.previewPriceSuffix}>{priceSuffix}</Text>
        </Text>
        <Text style={styles.previewTitle}>{draft.title || `New ${cat.label} listing`}</Text>
        <Text style={styles.previewSpecs}>{specs.join(' · ') || cat.long}</Text>
      </View>
    </View>
  )
}

export function ReviewScreen({ categoryKey, draft, missing = [], onJump, profile }) {
  const cat = CATEGORIES[categoryKey]
  const mode = resolveMode(categoryKey, draft)
  const [priceKey, priceRowLabel] = pricingRows(categoryKey, mode)[0]
  const price = Number(draft.pricing[priceKey] || 0)
  // Mirrors utils/format.js's priceUnit, from the draft rather than a saved
  // property: nothing may suffix this number without knowing the mode.
  const priceSuffix = categoryKey === 'stay' ? '/night' : mode === 'SALE' ? '' : mode === 'LEASE' ? ' lease' : '/mo'
  const describeValue = draft.fields[DESCRIBE[categoryKey].k]
  const missingProfile = profile?.missingProfileFields ?? []
  const visits = draft.appointmentWindowStart && draft.appointmentWindowEnd
    ? `${formatTime(draft.appointmentWindowStart)} – ${formatTime(draft.appointmentWindowEnd)}`
    : 'Not set'

  const rows = [
    ['Type', [cat.short, describeValue ?? '—'].join(' · '), 'basics'],
    ['Location', [draft.location.landmark || draft.location.address, draft.location.city].filter(Boolean).join(', ') || '—', 'location'],
    ['Photos', draft.images.length ? `${draft.images.length} · cover set` : 'None yet', 'photos'],
    ['Amenities', draft.amenityNames.length ? `${draft.amenityNames.slice(0, 2).join(', ')}${draft.amenityNames.length > 2 ? ` +${draft.amenityNames.length - 2}` : ''}` : 'None selected', 'features'],
    [priceRowLabel, price ? `${formatCurrency(price)}${priceSuffix}` : '—', 'pricing'],
    // Short-stay has no visit window — guests book, they don't request a viewing.
    ...(categoryKey === 'stay' ? [] : [['Visits', visits, 'pricing']]),
  ]

  return (
    <View>
      <Head title="Check it over" sub="This is how it will read on the map." />

      <RenterPreview categoryKey={categoryKey} draft={draft} price={price} priceSuffix={priceSuffix} />

      {missing.length > 0 && (
        <View style={styles.missingBlock}>
          <Text style={styles.missingTitle}>
            {missing.length} {missing.length === 1 ? 'thing' : 'things'} left before publish
          </Text>
          {missing.map((m, i) => (
            <Pressable
              key={i}
              onPress={() => onJump?.(m.stepK)}
              style={styles.missingChip}
              accessibilityRole="button"
              accessibilityLabel={`${m.label} — go to that step`}
            >
              <Text style={styles.missingChipText}>{m.label}</Text>
              <Icon name="chevronRight" size={16} color={colors.warning700} />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.reviewCard}>
        {rows.map(([label, value, stepK], i) => (
          <View key={label} style={[styles.factRow, i < rows.length - 1 && styles.factRowBorder]}>
            <Text style={styles.factLabel}>{label}</Text>
            <Text style={styles.factValue} numberOfLines={1}>{value}</Text>
            <Pressable onPress={() => onJump?.(stepK)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Edit ${label}`}>
              <Text style={styles.editLink}>Edit</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {missingProfile.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <PublishGate missing={missingProfile} profile={profile} />
        </View>
      )}

    </View>
  )
}

const styles = StyleSheet.create({
  head: { marginBottom: spacing.lg },
  headTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.slate800 },
  headSub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, marginTop: spacing.sm, lineHeight: 20 },
  fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700, marginBottom: spacing.xs },
  section: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800, marginTop: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800, minHeight: 48, justifyContent: 'center' },
  inputValue: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  inputPlaceholder: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500 },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  warn: { fontFamily: fonts.body, fontSize: 11, color: colors.warning700, marginTop: 4 },
  truth: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: 4, lineHeight: 16 },
  helperHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginBottom: spacing.md, lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.brand50, borderColor: colors.brand600 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700 },
  chipTextActive: { color: colors.brand700 },
  moreButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    minHeight: 48, marginTop: spacing.sm, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.brand100, backgroundColor: colors.brand50,
  },
  moreText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  ruleRowLast: { borderBottomWidth: 0 },
  blockHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginBottom: spacing.xs, lineHeight: 18 },
  ruleLabel: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate700 },
  promptList: { marginTop: spacing.sm, gap: 4 },
  promptLine: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, lineHeight: 16 },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeCard: { flex: 1, minHeight: 48, justifyContent: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white },
  modeCardActive: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  modeLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700 },
  modeLabelActive: { fontFamily: fonts.bodySemiBold, color: colors.brand700 },
  modeHint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: 2 },
  modeNote: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600, marginTop: spacing.sm, lineHeight: 18 },
  priceInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 48 },
  priceSymbol: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate500, marginRight: 4 },
  priceSuffix: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate500, marginLeft: 4 },
  priceInput: { flex: 1, paddingVertical: spacing.sm + 4, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  toggleCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, padding: spacing.md, backgroundColor: colors.slate50, borderRadius: radius.lg },
  toggleLabelInline: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate700 },
  toggleTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  toggleBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600, marginTop: 2, lineHeight: 18 },
  previewCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md },
  previewImage: { aspectRatio: 1.6, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  previewPrice: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate900 },
  previewPriceSuffix: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500 },
  previewTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800, marginTop: 2 },
  previewSpecs: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
  missingBlock: { backgroundColor: colors.warning50, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  missingTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.warning700 },
  missingChip: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warning,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  missingChipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.warning700, flexShrink: 1 },
  reviewCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.lg, overflow: 'hidden' },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, minHeight: 52 },
  factRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  factLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, width: 74 },
  factValue: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  editLink: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
})
