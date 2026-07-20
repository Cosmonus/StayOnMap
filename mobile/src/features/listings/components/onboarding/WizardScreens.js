import { View, Text, TextInput, Pressable, Switch, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { placeIntelligenceService } from '@services/placeIntelligence.service'
import Dropdown from '@components/common/Dropdown'
import ImageUploader from '../ImageUploader'
import LocationPicker from '../LocationPicker'
import FieldControl from './FieldControl'
import AvailabilityCalendar from './AvailabilityCalendar'
import Icon from '@components/common/Icon'
import { CATEGORIES, DESCRIBE, FIELDS, FEATURES, PRICING, VERIFY } from '../../config/onboarding.js'
import { CITIES, CITY_NAMES, CITY_LIST_LABEL } from '@config/cities'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function Head({ kicker, title, sub }) {
  return (
    <View style={styles.head}>
      {!!kicker && <Text style={styles.kicker}>{kicker}</Text>}
      <Text style={styles.headTitle}>{title}</Text>
      {!!sub && <Text style={styles.headSub}>{sub}</Text>}
    </View>
  )
}

function setField(setDraft) {
  return (key, value) => setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }))
}

export function DescribeScreen({ categoryKey, draft, setDraft }) {
  const cat = CATEGORIES[categoryKey]
  const d = DESCRIBE[categoryKey]
  const value = draft.fields[d.k]
  return (
    <View>
      <Head kicker={cat.long} title={d.q} sub="This sets the shape of the rest of your listing." />
      <View style={{ gap: spacing.sm }}>
        {d.opts.map(([val, label, hint]) => {
          const on = value === val
          return (
            <Pressable
              key={val}
              onPress={() => setField(setDraft)(d.k, val)}
              style={[styles.optionCard, on && styles.optionCardActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Text style={styles.optionLabel}>{label}</Text>
              <Text style={styles.optionHint}>{hint}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function FieldsScreen({ categoryKey, draft, setDraft }) {
  return (
    <View>
      <Head title="A few key details" sub="These vary by property type — renters filter on exactly these." />
      {FIELDS[categoryKey].map((f) => (
        <FieldControl key={f.k} field={f} values={draft.fields} onChange={setField(setDraft)} />
      ))}
    </View>
  )
}

// What India Post says the typed pincode is — mirrors web's PincodeTruth, same
// day (users are mostly on mobile; a check that exists on one platform is a
// check most owners never see). Same three states and the same deliberate
// silence: "directory unseeded" renders nothing, because "we cannot check"
// must never wear the clothes of a warning.
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
    return (
      <Text style={pincodeStyles.warn}>
        India Post has no pincode {pincode} — double-check for a typo.
      </Text>
    )
  }

  const office = data.found.offices?.[0]?.name
  const place = `${data.found.districts.join('/')}, ${data.found.state}`

  if (data.matchesCity === false) {
    return (
      <Text style={pincodeStyles.warn}>
        This pincode is in {place} — not {city}. Double-check before publishing.
      </Text>
    )
  }

  return (
    <Text style={pincodeStyles.truth}>
      {office ? `${office} — ` : ''}{place} (India Post)
    </Text>
  )
}

const pincodeStyles = StyleSheet.create({
  // warning700, the same amber every other data caveat in the app uses.
  warn: { fontFamily: fonts.body, fontSize: 11, color: colors.warning700, marginTop: 4 },
  truth: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400, marginTop: 4 },
})

export function LocationScreen({ draft, setDraft }) {
  const loc = draft.location
  function set(key, value) { setDraft((d) => ({ ...d, location: { ...d.location, [key]: value } })) }
  return (
    <View>
      <Head kicker="Shared · core" title="Where is it?" sub="Address and an exact pin. The pin is what places you on the StayOnMap map." />
      <View style={{ gap: spacing.md }}>
        <View>
          <Text style={styles.fieldLabel}>Full address</Text>
          <TextInput style={styles.input} value={loc.address} onChangeText={(v) => set('address', v)} placeholder="Door no, street, area" placeholderTextColor={colors.slate400} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>City — live in {CITY_LIST_LABEL}</Text>
            <Dropdown
              value={loc.city}
              options={CITY_NAMES.map((n) => ({ value: n, label: n }))}
              placeholder="Select city"
              onChange={(city) => { set('city', city); set('state', CITIES.find((c) => c.name === city)?.state ?? '') }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Pincode</Text>
            <TextInput
              style={styles.input}
              value={loc.pincode}
              onChangeText={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))}
              placeholder="600028"
              placeholderTextColor={colors.slate400}
              keyboardType="numeric"
              maxLength={6}
            />
            <PincodeTruth pincode={loc.pincode} city={loc.city} />
          </View>
        </View>
        <View>
          <Text style={styles.fieldLabel}>Landmark (optional)</Text>
          <TextInput style={styles.input} value={loc.landmark} onChangeText={(v) => set('landmark', v)} placeholder="Near bus stop" placeholderTextColor={colors.slate400} />
        </View>
        <View>
          <Text style={styles.fieldLabel}>Drop the pin</Text>
          <LocationPicker value={loc.lat != null ? { lat: loc.lat, lng: loc.lng } : null} onChange={({ lat, lng }) => setDraft((d) => ({ ...d, location: { ...d.location, lat, lng } }))} />
        </View>
      </View>
    </View>
  )
}

export function FeaturesScreen({ categoryKey, draft, setDraft }) {
  const f = FEATURES[categoryKey]
  const selected = draft.amenityNames
  function toggle(name) {
    setDraft((d) => ({ ...d, amenityNames: selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name] }))
  }
  return (
    <View>
      <Head title={f.label} sub="Pick everything that applies. More detail means better matches." />
      <View style={styles.chipRow}>
        {f.opts.map((name) => {
          const on = selected.includes(name)
          return (
            <Pressable
              key={name}
              onPress={() => toggle(name)}
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
    </View>
  )
}

export function PhotosScreen({ draft, setDraft }) {
  return (
    <View>
      <Head kicker="Shared · core" title="Add some photos" sub="Add at least 5. The first is your cover — lead with the best light." />
      <ImageUploader value={draft.images} onChange={(urls) => setDraft((d) => ({ ...d, images: urls }))} />
    </View>
  )
}

export function TitleScreen({ draft, setDraft }) {
  return (
    <View>
      <Head title="Now, give it a title" sub="Short titles work best. You can always change it later." />
      <TextInput
        style={styles.input}
        value={draft.title}
        onChangeText={(v) => setDraft((d) => ({ ...d, title: v.slice(0, 100) }))}
        placeholder="e.g. Sunlit 2BHK steps from the beach"
        placeholderTextColor={colors.slate400}
      />
      <Text style={styles.charCount}>{draft.title.length}/100 characters</Text>
    </View>
  )
}

export function DescriptionScreen({ draft, setDraft }) {
  return (
    <View>
      <Head title="Create your description" sub="Tell renters what makes it special and what's nearby." />
      <TextInput
        style={[styles.input, styles.textarea]}
        value={draft.description}
        onChangeText={(v) => setDraft((d) => ({ ...d, description: v }))}
        multiline
        numberOfLines={5}
        placeholder="Describe the space, the light, the neighbourhood…"
        placeholderTextColor={colors.slate400}
      />
    </View>
  )
}

export function PricingScreen({ categoryKey, draft, setDraft }) {
  const rows = PRICING[categoryKey]
  const isStay = categoryKey === 'stay'
  function set(key, value) { setDraft((d) => ({ ...d, pricing: { ...d.pricing, [key]: value } })) }
  return (
    <View>
      <Head
        kicker={isStay ? 'Nightly' : 'Pricing'}
        title="Now, set your price"
        sub={isStay ? 'Your nightly rate plus fees — the calendar is unique to short-stay.' : 'Category-specific — land shows a sale price, PG a per-bed rate, commercial a lock-in.'}
      />
      <View style={{ gap: spacing.md }}>
        {rows.map(([key, label, ph]) => (
          <View key={key}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={styles.priceInputWrap}>
              <Text style={styles.priceSymbol}>₹</Text>
              <TextInput
                style={styles.priceInput}
                value={draft.pricing[key] ?? ''}
                onChangeText={(v) => set(key, v.replace(/\D/g, ''))}
                placeholder={ph}
                placeholderTextColor={colors.slate400}
                keyboardType="numeric"
              />
            </View>
          </View>
        ))}
      </View>
      {isStay && (
        <AvailabilityCalendar blockedDates={draft.blockedDates} onChange={(dates) => setDraft((d) => ({ ...d, blockedDates: dates }))} />
      )}
    </View>
  )
}

export function ContactScreen({ categoryKey, draft, setDraft }) {
  const isStay = categoryKey === 'stay'
  return (
    <View>
      <Head kicker="Shared · core" title="Contact & visibility" sub="Your account phone number is used — visit window controls when tenants can request one." />
      {isStay ? (
        <View style={styles.instantBookRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.instantBookTitle}>Instant book</Text>
            <Text style={styles.instantBookBody}>Guests can book without waiting for approval</Text>
          </View>
          <Switch
            value={!!draft.instantBook}
            onValueChange={(v) => setDraft((d) => ({ ...d, instantBook: v }))}
            trackColor={{ true: colors.brand600, false: colors.slate200 }}
          />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Visits from</Text>
            <TextInput
              style={styles.input}
              value={draft.appointmentWindowStart}
              onChangeText={(v) => setDraft((d) => ({ ...d, appointmentWindowStart: v }))}
              placeholder="09:00"
              placeholderTextColor={colors.slate400}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Visits to</Text>
            <TextInput
              style={styles.input}
              value={draft.appointmentWindowEnd}
              onChangeText={(v) => setDraft((d) => ({ ...d, appointmentWindowEnd: v }))}
              placeholder="20:00"
              placeholderTextColor={colors.slate400}
            />
          </View>
        </View>
      )}
    </View>
  )
}

export function VerifyScreen({ categoryKey, draft, setDraft }) {
  const v = VERIFY[categoryKey]
  const docs = draft.docs
  function setUrl(type, url) {
    setDraft((d) => ({ ...d, docs: url ? [...d.docs.filter((x) => x.type !== type), { type, url }] : d.docs.filter((x) => x.type !== type) }))
  }
  return (
    <View>
      {v.biz && (
        <View style={styles.bizBadge}>
          <Text style={styles.bizBadgeText}>BUSINESS KYC</Text>
        </View>
      )}
      <Head
        title={v.biz ? 'Verify your business' : 'Verify ownership'}
        sub="Your listing saves as a draft and goes live once the trust team approves these. Paste a link to each document (Google Drive, Dropbox, etc.)."
      />
      <View style={{ gap: spacing.sm }}>
        {v.docs.map(([type, label]) => {
          const existing = docs.find((x) => x.type === type)
          return (
            <View key={type} style={styles.docRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.docLabel}>{label}</Text>
                <TextInput
                  style={styles.docInput}
                  defaultValue={existing?.url ?? ''}
                  onEndEditing={(e) => setUrl(type, e.nativeEvent.text.trim())}
                  placeholder="Paste document URL"
                  placeholderTextColor={colors.slate400}
                />
              </View>
              {!!existing && <Icon name="check" size={16} color={colors.brand600} />}
            </View>
          )
        })}
      </View>
    </View>
  )
}

export function ReviewScreen({ categoryKey, draft }) {
  const cat = CATEGORIES[categoryKey]
  const priceRow = PRICING[categoryKey][0]
  const facts = [
    ['Type', cat.label],
    [DESCRIBE[categoryKey].q.replace(/\?$/, ''), draft.fields[DESCRIBE[categoryKey].k] ?? '—'],
    ['City', draft.location.city || '—'],
    [priceRow[1], draft.pricing[priceRow[0]] ? `₹${draft.pricing[priceRow[0]]}` : '—'],
    ['Amenities', draft.amenityNames.length ? draft.amenityNames.slice(0, 4).join(', ') + (draft.amenityNames.length > 4 ? ` +${draft.amenityNames.length - 4}` : '') : '—'],
    ['Photos', `${draft.images.length} uploaded`],
  ]
  return (
    <View>
      <Head kicker="Almost there" title="Review your listing" sub="Confirm the details. On publish it saves as DRAFT and moves to PENDING for verification." />
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View style={[styles.reviewIcon, cat.tier === 'biz' && styles.reviewIconBiz]}>
            <Icon name="building" size={20} color={cat.tier === 'biz' ? colors.white : colors.brand600} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reviewTitle} numberOfLines={1}>{draft.title || `New ${cat.label} listing`}</Text>
            <Text style={styles.reviewSub}>{draft.location.city || 'Your city'} · {cat.long}</Text>
          </View>
          <View style={styles.draftBadge}>
            <Text style={styles.draftBadgeText}>Draft</Text>
          </View>
        </View>
        <View>
          {facts.map(([label, value], i) => (
            <View key={i} style={[styles.factRow, i < facts.length - 1 && styles.factRowBorder]}>
              <Text style={styles.factLabel}>{label}</Text>
              <Text style={styles.factValue} numberOfLines={1}>{value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  head: { marginBottom: spacing.lg },
  kicker: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.brand600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm },
  headTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  headSub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: spacing.sm, lineHeight: 20 },
  optionCard: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white },
  optionCardActive: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  optionLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  optionHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2 },
  fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate500, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  charCount: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700 },
  chipTextActive: { color: colors.white },
  priceInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.md },
  priceSymbol: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate400, marginRight: 4 },
  priceInput: { flex: 1, paddingVertical: spacing.sm + 2, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  instantBookRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.slate50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate100 },
  instantBookTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate800 },
  instantBookBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2 },
  bizBadge: { alignSelf: 'flex-start', backgroundColor: colors.slate800, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6, marginBottom: spacing.lg },
  bizBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white, letterSpacing: 0.6 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.lg },
  docLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  docInput: { marginTop: spacing.xs, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 2, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate800 },
  reviewCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.lg, overflow: 'hidden' },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  reviewIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  reviewIconBiz: { backgroundColor: colors.slate800 },
  reviewTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  reviewSub: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2 },
  draftBadge: { backgroundColor: colors.warning50, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  draftBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: '#B45309', textTransform: 'uppercase' },
  factRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  factRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.slate50 },
  factLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  factValue: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800, flexShrink: 1, textAlign: 'right' },
})
