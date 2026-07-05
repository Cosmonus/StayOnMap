# StayOnMap — Progress Tracker

---

## 🔍 Manual Walkthrough — Tomorrow (2026-07-05)

Everything below is unresolved as of 2026-07-04. Detailed context for each item
lives in the dated sections further down this file — this is just the clean
checklist to work through. Nothing here has been done yet.

### Navbar redesign — on hold, discuss tomorrow
- [ ] User wants 3 visually/functionally distinct navbars instead of the current shared one: (1) homepage/guest nav, (2) a dedicated after-login (Dashboard `/user`) nav, (3) a dedicated "become a host" (`/list`) nav. Paused mid-design — no code changes made yet (a draft `DashboardHeader.jsx` was started then removed, unwired). Needs a decision on exactly what each navbar should contain before implementing.

### Legal & Compliance
- [ ] Fill in the 4 placeholders in `/privacy` and `/terms`: legal entity name, registered business address, Grievance Officer name, governing-law jurisdiction city
- [ ] Get a real lawyer to review both pages before relying on them — Aadhaar/PAN handling carries real regulatory weight under India's DPDP Act 2023
- [ ] **Visually open `/privacy` and `/terms` in a real browser** — confirmed served (200) and lints/builds clean, but never actually seen rendered (no browser automation available this session)
- [ ] Confirm no cookie consent banner is needed (auth is pure JWT/Bearer, no tracking cookies — should be moot, but confirm)

### Security
- [ ] **Rotate the production admin password** — confirmed weak, confirmed it was hardcoded in git history since the initial commit
- [ ] Decide whether to rewrite git history to fully scrub the old hardcoded password (disruptive — force-push, breaks existing clones/PR refs). Rotating the password already neutralizes the actual risk; this is optional hygiene on top
- [ ] Check Google Maps API key HTTP referrer restrictions include `stayonmap.com` (may still only list the old Railway subdomain)
- [ ] Confirm Railway Postgres automated backups are enabled (dashboard setting, not verifiable from code)

### Email
- [ ] Add a real Resend API key (currently literally the string `"skip"`)
- [ ] Set `RESEND_FROM_EMAIL` to a real domain-verified sender (currently a personal Gmail address, will not deliver reliably)
- [ ] Confirm the sending domain shows **Verified** in Resend's dashboard
- [ ] Once set up: test appointment accepted/rejected + verification-update emails actually arrive

### Deferred integrations
- [ ] Add Sentry (or similar) error monitoring
- [ ] Payments (Razorpay — needs an account first)
- [ ] Subscriptions (depends on payments)
- [ ] Enable AI fraud detection (`AI_PROVIDER=anthropic`) when ready

