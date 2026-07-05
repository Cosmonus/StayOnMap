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
| Mobile    | Expo SDK 57 + React Native (iOS/Android) |
| Backend   | Node.js + Express.js + Prisma            |
| Database  | PostgreSQL (Railway)                     |
| Maps      | Google Maps JavaScript API (web), native map view (mobile) |
| Image storage | Supabase Storage                    |
| Auth      | Custom JWT (bcrypt + jsonwebtoken) — separate secrets for users and admins, see `.claude/auth.md` |
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
- A Supabase project (image storage only — auth does not use Supabase)
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
- List across 8 property types (apartment/house/villa/PG/independent house/
  commercial/land/short-stay) via a type-aware onboarding wizard (web: `/list`)
  — PG/commercial/short-stay require a Business-tier upgrade (stub, no
  payment yet)
- Manage listings dashboard (free tier: up to 3 active listings)
- Accept/reject appointment requests, respond to reviews and reports
- Request ownership verification (earns a Verified Owner badge)
- Offer leases, track sign/reject/terminate status
- A persistent "host mode" nav toggle (web header + mobile tab bar) swaps
  navigation to Dashboard/Inbox/Appointments/Calendar/My Listing until
  switched back to traveling

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

## Contributing

`master` is protected — all changes land via pull request, not direct push.

**PR title format (required, CI-enforced):**
```
stayonmap - <your title>
```
e.g. `stayonmap - Fix appointment scheduling bug`. A PR with a title that
doesn't match this exactly will fail the `PR Title Check` status check.

**CI (`.github/workflows/`) runs automatically on every push and PR to `master`:**

| Check | What it does |
|-------|--------------|
| `Backend (lint + test)` | `npm run lint` + `npm test` in `backend/` — tests run fully mocked, no live DB needed |
| `Frontend (lint + build)` | `npm run lint` + `npm run build` in `frontend/` |
| `Mobile (bundle smoke check)` | `npx expo export --platform android` in `mobile/` — catches import/syntax errors |
| `PR Title Check` | Validates the PR title against the format above |

All four must pass before a PR can merge. Run the backend/frontend commands
locally before pushing (see [Development](#development) above) to catch
failures early instead of waiting on CI.

---

## Deployment

| Service  | Platform          |
|----------|--------------------|
| Frontend | Railway            |
| Backend  | Railway            |
| Database | Railway Postgres   |
| Mobile   | Expo / EAS (not yet published to app stores) |

Auth is custom JWT (bcrypt + jsonwebtoken, no third-party auth service) and
image storage is Supabase Storage — see `docs/deployment.md` for the full
setup and environment checklist.

---

## License

MIT
