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

---

## ⏳ Pending

### Deployment & Infrastructure
- [ ] Add Supabase redirect URL → Authentication → URL Configuration → add `https://stayonmap-frontend-production-23f8.up.railway.app/**`
- [ ] Restrict Google Maps API key to production domain in Google Cloud Console
- [ ] Set up custom domain (e.g. `stayonmap.in`) — optional
- [ ] Seed admin account on production DB (`node prisma/seed.js`)

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
- [ ] Custom 404 page
- [ ] SEO — submit sitemap.xml to Google Search Console
- [ ] Performance — lazy load heavy route components
- [ ] Add more cities (Mumbai, Pune, Kolkata)
