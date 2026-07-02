# StayOnMap

> Broker-free rental discovery. Find your home on the map.

A map-first rental platform for India where tenants discover homes visually and owners list directly — no brokers. The homepage IS the map, on both web and mobile.

---

## Live Demo

`stayonmap.com`

---

## Tech Stack

| Layer     | Technology                              |
|-----------|------------------------------------------|
| Frontend  | React 18 + Vite + Tailwind CSS           |
| Mobile    | Expo + React Native (iOS/Android)        |
| Backend   | Node.js + Express.js + Prisma            |
| Database  | PostgreSQL (Railway)                     |
| Maps      | Google Maps JavaScript API (web), native map view (mobile) |
| Image storage | Cloudinary                          |
| Auth      | Supabase Auth (JWT verification only — not the database) |
| Real-time | Socket.io (chat, notifications) — JWT-verified handshake |
| Push      | Web Push/VAPID (web), Expo push service (mobile) |

---

## Project Structure

```
STAYONMAP/
├── frontend/       React app (Vite) — web
├── mobile/         Expo app (React Native) — iOS/Android, see mobile/AGENTS.md
├── backend/        Express API + Prisma, shared by both clients
├── shared/         Shared types
├── docs/           Developer docs (architecture, database, deployment, API, features)
└── .claude/        Claude Code skill files (domain rules, not user-facing docs)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- A Supabase project (auth only)
- A Cloudinary account (property images)
- A Google Maps API key (Maps JavaScript API + Places + Geocoding + Elevation enabled)
- A Railway Postgres database (or any Postgres instance for local dev)
- For mobile: the Expo Go app on a physical device, or an Android/iOS emulator

### Backend

```bash
cd backend
cp .env.example .env     # fill in your values — see comments in the file
npm install
npx prisma migrate dev
npm run dev               # runs on :4000
```

### Frontend (web)

```bash
cd frontend
cp .env.example .env      # fill in your values
npm install
npm run dev                # runs on :5173
```

### Mobile

```bash
cd mobile
cp .env.example .env       # fill in your values
npm install
npm start                   # Expo dev server — scan the QR with Expo Go, or press `a`/`i`
```

On a physical device, `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env` must be your
machine's LAN IP (not `localhost`), or run `npx expo start --tunnel`. Read
`mobile/AGENTS.md` before making mobile changes — Expo SDK conventions move
fast and differ from what's in general training data.

---

## Environment Variables

See `backend/.env.example`, `frontend/.env.example`, and `mobile/.env.example`
for the full, annotated list of required variables. `docs/deployment.md` has
the checklist version.

---

## Feature Overview

Both web and mobile share the same backend API and have reached feature
parity (see `.claude/architecture.md`'s Feature Completeness Map for the
exact per-platform breakdown):

**Tenants**
- Interactive map with property pins and clustering
- Property detail pages — images, amenities, Trust/Risk scores, community reviews
- Search and filter (budget, BHK, furnishing, city/area)
- Save listings, book appointments, chat with owners
- Report a listing, review a stay, sign/reject a lease offer

**Owners**
- List properties with images, exact location, and house rules
- Manage listings dashboard (free tier: up to 3 active listings)
- Accept/reject appointment requests, respond to reviews and reports
- Request ownership verification (earns a Verified Owner badge)
- Offer leases, track sign/reject/terminate status

**Platform**
- Real-time chat and notifications (Socket.io, JWT-verified) + push (web + mobile)
- Trust/Risk scoring computed from reviews, reports, and verification status
- Admin panel (web-only — admins are platform operators, not app users)

---

## Development

```bash
# Prisma (from backend/)
npx prisma studio        # visual DB browser
npx prisma migrate dev   # run migrations
npx prisma db seed       # seed test data

# Linting — must pass 0 errors before merging
cd frontend && npm run lint
cd backend && npm run lint
```

Mobile has no lint script configured yet; sanity-check changes with
`npx expo export --platform android` from `mobile/` (fails loudly on import/syntax errors).

---

## Deployment

| Service  | Platform          |
|----------|--------------------|
| Frontend | Railway            |
| Backend  | Railway            |
| Database | Railway Postgres   |
| Mobile   | Expo / EAS (not yet published to app stores) |

Auth is Supabase (JWT verification only) and image storage is Cloudinary —
see `docs/deployment.md` for the full setup and environment checklist.

---

## License

MIT
