# StayOnMap — Progress Tracker

---

## ✅ Completed

### UI / Frontend Fixes
- [x] Fixed "Back to listing" → "Back to properties" on PropertyPage
- [x] Added area insight card on property page right sidebar (metro, bus, flood risk, IT access etc.)
- [x] Added emoji icons to BHK / furnished / type spec chips across all views
- [x] Fixed `&apos;` rendering literally in appointment button text
- [x] Styled Preferred Date and Preferred Time dropdowns with brand theme
- [x] Made featured section cards equal height on homepage
- [x] Fixed sq.ft number showing without label in location line (now shows as chip)
- [x] Added email (srigokulkrishnan@gmail.com) to all ContactPage channels
- [x] Fixed login/signup buttons and tab switcher to use brand green color
- [x] Added house.png to hero section (two-column layout)
- [x] Redesigned hero as full-bleed image, then reverted to two-column with image on right
- [x] City showcase updated with real map images (bengaluru.jpg, chennai.jpg, hyderabad.jpg, delhi.jpg)
- [x] Added Delhi as 4th city in city showcase
- [x] Added India image to "Coming Soon — StayOnMap in your pocket" section
- [x] Improved homepage dropdown UX (portal-based, bigger hit targets, smooth animation)
- [x] Fixed Avatar crash in ListingDetailContent (empty name string bug)
- [x] Added backimg.jpg as background for 4,200+ stats card
- [x] Custom 404 page (`NotFoundPage`, noindexed, wired in `routes.jsx`)
- [x] Performance — heavy route components are lazy-loaded (14 of 15 routes; only `HomePage` is eager, intentionally, for first paint)

### Backend
- [x] Added `matchArea` endpoint for area insight matching
- [x] Area profiles with metro, rail, bus, flood, traffic, IT, water scores

### Deployment
- [x] Set up `.gitignore` (secrets, node_modules, planning docs excluded)
- [x] Pushed code to private GitHub repo (srigokulkrish/StayOnMap)
- [x] Deployed PostgreSQL on Railway
- [x] Deployed backend on Railway (`stayonmap-backend-production.up.railway.app`)
- [x] Deployed frontend on Railway (`stayonmap-frontend-production-23f8.up.railway.app`)
- [x] Site is live!
- [x] Repo transferred to the Cosmonus GitHub org (`github.com/Cosmonus/StayOnMap`) — local `origin` remote repointed
- [x] Corrected production domain everywhere in code: `stayonmap.in` → `stayonmap.com` (SEO tags, sitemap, robots.txt, backend email/VAPID defaults, admin seed script)

### Intelligence Positioning & Cosmonus Branding
- [x] Added `/intelligence` page — TrustScore engine (12 weighted signals) + fraud-detection agent, real numbers only, linked from primary nav and homepage hero
- [x] Repositioned homepage as an intelligence-scored platform (hero headline, trust badges, value-prop section, SEO copy) instead of a plain listing site
- [x] Removed fabricated stats sitewide (fake "6,000+ listings", "4,200+ tenants" etc.) — added `GET /properties/stats` + `usePlatformStats()` hook, wired real live-listing/owner/per-city counts into About, Home, Login, Contact, IntroPopup, MapPreview, CityDropdown
- [x] Removed fake named testimonials and the simulated "someone in X is doing Y" live-activity ticker
- [x] Contact page attribution changed to Cosmonus, with a link to cosmonus.com

### City Restriction (Bengaluru, Chennai, Hyderabad, Delhi)
- [x] Fixed backend `ALLOWED_CITIES` — was silently stuck at 2 cities (Bengaluru, Chennai only), blocking Hyderabad/Delhi listings with a 403 despite frontend already listing 4
- [x] Added the same city validation to listing updates (previously unchecked)
- [x] Add/Edit listing forms: city field now a dropdown sourced from `CITY_NAMES` with an "opening soon" hint, replacing a stale 2-option dropdown / unvalidated free-text input

