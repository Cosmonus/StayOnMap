-- The attributes needed to have a confidence ABOUT, and the score itself.
--
-- Two halves, and the first is a prerequisite for the second: reporting a
-- "contact confidence" for a column that does not exist would be reporting
-- confidence in nothing. OSM already carries phone, website and addr:* on the
-- elements we fetch; we were discarding them.
--
-- ADDITIVE ONLY. Every column is nullable, nothing is backfilled, and the
-- serving path does not read any of them until a consumer asks.

-- ─────────────────────────────────────────────────────────────────
-- Attributes, straight from OSM tags
-- ─────────────────────────────────────────────────────────────────

-- Sparse in India and shown only when present, never inferred — the same rule
-- `brand` and `openingHours` already follow.
ALTER TABLE "PoiIndex" ADD COLUMN "phone"    TEXT;
ALTER TABLE "PoiIndex" ADD COLUMN "website"  TEXT;
-- addr:housenumber + addr:street + addr:suburb, composed at ingestion. Stored
-- composed rather than as four columns because nothing queries the parts, and
-- promoting them is a migration away if something ever does.
ALTER TABLE "PoiIndex" ADD COLUMN "address"  TEXT;
-- Its own column, unlike the rest of the address, because it is the JOIN KEY to
-- PincodeDirectory and therefore the only independent check we can run on a POI
-- today. This is the rule PoiIndex's own comment states — promote a value out
-- of a blob when something FILTERS or JOINS on it — applied.
ALTER TABLE "PoiIndex" ADD COLUMN "postcode" TEXT;

-- The verification join's access path. Most rows have no postcode, so this is
-- narrow and cheap.
CREATE INDEX "PoiIndex_postcode_idx" ON "PoiIndex"("postcode");

-- ─────────────────────────────────────────────────────────────────
-- Confidence, trust and verification
-- ─────────────────────────────────────────────────────────────────

-- 0-100, or NULL for "never scored" — which is every row until the background
-- job runs, and is deliberately distinct from 0 ("scored, and we do not trust
-- it"). A dashboard that cannot tell those apart reports an unscored database
-- as a worthless one.
ALTER TABLE "PoiIndex" ADD COLUMN "trustScore" INTEGER;

-- WHY the score is what it is: the per-factor chain, in the same shape module
-- envelopes use. A bare score invites the reader to treat it as a measurement
-- of the place rather than a measurement of our knowledge of it, and this is
-- the column that stops that.
ALTER TABLE "PoiIndex" ADD COLUMN "trustReasons" JSONB;

-- Per-attribute confidence: location, identity, category, address, contact,
-- hours. JSON rather than six columns, per PoiIndex's own promotion rule — no
-- filter needs an individual attribute's confidence, and six nullable Decimals
-- would be six columns to keep in step with one table in poiTrust.js.
ALTER TABLE "PoiIndex" ADD COLUMN "confidence" JSONB;

-- Null means never scored. Lets the background job find work with an index
-- rather than re-scoring the whole table on every tick.
ALTER TABLE "PoiIndex" ADD COLUMN "scoredAt" TIMESTAMP(3);

ALTER TABLE "PoiIndex" ADD COLUMN "verificationStatus" "PoiVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
-- What actually did the checking, in plain words — 'india_post_pincode' today.
-- A status with no method is a claim with no evidence.
ALTER TABLE "PoiIndex" ADD COLUMN "verificationMethod" TEXT;
ALTER TABLE "PoiIndex" ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- The background job's work queue: oldest-scored first, nulls first. Also the
-- dashboard's "how much of this city has never been scored".
CREATE INDEX "PoiIndex_scoredAt_idx" ON "PoiIndex"("scoredAt");
-- The rollups: trust by city, and the low-confidence review list.
CREATE INDEX "PoiIndex_city_trustScore_idx" ON "PoiIndex"("city", "trustScore");
