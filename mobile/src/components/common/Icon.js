import {
  Compass, Search, MessageCircle, User, Heart, Star,
  Share2, Camera, Send, Plus, Pencil, Trash2, Repeat2, LogOut, Paperclip, Maximize2,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, SlidersHorizontal, Layers, List, LayoutGrid, Map, LocateFixed,
  Check, CircleCheck, TriangleAlert, Info, Bell, Shield, ShieldCheck, Clock, Calendar, Eye, EyeOff,
  Users, Phone, Mail, Lock, Key, Settings,
  House, Building2, MapPin, BedDouble, Ruler, IndianRupee, Sofa, Package, Wifi,
  LandPlot, Store, Luggage,
  Image as ImageIcon, FileText, Link2, ArrowRight,
  ArrowUpDown, Dumbbell, WavesLadder, Video, Zap, Droplet, Wind, Refrigerator, WashingMachine,
  TreePine, DoorClosed, SquareParking,
  EllipsisVertical, Ban, Flag, Copy, WifiOff, LifeBuoy,
} from 'lucide-react-native'
import { colors } from '@theme/colors'

// Semantic name -> lucide-react-native component. Lucide is a minimal,
// consistent thin-stroke icon set (the spiritual successor to Feather,
// which this file used previously) — one family for everything, no more
// mixing Feather/Ionicons/MaterialCommunityIcons per icon.
const ICONS = {
  // Tab bar
  explore: Compass,
  search: Search,
  saved: Heart,
  chat: MessageCircle,
  profile: User,

  // Save / favourite
  heart: Heart,
  heartFilled: Heart,

  // Ratings
  star: Star,
  starOutline: Star,

  // Actions
  share: Share2,
  camera: Camera,
  send: Send,
  plus: Plus,
  edit: Pencil,
  trash: Trash2,
  attach: Paperclip,
  compare: Repeat2,
  logout: LogOut,
  maximize: Maximize2,

  // Navigation / chrome
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  close: X,
  filter: SlidersHorizontal,
  layers: Layers,
  list: List,
  grid: LayoutGrid,
  map: Map,
  locate: LocateFixed,

  // Status / feedback
  check: Check,
  checkCircle: CircleCheck,
  copy: Copy,
  wifiOff: WifiOff,
  alertTriangle: TriangleAlert,
  info: Info,
  bell: Bell,
  shield: Shield,
  lifeBuoy: LifeBuoy,
  shieldCheck: ShieldCheck,
  // User safety — the chat overflow menu and the blocked-people list.
  more: EllipsisVertical,
  ban: Ban,
  flag: Flag,
  clock: Clock,
  calendar: Calendar,
  eye: Eye,
  eyeOff: EyeOff,

  // People / contact
  users: Users,
  phone: Phone,
  mail: Mail,
  lock: Lock,
  key: Key,
  messageCircle: MessageCircle,
  settings: Settings,

  // Property attributes
  home: House,
  building: Building2,
  mapPin: MapPin,
  bed: BedDouble,
  area: Ruler,
  rupee: IndianRupee,
  sofa: Sofa,
  // The six wizard categories, as they appear on a map pin — see
  // config/propertyTypes.js. `home` and `building` above serve houses and
  // flats; these three are the other three categories.
  land: LandPlot,
  store: Store,
  luggage: Luggage,
  box: Package,
  wifi: Wifi,
  image: ImageIcon,
  document: FileText,
  link: Link2,
  arrowRight: ArrowRight,

  // Amenities
  elevator: ArrowUpDown,
  gym: Dumbbell,
  pool: WavesLadder,
  cctv: Video,
  power: Zap,
  water: Droplet,
  ac: Wind,
  fridge: Refrigerator,
  washingMachine: WashingMachine,
  garden: TreePine,
  gate: DoorClosed,
  parking: SquareParking,
  security: ShieldCheck,
}

// Filled variants — Lucide icons are outline-only by default (fill="none");
// these two names previously pointed at Ionicons' separate solid glyphs.
const FILLED_NAMES = new Set(['heartFilled', 'star'])

export default function Icon({ name, size = 22, color = colors.slate800 }) {
  const Component = ICONS[name]
  if (!Component) return null

  return <Component size={size} color={color} fill={FILLED_NAMES.has(name) ? color : 'none'} />
}
