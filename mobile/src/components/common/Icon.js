import {
  Compass, Search, MessageCircle, User, Heart, Star,
  Share2, Camera, Send, Plus, Pencil, Trash2, Repeat2, LogOut,
  ChevronLeft, ChevronRight, ChevronDown, X, SlidersHorizontal, Layers, List, LayoutGrid, Map,
  Check, CircleCheck, TriangleAlert, Info, Bell, Shield, ShieldCheck, Clock, Calendar, Eye,
  Users, Phone, Mail, Lock, Key, Settings,
  House, Building2, MapPin, BedDouble, Ruler, IndianRupee, Sofa, Package, Wifi,
  Image as ImageIcon, FileText, Link2, ArrowRight,
  ArrowUpDown, Dumbbell, WavesLadder, Video, Zap, Droplet, Wind, Refrigerator, WashingMachine,
  TreePine, DoorClosed, SquareParking,
} from 'lucide-react-native'

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
  compare: Repeat2,
  logout: LogOut,

  // Navigation / chrome
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  close: X,
  filter: SlidersHorizontal,
  layers: Layers,
  list: List,
  grid: LayoutGrid,
  map: Map,

  // Status / feedback
  check: Check,
  checkCircle: CircleCheck,
  alertTriangle: TriangleAlert,
  info: Info,
  bell: Bell,
  shield: Shield,
  shieldCheck: ShieldCheck,
  clock: Clock,
  calendar: Calendar,
  eye: Eye,

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

export default function Icon({ name, size = 22, color = '#1E293B' }) {
  const Component = ICONS[name]
  if (!Component) return null

  return <Component size={size} color={color} fill={FILLED_NAMES.has(name) ? color : 'none'} />
}
