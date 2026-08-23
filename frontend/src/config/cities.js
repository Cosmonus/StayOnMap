// Single source of truth for all city data on the web client.
// MIRRORS backend/src/config/cities.js's CITY_TABLE (name, state, lat, lng,
// order) — backend/tests/cities-parity.test.js fails on drift. To add a city:
// one row there, one row here, one in mobile/src/config/cities.js.
//
// 2026-08-24: opened up from nine metros to the cities of their seven states.
// A state is expressed as its cities because everything downstream keys on a
// city name with a centre. Towns not listed still go to the waitlist.

export const CITIES = [
  {
    name:  'Delhi',
    state: 'Delhi',
    lat:   28.6139,
    lng:   77.209,
    core:  true,
    areas: [
      'Dwarka', 'Rohini', 'Lajpat Nagar', 'Saket', 'Vasant Kunj', 'Karol Bagh', 'Noida', 'Gurgaon',
    ],
  },
  {
    name:  'Mumbai',
    state: 'Maharashtra',
    lat:   19.076,
    lng:   72.8777,
    core:  true,
    areas: [
      'Bandra', 'Andheri', 'Powai', 'Juhu', 'Worli', 'Dadar', 'Malad', 'Thane',
    ],
  },
  {
    name:  'Kolkata',
    state: 'West Bengal',
    lat:   22.5726,
    lng:   88.3639,
    core:  true,
    areas: [
      'Salt Lake', 'Park Street', 'Ballygunge', 'New Town', 'Alipore', 'Howrah', 'Behala', 'Rajarhat',
    ],
  },
  {
    name:  'Chennai',
    state: 'Tamil Nadu',
    lat:   13.0827,
    lng:   80.2707,
    core:  true,
    areas: [
      'Anna Nagar', 'Adyar', 'T. Nagar', 'Velachery', 'OMR', 'ECR', 'Porur', 'Guindy',
    ],
  },
  {
    name:  'Bengaluru',
    state: 'Karnataka',
    lat:   12.9716,
    lng:   77.5946,
    core:  true,
    areas: [
      'Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield', 'BTM Layout', 'JP Nagar', 'Marathahalli', 'Electronic City',
    ],
  },
  {
    name:  'Hyderabad',
    state: 'Telangana',
    lat:   17.385,
    lng:   78.4867,
    core:  true,
    areas: [
      'Banjara Hills', 'Jubilee Hills', 'Gachibowli', 'HITEC City', 'Madhapur', 'Kondapur', 'Kukatpally', 'Begumpet',
    ],
  },
  {
    name:  'Ahmedabad',
    state: 'Gujarat',
    lat:   23.0225,
    lng:   72.5714,
    core:  true,
    areas: [
      'Satellite', 'Vastrapur', 'Bopal', 'Prahladnagar', 'Navrangpura', 'Maninagar', 'SG Highway', 'Thaltej',
    ],
  },
  {
    name:  'Pune',
    state: 'Maharashtra',
    lat:   18.5204,
    lng:   73.8567,
    core:  true,
    areas: [
      'Koregaon Park', 'Baner', 'Hinjewadi', 'Kothrud', 'Viman Nagar', 'Aundh', 'Wakad', 'Kharadi',
    ],
  },
  {
    name:  'Surat',
    state: 'Gujarat',
    lat:   21.1702,
    lng:   72.8311,
    core:  true,
    areas: [
      'Adajan', 'Vesu', 'Citylight', 'Piplod', 'Athwalines', 'Ghod Dod Road', 'Pal', 'Katargam',
    ],
  },
  {
    name:  'Nagpur',
    state: 'Maharashtra',
    lat:   21.1458,
    lng:   79.0882,
    areas: [],
  },
  {
    name:  'Nashik',
    state: 'Maharashtra',
    lat:   19.9975,
    lng:   73.7898,
    areas: [],
  },
  {
    name:  'Chhatrapati Sambhajinagar',
    state: 'Maharashtra',
    lat:   19.8762,
    lng:   75.3433,
    areas: [],
  },
  {
    name:  'Solapur',
    state: 'Maharashtra',
    lat:   17.6599,
    lng:   75.9064,
    areas: [],
  },
  {
    name:  'Kolhapur',
    state: 'Maharashtra',
    lat:   16.705,
    lng:   74.2433,
    areas: [],
  },
  {
    name:  'Amravati',
    state: 'Maharashtra',
    lat:   20.932,
    lng:   77.7523,
    areas: [],
  },
  {
    name:  'Siliguri',
    state: 'West Bengal',
    lat:   26.7271,
    lng:   88.3953,
    areas: [],
  },
  {
    name:  'Durgapur',
    state: 'West Bengal',
    lat:   23.5204,
    lng:   87.3119,
    areas: [],
  },
  {
    name:  'Asansol',
    state: 'West Bengal',
    lat:   23.6889,
    lng:   86.9661,
    areas: [],
  },
  {
    name:  'Coimbatore',
    state: 'Tamil Nadu',
    lat:   11.0168,
    lng:   76.9558,
    areas: [],
  },
  {
    name:  'Madurai',
    state: 'Tamil Nadu',
    lat:   9.9252,
    lng:   78.1198,
    areas: [],
  },
  {
    name:  'Tiruchirappalli',
    state: 'Tamil Nadu',
    lat:   10.7905,
    lng:   78.7047,
    areas: [],
  },
  {
    name:  'Salem',
    state: 'Tamil Nadu',
    lat:   11.6643,
    lng:   78.146,
    areas: [],
  },
  {
    name:  'Tiruppur',
    state: 'Tamil Nadu',
    lat:   11.1085,
    lng:   77.3411,
    areas: [],
  },
  {
    name:  'Erode',
    state: 'Tamil Nadu',
    lat:   11.341,
    lng:   77.7172,
    areas: [],
  },
  {
    name:  'Vellore',
    state: 'Tamil Nadu',
    lat:   12.9165,
    lng:   79.1325,
    areas: [],
  },
  {
    name:  'Tirunelveli',
    state: 'Tamil Nadu',
    lat:   8.7139,
    lng:   77.7567,
    areas: [],
  },
  {
    name:  'Thoothukudi',
    state: 'Tamil Nadu',
    lat:   8.7642,
    lng:   78.1348,
    areas: [],
  },
  {
    name:  'Hosur',
    state: 'Tamil Nadu',
    lat:   12.7409,
    lng:   77.8253,
    areas: [],
  },
  {
    name:  'Mysuru',
    state: 'Karnataka',
    lat:   12.2958,
    lng:   76.6394,
    areas: [],
  },
  {
    name:  'Mangaluru',
    state: 'Karnataka',
    lat:   12.9141,
    lng:   74.856,
    areas: [],
  },
  {
    name:  'Hubballi-Dharwad',
    state: 'Karnataka',
    lat:   15.3647,
    lng:   75.124,
    areas: [],
  },
  {
    name:  'Belagavi',
    state: 'Karnataka',
    lat:   15.8497,
    lng:   74.4977,
    areas: [],
  },
  {
    name:  'Davanagere',
    state: 'Karnataka',
    lat:   14.4644,
    lng:   75.9218,
    areas: [],
  },
  {
    name:  'Ballari',
    state: 'Karnataka',
    lat:   15.1394,
    lng:   76.9214,
    areas: [],
  },
  {
    name:  'Shivamogga',
    state: 'Karnataka',
    lat:   13.9299,
    lng:   75.5681,
    areas: [],
  },
  {
    name:  'Tumakuru',
    state: 'Karnataka',
    lat:   13.3379,
    lng:   77.1173,
    areas: [],
  },
  {
    name:  'Udupi',
    state: 'Karnataka',
    lat:   13.3409,
    lng:   74.7421,
    areas: [],
  },
  {
    name:  'Warangal',
    state: 'Telangana',
    lat:   17.9689,
    lng:   79.5941,
    areas: [],
  },
  {
    name:  'Nizamabad',
    state: 'Telangana',
    lat:   18.6725,
    lng:   78.0941,
    areas: [],
  },
  {
    name:  'Karimnagar',
    state: 'Telangana',
    lat:   18.4386,
    lng:   79.1288,
    areas: [],
  },
  {
    name:  'Khammam',
    state: 'Telangana',
    lat:   17.2473,
    lng:   80.1514,
    areas: [],
  },
  {
    name:  'Vadodara',
    state: 'Gujarat',
    lat:   22.3072,
    lng:   73.1812,
    areas: [],
  },
  {
    name:  'Rajkot',
    state: 'Gujarat',
    lat:   22.3039,
    lng:   70.8022,
    areas: [],
  },
  {
    name:  'Bhavnagar',
    state: 'Gujarat',
    lat:   21.7645,
    lng:   72.1519,
    areas: [],
  },
  {
    name:  'Jamnagar',
    state: 'Gujarat',
    lat:   22.4707,
    lng:   70.0577,
    areas: [],
  },
  {
    name:  'Junagadh',
    state: 'Gujarat',
    lat:   21.5222,
    lng:   70.4579,
    areas: [],
  },
  {
    name:  'Anand',
    state: 'Gujarat',
    lat:   22.5645,
    lng:   72.9289,
    areas: [],
  },
]

