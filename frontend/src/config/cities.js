// Single source of truth for all city data.
// To add a new city: append one entry to CITIES — nothing else needs to change.

export const CITIES = [
  {
    name:         'Delhi',
    state:        'Delhi NCR',
    lat:          28.6139,
    lng:          77.2090,
    areas: [
      'Dwarka', 'Rohini', 'Lajpat Nagar', 'Saket',
      'Vasant Kunj', 'Karol Bagh', 'Noida', 'Gurgaon',
    ],
  },
  {
    name:         'Mumbai',
    state:        'Mumbai Metropolitan Region',
    lat:          19.0760,
    lng:          72.8777,
    areas: [
      'Bandra', 'Andheri', 'Powai', 'Juhu',
      'Worli', 'Dadar', 'Malad', 'Thane',
    ],
  },
  {
    name:         'Kolkata',
    state:        'West Bengal',
    lat:          22.5726,
    lng:          88.3639,
    areas: [
      'Salt Lake', 'Park Street', 'Ballygunge', 'New Town',
      'Alipore', 'Howrah', 'Behala', 'Rajarhat',
    ],
  },
  {
    name:         'Chennai',
    state:        'Tamil Nadu',
    lat:          13.0827,
    lng:          80.2707,
    areas: [
      'Anna Nagar', 'Adyar', 'T. Nagar', 'Velachery',
      'OMR', 'ECR', 'Porur', 'Guindy',
    ],
  },
  {
    name:         'Bengaluru',
    state:        'Karnataka',
    lat:          12.9716,
    lng:          77.5946,
    areas: [
      'Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield',
      'BTM Layout', 'JP Nagar', 'Marathahalli', 'Electronic City',
    ],
  },
  {
    name:         'Hyderabad',
    state:        'Telangana',
    lat:          17.3850,
    lng:          78.4867,
    areas: [
      'Banjara Hills', 'Jubilee Hills', 'Gachibowli', 'HITEC City',
      'Madhapur', 'Kondapur', 'Kukatpally', 'Begumpet',
    ],
  },
  {
    name:         'Ahmedabad',
    state:        'Gujarat',
    lat:          23.0225,
    lng:          72.5714,
    areas: [
      'Satellite', 'Vastrapur', 'Bopal', 'Prahladnagar',
      'Navrangpura', 'Maninagar', 'SG Highway', 'Thaltej',
    ],
  },
  {
    name:         'Pune',
    state:        'Maharashtra',
    lat:          18.5204,
    lng:          73.8567,
    areas: [
      'Koregaon Park', 'Baner', 'Hinjewadi', 'Kothrud',
      'Viman Nagar', 'Aundh', 'Wakad', 'Kharadi',
    ],
  },
  {
    name:         'Surat',
    state:        'Gujarat',
    lat:          21.1702,
    lng:          72.8311,
    areas: [
      'Adajan', 'Vesu', 'Citylight', 'Piplod',
      'Athwalines', 'Ghod Dod Road', 'Pal', 'Katargam',
    ],
  },
]

// Derived helpers — computed from CITIES so they never go stale

export const CITY_NAMES = CITIES.map((c) => c.name)

// { Bengaluru: [...areas], Chennai: [...areas], ... }
export const CITY_AREAS = Object.fromEntries(CITIES.map((c) => [c.name, c.areas]))

// Reverse map: area → city name (for auto-selecting city when user clicks an area chip)
export const AREA_TO_CITY = Object.fromEntries(
  CITIES.flatMap((c) => c.areas.map((a) => [a, c.name]))
)

// Mix of popular areas shown when no city is selected
export const DEFAULT_AREAS = CITIES.flatMap((c) => c.areas.slice(0, 2))

// "Bengaluru, Chennai & Hyderabad" — joins with commas and & before last
export const CITY_LIST_LABEL = CITIES.length <= 1
  ? CITIES[0]?.name ?? ''
  : CITIES.slice(0, -1).map((c) => c.name).join(', ') + ' & ' + CITIES.at(-1).name
