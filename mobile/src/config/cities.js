// Mirrors frontend/src/config/cities.js — duplicated (not shared via a
// package) since the two apps aren't set up as an npm workspace; same
// pattern the web app already uses for its own config (not imported from
// shared/).
export const CITIES = [
  {
    name: 'Bengaluru',
    state: 'Karnataka',
    lat: 12.9716,
    lng: 77.5946,
    areas: ['Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield', 'BTM Layout', 'JP Nagar', 'Marathahalli', 'Electronic City'],
  },
  {
    name: 'Chennai',
    state: 'Tamil Nadu',
    lat: 13.0827,
    lng: 80.2707,
    areas: ['Anna Nagar', 'Adyar', 'T. Nagar', 'Velachery', 'OMR', 'ECR', 'Porur', 'Guindy'],
  },
  {
    name: 'Hyderabad',
    state: 'Telangana',
    lat: 17.385,
    lng: 78.4867,
    areas: ['Banjara Hills', 'Jubilee Hills', 'Gachibowli', 'HITEC City', 'Madhapur', 'Kondapur', 'Kukatpally', 'Begumpet'],
  },
  {
    name: 'Delhi',
    state: 'Delhi NCR',
    lat: 28.6139,
    lng: 77.209,
    areas: ['Dwarka', 'Rohini', 'Lajpat Nagar', 'Saket', 'Vasant Kunj', 'Karol Bagh', 'Noida', 'Gurgaon'],
  },
]

export const CITY_NAMES = CITIES.map((c) => c.name)
export const CITY_AREAS = Object.fromEntries(CITIES.map((c) => [c.name, c.areas]))
