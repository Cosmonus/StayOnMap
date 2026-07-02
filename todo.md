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
