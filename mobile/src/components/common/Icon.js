import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'

// Semantic name -> [IconFamily, glyph]. Feather is the default (closest to
// the PDF's thin stroke-outline style); MaterialCommunityIcons fills gaps
// Feather has no glyph for (bed, rupee, sofa, ruler, shield-check); Ionicons
// supplies true filled/outline pairs for things that need both states (heart, star).
const ICONS = {
  // Tab bar
  explore: [Feather, 'compass'],
  search: [Feather, 'search'],
  saved: [Ionicons, 'heart-outline'],
  chat: [Feather, 'message-circle'],
  profile: [Feather, 'user'],

  // Save / favourite
  heart: [Ionicons, 'heart-outline'],
  heartFilled: [Ionicons, 'heart'],

  // Ratings
  star: [Ionicons, 'star'],
  starOutline: [Ionicons, 'star-outline'],

  // Actions
  share: [Feather, 'share-2'],
  camera: [Feather, 'camera'],
  send: [Feather, 'send'],
  plus: [Feather, 'plus'],
  edit: [Feather, 'edit-2'],
  trash: [Feather, 'trash-2'],
  compare: [Feather, 'repeat'],
  logout: [Feather, 'log-out'],

  // Navigation / chrome
  chevronLeft: [Feather, 'chevron-left'],
  chevronRight: [Feather, 'chevron-right'],
  chevronDown: [Feather, 'chevron-down'],
  close: [Feather, 'x'],
  filter: [Feather, 'sliders'],
  list: [Feather, 'list'],
  grid: [Feather, 'grid'],
  map: [Feather, 'map'],

  // Status / feedback
  check: [Feather, 'check'],
  checkCircle: [Feather, 'check-circle'],
  alertTriangle: [Feather, 'alert-triangle'],
  info: [Feather, 'info'],
  bell: [Feather, 'bell'],
  shield: [Feather, 'shield'],
  shieldCheck: [MaterialCommunityIcons, 'shield-check'],
  clock: [Feather, 'clock'],
  calendar: [Feather, 'calendar'],
  eye: [Feather, 'eye'],

  // People / contact
  users: [Feather, 'users'],
  phone: [Feather, 'phone'],
  mail: [Feather, 'mail'],
  lock: [Feather, 'lock'],
  key: [Feather, 'key'],
  messageCircle: [Feather, 'message-circle'],
  settings: [Feather, 'settings'],

  // Property attributes
  home: [Feather, 'home'],
  building: [MaterialCommunityIcons, 'office-building-outline'],
  mapPin: [Feather, 'map-pin'],
  bed: [MaterialCommunityIcons, 'bed-outline'],
  area: [MaterialCommunityIcons, 'ruler-square'],
  rupee: [MaterialCommunityIcons, 'currency-inr'],
  sofa: [MaterialCommunityIcons, 'sofa-outline'],
  box: [Feather, 'package'],
  wifi: [Feather, 'wifi'],
  image: [Feather, 'image'],
  document: [Feather, 'file-text'],
  link: [Feather, 'link'],
  arrowRight: [Feather, 'arrow-right'],

  // Amenities
  elevator: [MaterialCommunityIcons, 'elevator'],
  gym: [MaterialCommunityIcons, 'dumbbell'],
  pool: [MaterialCommunityIcons, 'pool'],
  cctv: [MaterialCommunityIcons, 'cctv'],
  power: [MaterialCommunityIcons, 'flash'],
  water: [MaterialCommunityIcons, 'water'],
  ac: [MaterialCommunityIcons, 'air-conditioner'],
  fridge: [MaterialCommunityIcons, 'fridge-outline'],
  washingMachine: [MaterialCommunityIcons, 'washing-machine'],
  garden: [MaterialCommunityIcons, 'tree'],
  gate: [MaterialCommunityIcons, 'gate'],
  parking: [MaterialCommunityIcons, 'parking'],
  security: [MaterialCommunityIcons, 'security'],
}

export default function Icon({ name, size = 22, color = '#1E293B' }) {
  const entry = ICONS[name]
  if (!entry) return null
  const [Family, glyph] = entry
  return <Family name={glyph} size={size} color={color} />
}