### SEO Pass
- [x] Added missing `<SEOMeta>` to Contact and Rules pages (previously had none — inherited homepage title/description, a duplicate-title problem)
- [x] Added `noindex` to the Login page (utility page, no unique search value)
- [x] Added `/intelligence` to `sitemap.xml`
- [x] Fixed broken favicon reference (`favicon.svg` didn't exist) → now points at the real `icon-192.png`
- [x] Trimmed meta descriptions that exceeded Google's ~155–160 char truncation limit (Home, Intelligence, Rules pages)
- [x] Updated `BRAND.tagline` and homepage title/OG/Twitter tags to match the new "Rent with intelligence" positioning

### CLAUDE.md Compliance Pass
- [x] Replaced hardcoded hex color (`#12a374`) with the `brand-500` Tailwind token on the StayOnMap wordmark and headline highlight in `LoginPage`/`LoginModal` — was violating the "no hardcoded hex" rule
- [x] Fixed loading-state flash across all plain-text `usePlatformStats()` renders (IntroPopup, login mini-stats, Contact/Home CTA copy, FAQ answer, per-city listing counts) — a brief "0" no longer shows before the real count loads
- [x] Confirmed `npm run lint` passes 0 errors in both `frontend/` and `backend/`

### Mobile App — Socket Security + Push Notifications (2026-07-02)
- [x] Hardened Socket.io auth on web + mobile: handshake now sends a Supabase JWT re-read on every (re)connect, verified server-side via `supabase.auth.getUser()` in an `io.use()` middleware — previously trusted a client-supplied `userId`, a spoofing hole letting anyone join another user's chat/notification room
- [x] Added Expo push notifications: `ExpoPushToken` model + migration, `expoPush.service.js`, `/push/register-device` + `/push/unregister-device` routes, wired into `notifyUser()` alongside the existing web-push path
- [x] Built out a full Expo/React Native mobile app (`mobile/`) — auth, map, listings, appointments, chat, notifications, saved, search, push registration on login/logout

### Mobile Feature Parity Pass (2026-07-02)
Mobile was missing 5 features that exist on web. Built all of them against the real backend contracts (not the stale skill docs — see doc fixes below):
- [x] Trust/Risk scores — `TrustBadge`, `RiskAlert`, `TrustScoreWidget` ported to RN, wired into `PropertyDetailScreen`
- [x] Community reviews — `review.service.js` + `ReviewsSection` (12-category rating form, recommend/anonymous toggles, owner reply)
- [x] Property reports — `report.service.js` + `ReportButton` (category/severity picker, description, anonymous toggle)
- [x] Ownership verification — `verification.service.js` + `VerificationScreen`, reachable from a "Verify" action on each card in My Listings
- [x] Lease management — `lease.service.js` + `LeasesScreen` (sign/reject/terminate) + `CreateLeaseScreen`, reachable from Profile → Leases and an "Offer Lease" action on ACTIVE listings in My Listings
- [x] Added `slate500`/`slate700` to the mobile color palette — several existing screens already referenced these keys but they were never defined, so text silently rendered without the intended color
- [x] Fixed two latent web bugs found while porting: `TrustBadge.jsx`'s config used a made-up 8-value set that didn't match the real `TrustBadge` DB enum (real values like `HIGHLY_RECOMMENDED`/`SUSPICIOUS` rendered nothing); and `LeaseManager.jsx` had no UI trigger to actually open the "offer lease" modal — owners couldn't create a lease from the web at all. Fixed by adding an "Offer lease" action to `ListingManager.jsx`, with the modal's open/close state owned by `DashboardPage.jsx` (features must not cross-import each other's components)
- [x] Corrected stale info across `.claude/*.md` skill docs (wrong enum values in `database.md`, missing Leases/push/owner-response routes and a mis-documented "public" verification endpoint in `backend.md`, wrong `TrustBadge` states in `ui-ux.md`) and rewrote the entire `docs/` folder, which still described a pre-Google-Maps, pre-Railway, pre-reviews/reports/trust/leases/mobile MVP snapshot
- [x] Ran `graphify update .` to refresh the knowledge graph (1735 nodes, 2088 edges, 233 communities) after the mobile app + doc changes
- [x] Rewrote `README.md` for a new dev onboarding onto all three apps (was still Mapbox/Vercel/2-listing-limit era)

### Karpathy Cleanup Pass (2026-07-03)
- [x] Fixed all 14 pre-existing frontend lint warnings (unused imports/vars, one `react-hooks/exhaustive-deps` in `AdminPage.jsx`'s map-init cleanup)
- [x] Deleted 18 fully orphaned files — a cluster of never-wired scaffolding from the original pre-MVP pass, all confirmed zero-importer via grep: `PropertyPin.jsx`, `ClusterMarker.jsx`, `PropertyDetail.jsx`, `PropertyDetailModal.jsx` (350 lines, fully superseded by `/property/:id`), `PropertyImages.jsx`, `NearbyEssentials.jsx`, `AmenitiesList.jsx`, `FilterPanel.jsx`, `FilterChips.jsx`, `SavedList.jsx`, `useListing.js`, `useProperties.js`, `useProperty.js`, `useSaved.js`, `useSearch.js`, `property.helpers.js`, plus the standalone `AppointmentsPage.jsx` and `SavedPage.jsx` pages
- [x] **Fixed a live bug**: the `/saved` route (`SavedPage.jsx`) was a fake "coming soon" stub, but the Footer's "Saved Homes" link pointed at it — real saved-listings functionality has lived at `/user?tab=wishlist` all along. Repointed the Footer link and removed the dead `/saved` and orphaned `/appointments` routes (both pages were superseded by `DashboardPage`'s tab system; `/appointments` had zero inbound links anywhere)
- [x] Removed a stale resolved TODO in `lib/seo.js` ("update BRAND_NAME once finalised" — it already was)
- [x] Removed 2 unused imports in mobile (`View` in `PlaceholderScreen.js`, `useState` in `MyListingsScreen.js`) via a heuristic scan (mobile has no ESLint config yet)
- [x] Verified: frontend lint 0/0, frontend build succeeds, backend lint 0/0 (was already clean), mobile bundles cleanly via `expo export`

### Redis Activation + Scaling Prep (2026-07-03)
- [x] Provisioned Upstash Redis, set `REDIS_URL` (backend/.env) — activates pin/analytics/trust-score caching, Redis-backed rate limiting, and the Socket.io cross-instance adapter (all previously wired but no-op)
- [x] Fixed a data-exposure bug: map-pins cache key didn't vary by login state, but results do (`LOGGED_IN`-only listing visibility) — an anon visitor could've been served a logged-in user's cached response
- [x] Fixed a process-crash-on-boot bug: Socket.io's duplicated Redis pub/sub clients inherited cache-tuned options (`enableOfflineQueue: false`) that don't work for pub/sub — crashed the whole server on startup the instant `REDIS_URL` was set
- [x] Added a global `unhandledRejection` handler (`index.js`) — Node kills the whole process on one by default
- [x] Added `Cache-Control` headers to `/areas/*` and `/metro` (fully public, non-user-varying); added `connection_limit`/`pool_timeout` to `DATABASE_URL` (bounds Prisma's pool per instance ahead of running multiple backend instances)
- [x] Set `REDIS_URL` + `connection_limit`/`FRONTEND_URL` in Railway **production** env vars, committed + pushed all local fixes (2 commits: pre-existing P7 feature work, then today's Redis/CORS/test/CI hardening), redeployed `stayonmap-backend`
- [x] **Found a 4th bug from actually deploying, not just local testing**: `rateLimit.middleware.js` used the same fail-fast cache client for `rate-limit-redis`'s `RedisStore`, which loads Lua scripts synchronously at import time — same `enableOfflineQueue`/`lazyConnect` crash as the Socket.io adapter, causing intermittent 500s on `/health` right after boot. Only reproduces with `NODE_ENV=production` (dev short-circuits rate limiting entirely), so no local boot test caught it — only checking Railway's actual runtime logs after deploying did. Fixed the same way: a dedicated `enableOfflineQueue: true, lazyConnect: false` duplicate client. Verified locally with `NODE_ENV=production` and redeployed.
- [x] Full writeup: `docs/redis-and-scaling.md`

### Dependency & Test Hardening (2026-07-03)
- [x] `npm audit fix` — frontend now 0 vulnerabilities; backend fixed the high-severity `ws`/`engine.io`/`socket.io-adapter` issue (6 dev-only `vitest`/`vite`/`esbuild` advisories remain, no production runtime exposure, fixing requires forcing a breaking `vitest` v3→v4 bump — deliberately left alone)
- [x] Extended backend tests 26 → 59: added `appointments.test.js`, `lease.test.js`, `auth.test.js` covering ownership/conflict rules, one-way role upgrade, and city-gated waitlist signup
- [x] Fixed 2 pre-existing stale tests (`properties.test.js`) that asserted Mumbai/Pune were disallowed cities — both were promoted to `SUPPORTED_CITIES` in the P7 city expansion and nobody updated the tests

---

## ⏳ Pending

### 🔴 Legal & Compliance — not started, likely the real blocker for launch
- [ ] Privacy Policy page — **none exists**. Verification flow collects Aadhaar/PAN document uploads plus name/email/phone at signup; operating without a published privacy policy is a real compliance gap under India's DPDP Act 2023, not just best practice
- [ ] Terms of Service page — none exists
- [ ] Cookie consent — check whether anything client-side actually sets cookies/tracking first; may be moot (auth is pure Bearer-token, no cookies used per `.claude/auth.md`)

### Testing on Production (in progress 2026-07-03)
- [ ] Test login / signup
- [ ] Test map loads with pins
- [ ] Test appointment booking end-to-end
- [ ] Test image uploads via Cloudinary
- [ ] Test push notifications
- [ ] Test chat between owner and tenant
- [ ] Test admin panel at `/admin`

### Email — confirmed broken in production (2026-07-03), fix deferred by user
- [x] Checked Railway prod env vars directly (via `railway variables`) — `RESEND_API_KEY` is literally the string `"skip"`, not a real key; `RESEND_FROM_EMAIL` is a personal Gmail address, not a domain Resend can verify. Every transactional email (appointment accepted/rejected, verification updates, password reset) has been failing silently.
- [x] Fixed the silent failure: `sendEmail()`'s catch block now logs the error (`email.service.js`) instead of swallowing it with no trace
- [ ] **User will add a real Resend API key + verified sending domain later** — deferred, not blocking other work
- [ ] Once added: test appointment accepted/rejected and verification-update emails actually arrive

### Ops / CI hardening
- [x] Set `REDIS_URL` and appended `?connection_limit=5&pool_timeout=10` to `DATABASE_URL` in Railway production (`stayonmap-backend` service) — set with `--skip-deploys`, takes effect on the next deploy
- [x] Custom domain **is already live** — `stayonmap.com`/`www.stayonmap.com` are configured as custom domains on the `stayonmap-frontend` Railway service (confirmed via `railway status`). `.claude/roadmap.md`'s P5 note claiming it was still pending was stale — corrected.
- [x] **Found and fixed a real live bug**: Socket.io's CORS config only checked `FRONTEND_URL` directly, which was still the old Railway subdomain in production — Express's CORS already allow-listed `stayonmap.com` via a hardcoded array, but Socket.io didn't, so chat/notifications were silently broken for anyone visiting the real production domain. Fixed by extracting a shared `corsOriginHandler` (`backend/src/lib/corsOrigin.js`) used by both; verified with a live curl test (`stayonmap.com` origin now gets `Access-Control-Allow-Origin` back, `evil.com` doesn't).
- [x] Corrected `FRONTEND_URL` in Railway production to `https://stayonmap.com` (was the old subdomain — also used directly by password-reset email links, not just CORS)
- [ ] Check Google Maps API key HTTP referrer restrictions include `stayonmap.com` (may still only list the Railway subdomain)
- [ ] Add `npm audit` as a CI gate (`.github/workflows/ci.yml` currently only runs lint + test/build — the `ws` vulnerability fixed today could silently regress on the next `npm install` with nothing to catch it)
- [ ] Confirm Railway Postgres automated backups are enabled (dashboard setting, not verifiable from code)
- [ ] Add Sentry or similar error monitoring — **user will add later**, deferred

### Security follow-ups
- [x] Confirmed `ADMIN_SEED_PASSWORD` is not set in Railway production env vars at all (only ever used for the local one-time seed script) — but this doesn't confirm what the actual production admin account's password is, since that's a bcrypt hash already in the DB from whenever it was originally seeded
- [ ] If unsure whether production's real admin password was ever set to the weak local value, just log into `/admin` and change it directly — safer than trying to inspect the DB

### Pending Features
- [ ] Payment integration (Razorpay — on hold, needs account)
- [ ] Subscription / listing plans (depends on payments)
- [ ] Enable AI fraud detection (set `AI_PROVIDER=anthropic` in Railway when ready)

### Nice to Have
- [ ] SEO — submit sitemap.xml to Google Search Console
- [ ] Hand-authored neighborhood-intelligence profiles for Hyderabad/Delhi (currently zero entries — degrades silently, not broken)
- [ ] Add the missing `frontend/public/og-default.jpg` (1200×630 social share image) — referenced everywhere in SEO tags but the file doesn't exist, so every social share is currently showing a broken image
- [ ] Frontend/mobile automated test coverage (currently zero — backend has 59 tests as of 2026-07-03)
