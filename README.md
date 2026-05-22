# StayOnMap

> Broker-free rental discovery. Find your home on the map.

A map-first rental platform for India where tenants discover homes visually and owners list directly — no brokers.

---

## Live Demo

_Coming soon_

---

## Tech Stack

| Layer     | Technology                     |
|-----------|-------------------------------|
| Frontend  | React 18 + Vite + Tailwind CSS |
| Backend   | Node.js + Express.js           |
| Database  | PostgreSQL (Railway) + Prisma  |
| Maps      | Mapbox GL JS                   |
| Storage   | Supabase Storage               |
| Auth      | Supabase Auth                  |

---

## Project Structure

```
STAYNEAR/
├── frontend/       React app (Vite)
├── backend/        Express API
├── shared/         Shared types
└── docs/           Documentation
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Supabase account
- Mapbox account

### Setup

```bash
# 1. Clone
git clone <repo-url>
cd STAYNEAR

# 2. Backend
cd backend
cp .env.example .env     # fill in your values
npm install
npx prisma migrate dev
npm run dev              # runs on :4000

# 3. Frontend
cd ../frontend
cp .env.example .env     # fill in your values
npm install
npm run dev              # runs on :5173
```

---

## Environment Variables

See `frontend/.env.example` and `backend/.env.example` for required variables.

---

## MVP Features

**Tenants**
- Interactive map with property pins and clustering
- Property detail pages with images and amenities
- Search and filter (budget, BHK, furnishing, parking)
- Save listings

**Owners**
- List properties with images and exact location
- Manage listings dashboard
- Free tier: up to 2 listings

---

## Development

```bash
# Prisma
cd backend
npx prisma studio        # visual DB browser
npx prisma migrate dev   # run migrations
npx prisma db seed       # seed test data

# Type checking
cd frontend && npm run type-check
```

---

## Deployment

| Service  | Platform       |
|----------|---------------|
| Frontend | Vercel         |
| Backend  | Railway/Render |
| Database | Supabase       |

See `docs/deployment.md` for details.

---

## License

MIT