### Cleanup
- [ ] Test data sitting in **production**: one test tenant account, one test owner account, one test property, one test appointment, one test chat conversation — no self-service delete endpoint exists; needs direct DB access, or leave as harmless clutter
- [ ] Decide what to do with the untracked `"StayOnMap Mobile.pdf"` at the repo root — never touched, never committed
- [ ] Optional: remove the dead-code duplicate admin-reviews implementation (`reviews.routes.js`'s `adminReviewRouter`, permanently shadowed and unreachable)
- [ ] Add the missing `frontend/public/og-default.jpg` (1200×630) — referenced in every SEO tag but the file does not exist, so social shares currently show a broken image
- [ ] Hand-author neighborhood-intelligence profiles for Hyderabad/Delhi (currently zero entries there — Chennai/Bengaluru only)

### Manual browser testing — everything I could only verify at the API layer, not visually
- [ ] Click through login/signup in the real UI
- [ ] Confirm the map actually renders pins visually (API layer confirmed working)
- [ ] Click through appointment booking end-to-end in the UI
- [ ] Test the image upload UI flow
- [ ] Test push notifications with a real browser subscription (cannot be done via API calls alone)
- [ ] Test chat in the real UI (data layer confirmed working via API)
- [ ] Click through the admin panel UI itself

### Nice to have / longer-term
- [ ] Submit `sitemap.xml` to Google Search Console
- [ ] Frontend/mobile automated test coverage (currently zero — backend has 59 tests)
- [ ] Add an ESLint config to `mobile/` (currently none)

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

### Manual Production Testing Pass (2026-07-03)
Tested directly against production (`stayonmap-backend-production.up.railway.app`
+ `stayonmap.com`), not local dev — via real API calls, not just reading code.
- [x] **Login/signup** — register (success, duplicate-email 409, password validation), login (success, wrong-password 401), `/auth/me` (with/without token). All correct. Minor cosmetic-only finding: every error response's `error` field defaults to generic `"INTERNAL_ERROR"` (`error.middleware.js`'s `err.code || 'INTERNAL_ERROR'`) since nothing sets `.code` — `statusCode`/`message` are always correct and that's what the frontend actually branches on, so not fixed, just noted.
- [x] **Map/pins** — found and fixed the `/properties/pins` 500-on-missing-bounds bug (see Ops/CI hardening above). Confirmed empty-array response is correct behavior for real (non-fake) data, not a bug: **there are currently zero real properties in the production database.**
- [x] **Appointment booking + chat, full synthetic flow** — created a test owner account, uploaded a real test image via `/uploads/property-image` (confirmed real Supabase URL, UUID filename per the documented security pattern), created a property, published it, approved it to ACTIVE via the admin API, booked an appointment as a separate test tenant account, confirmed the chat conversation auto-creates with an appointment-summary message, accepted the appointment as owner, confirmed both an `APPOINTMENT_ACCEPTED` notification and a chat-message notification fired for the tenant. **Everything in this chain worked correctly, no bugs found.**
- [x] **Admin panel** — confirmed admin login, users list, waitlist, property moderation (PENDING→ACTIVE) all work. **Confirmed the production admin password really is the weak local seed value** (redacted here — see Security follow-ups below, do not paste the actual value back into this file) — tested `POST /admin/login` directly against production with it, succeeded. Not hypothetical. Also found and corrected stale admin route docs in `.claude/backend.md` (`/dashboard`→`/analytics`, `/activity`→`/logs`, a documented `GET /admin/trust-scores` that doesn't exist, wrong HTTP method on the AI fraud-scan route) plus a confirmed-dead-code finding: `reviews.routes.js`'s `adminReviewRouter` is permanently unreachable, shadowed by `admin.routes.js`'s own `/reviews` handlers registered first — not fixed (not urgent, the reachable copy is the one already in use), just documented so nobody edits the dead copy by mistake.
- [x] **Push notifications** — confirmed the public VAPID key endpoint responds correctly. Full subscribe/receive flow needs a real browser push subscription, not testable via API calls alone — left for actual browser use.
- [ ] **Test data now sitting in production**, no self-service delete endpoint exists for any of it: test tenant account (`claude-test-verify-20260703@example.com`), test owner account (`claude-test-owner-20260703@example.com`), one test property ("Claude Test Property Verification", Chennai), one test appointment, one test chat conversation + 2 messages. Needs cleanup via direct DB access or left as harmless clutter — user's call.

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
- [x] Added `npm audit` as a CI gate (`.github/workflows/ci.yml`, `--omit=dev --audit-level=high` on both backend/frontend) — verified it passes cleanly today
- [ ] Confirm Railway Postgres automated backups are enabled (dashboard setting, not verifiable from code)
- [ ] Add Sentry or similar error monitoring — **user will add later**, deferred
- [x] **Found a live 500 via manual testing**: `GET /properties/pins` with missing/malformed bounds crashed with a 500 (NaN reaching Prisma) instead of a 400 — the query-validation schema that would've caught this (`listQuerySchema`) was defined but never actually wired up anywhere, and the `validate()` middleware never supported query validation at all despite `.claude/backend.md` documenting it as a real pattern. Fixed: `validate()` now takes a `target` param, added a dedicated `pinsQuerySchema` (bounds required, unlike the general list endpoint), verified against production.

### Security follow-ups
- [x] **CONFIRMED (not hypothetical): production's real admin password is the weak local seed value** — tested `POST /admin/login` against production directly with it, it succeeded. Not a "might be."
- [x] **Escalation found later the same day: that exact password was hardcoded in git history since the initial commit** — `backend/prisma/seed.js` had it as a fallback default, and `backend/scripts/update-admin.js` hardcoded it directly and `console.log`'d the full email/password pair. Fixed both: `seed.js` now requires `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` with no fallback (exits with an error if unset), `update-admin.js` now reads `ADMIN_EMAIL`/`ADMIN_PASSWORD` from the environment and no longer logs the password. The repo is private (confirmed via GitHub API — unauthenticated requests get a 404), so exposure is limited to Cosmonus org members/collaborators, not the public internet, but it is still a real leaked credential in shared version control.
- [ ] **User will rotate the admin password themselves** via `/admin` — given the escalation above, this is more urgent than "later": rotating it makes the already-leaked value harmless regardless of git history. Note that editing/removing the value from current files does not remove it from git history — full remediation would need a history rewrite (e.g. `git filter-repo`), which is a separate, more disruptive step to consider only if the org wants to fully scrub it, since rotating the actual password is what neutralizes the risk.

### Pending Features
- [ ] Payment integration (Razorpay — on hold, needs account)
- [ ] Subscription / listing plans (depends on payments)
- [ ] Enable AI fraud detection (set `AI_PROVIDER=anthropic` in Railway when ready)

### Nice to Have
- [ ] SEO — submit sitemap.xml to Google Search Console
- [ ] Hand-authored neighborhood-intelligence profiles for Hyderabad/Delhi (currently zero entries — degrades silently, not broken)
- [ ] Add the missing `frontend/public/og-default.jpg` (1200×630 social share image) — referenced everywhere in SEO tags but the file doesn't exist, so every social share is currently showing a broken image
- [ ] Frontend/mobile automated test coverage (currently zero — backend has 59 tests as of 2026-07-03)
