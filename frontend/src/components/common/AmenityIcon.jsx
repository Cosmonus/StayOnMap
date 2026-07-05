import {
  Wifi, SquareParking, Wind, ArrowUpDown, Dumbbell, Camera, Zap, CookingPot,
  WashingMachine, PawPrint, ShieldCheck, Waves, Flame, Droplet, DoorOpen, Trees,
  Building2, PhoneCall, Droplets, CloudRain, Filter, Container, Baby, Footprints,
  ShieldAlert, Tv, Refrigerator, Sofa, Bed, DoorClosed, UtensilsCrossed, Microwave,
  Sun, BatteryCharging, Fan, HelpCircle,
} from 'lucide-react'

const ICONS = {
  'WiFi':                 Wifi,
  'Parking':              SquareParking,
  'AC':                   Wind,
  'Lift':                 ArrowUpDown,
  'Gym':                  Dumbbell,
  'CCTV':                 Camera,
  'Power Backup':         Zap,
  'Kitchen':              CookingPot,
  'Washing Machine':      WashingMachine,
  'Pet Friendly':         PawPrint,
  'Security Guard':       ShieldCheck,
  'Swimming Pool':        Waves,
  'Gas Pipeline':         Flame,
  'Piped Gas':            Flame,
  'Gated Security':       ShieldCheck,
  'Hot Water':            Droplet,
  'Geyser':               Droplet,
  'Balcony':              DoorOpen,
  'Terrace':              DoorOpen,
  'Garden':               Trees,
  'Club House':           Building2,
  'Intercom':             PhoneCall,
  'Water Supply':         Droplets,
  'Rainwater Harvesting': CloudRain,
  'Water Purifier':       Filter,
  'Water Tank':           Container,
  'Play Area':            Baby,
  'Jogging Track':        Footprints,
  'Visitor Parking':      SquareParking,
  'Fire Safety':          ShieldAlert,
  'Laundry':              WashingMachine,
  'TV':                   Tv,
  'Fridge':               Refrigerator,
  'Sofa':                 Sofa,
  'Bed':                  Bed,
  'Wardrobe':             DoorClosed,
  'Dining Table':         UtensilsCrossed,
  'Microwave':            Microwave,
  'Solar Panel':          Sun,
  'EV Charging':          BatteryCharging,
  'Air Cooler':           Fan,
}

const FALLBACK = HelpCircle

export function AmenityIcon({ name, size = 14 }) {
  const Icon = ICONS[name] ?? FALLBACK
  return <Icon size={size} strokeWidth={1.9} />
}