// Derived helpers — computed from CITIES so they never go stale

export const CITY_NAMES = CITIES.map((c) => c.name)

export const SUPPORTED_STATES = ['Delhi', 'Maharashtra', 'West Bengal', 'Tamil Nadu', 'Karnataka', 'Telangana', 'Gujarat']

// The nine original metros — the ones with curated areas, a metro network and
// a pill on the homepage map. The other cities are fully open; they are just
// not worth a pill at national zoom.
export const CORE_CITIES = CITIES.filter((c) => c.core)

// Dropdown options, grouped by state in table order, and labelled
// "Coimbatore, Tamil Nadu" so type-ahead finds a city by either word.
export const CITY_OPTIONS = CITIES.map((c) => ({ value: c.name, label: `${c.name}, ${c.state}` }))

// { Bengaluru: [...areas], Chennai: [...areas], ... } — empty for cities with no curated areas
export const CITY_AREAS = Object.fromEntries(CITIES.map((c) => [c.name, c.areas]))

// Reverse map: area → city name (for auto-selecting city when user clicks an area chip)
export const AREA_TO_CITY = Object.fromEntries(
  CITIES.flatMap((c) => c.areas.map((a) => [a, c.name]))
)

// Mix of popular areas shown when no city is selected
export const DEFAULT_AREAS = CITIES.flatMap((c) => c.areas.slice(0, 2))

// "Delhi, Maharashtra, … & Gujarat" — the STATES, since 2026-08-24. Forty-odd
// city names in a sentence is not a sentence; the waitlist hint and the About
// page read this.
export const CITY_LIST_LABEL = SUPPORTED_STATES.length <= 1
  ? SUPPORTED_STATES[0] ?? ''
  : SUPPORTED_STATES.slice(0, -1).join(', ') + ' & ' + SUPPORTED_STATES.at(-1)
