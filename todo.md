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

---

## ⏳ Pending

### Testing on Production
- [ ] Test login / signup
- [ ] Test map loads with pins
- [ ] Test appointment booking end-to-end
- [ ] Test image uploads via Cloudinary
- [ ] Test push notifications
- [ ] Test chat between owner and tenant
- [ ] Test admin panel at `/admin`

### Email
- [ ] Set up proper Resend account and verify sending domain
- [ ] Test appointment accepted / rejected emails
- [ ] Test verification update emails

### Pending Features
- [ ] Payment integration (Razorpay — on hold, needs account)
- [ ] Subscription / listing plans (depends on payments)
- [ ] Enable AI fraud detection (set `AI_PROVIDER=anthropic` in Railway when ready)

### Nice to Have
- [ ] SEO — submit sitemap.xml to Google Search Console
- [ ] Add more cities (Mumbai, Pune, Kolkata)
- [ ] Add the missing `frontend/public/og-default.jpg` (1200×630 social share image) — referenced everywhere in SEO tags but the file doesn't exist, so every social share is currently showing a broken image
