-- Graph layer, step 1-3. Three independent additions, no enum changes, so one
-- migration is safe (see .claude/database.md's enum gotcha for when it is not).
--
--   1. Locality + LocalityAlias  — the area a listing is IN, as an entity
--   2. SearchDemand              — what people asked for and whether we had it
--   3. ImageFingerprint          — dHash per uploaded image, for REUSED_IMAGES
--
-- Every one of them is additive. Property.localityId is nullable with ON DELETE
-- SET NULL, so this migration changes no existing read path: readers that do not
-- know about localities keep reading `landmark` exactly as before.

-- ── 1. Locality ─────────────────────────────────────────────────────────────

CREATE TABLE "Locality" (
    "id"         TEXT NOT NULL,
    "city"       TEXT NOT NULL,
    "citySlug"   TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "slug"       TEXT NOT NULL,
    "source"     TEXT NOT NULL,
    "osmId"      TEXT,
    "adminLevel" INTEGER,
    "lat"        DECIMAL(10,7),
    "lng"        DECIMAL(10,7),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Locality_pkey" PRIMARY KEY ("id")
);

-- One row per OSM boundary. Unique so a re-resolve updates in place rather than
-- forking a second locality for the same real place.
CREATE UNIQUE INDEX "Locality_osmId_key" ON "Locality"("osmId");
-- The public URL's identity: /rent/:citySlug/:slug.
CREATE UNIQUE INDEX "Locality_citySlug_slug_key" ON "Locality"("citySlug", "slug");
CREATE INDEX "Locality_city_idx" ON "Locality"("city");

CREATE TABLE "LocalityAlias" (
    "id"         TEXT NOT NULL,
    "localityId" TEXT NOT NULL,
    "text"       TEXT NOT NULL,
    "slug"       TEXT NOT NULL,
    "citySlug"   TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalityAlias_pkey" PRIMARY KEY ("id")
);

-- Two localities in one city must never claim the same alias slug, or
-- /rent/:city/:slug has two right answers.
CREATE UNIQUE INDEX "LocalityAlias_citySlug_slug_key" ON "LocalityAlias"("citySlug", "slug");
CREATE INDEX "LocalityAlias_localityId_idx" ON "LocalityAlias"("localityId");

ALTER TABLE "LocalityAlias" ADD CONSTRAINT "LocalityAlias_localityId_fkey"
    FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Property" ADD COLUMN "localityId" TEXT;
CREATE INDEX "Property_localityId_idx" ON "Property"("localityId");

-- SET NULL, not CASCADE. Deleting a locality row (a re-seed, a merge) must
-- never delete listings — the listing is the fact, the locality is our reading
-- of where it sits.
ALTER TABLE "Property" ADD CONSTRAINT "Property_localityId_fkey"
    FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. SearchDemand ─────────────────────────────────────────────────────────

CREATE TABLE "SearchDemand" (
    "id"              TEXT NOT NULL,
    "day"             DATE NOT NULL,
    "signature"       TEXT NOT NULL,
    "cellGeohash"     TEXT NOT NULL,
    "city"            TEXT,
    "type"            TEXT,
    "pricingModel"    TEXT,
    "bhk"             INTEGER,
    "rentBand"        TEXT,
    "searches"        INTEGER NOT NULL DEFAULT 0,
    "zeroResults"     INTEGER NOT NULL DEFAULT 0,
    "lastResultCount" INTEGER,
    "firstSeenAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchDemand_pkey" PRIMARY KEY ("id")
);

-- The upsert key: one row per query shape per day.
CREATE UNIQUE INDEX "SearchDemand_day_signature_key" ON "SearchDemand"("day", "signature");
-- The readout: worst unmet demand in a window.
CREATE INDEX "SearchDemand_day_zeroResults_idx" ON "SearchDemand"("day", "zeroResults");
CREATE INDEX "SearchDemand_cellGeohash_day_idx" ON "SearchDemand"("cellGeohash", "day");

-- No userId column, and deliberately nowhere to add one — see the model comment.
-- This table carries no personal data, so it needs no FK and no cascade.

-- ── 3. ImageFingerprint ─────────────────────────────────────────────────────

CREATE TABLE "ImageFingerprint" (
    "id"         TEXT NOT NULL,
    "url"        TEXT NOT NULL,
    "hash"       TEXT NOT NULL,
    "uploaderId" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageFingerprint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImageFingerprint_url_key" ON "ImageFingerprint"("url");
CREATE INDEX "ImageFingerprint_hash_idx" ON "ImageFingerprint"("hash");
CREATE INDEX "ImageFingerprint_uploaderId_idx" ON "ImageFingerprint"("uploaderId");

-- uploaderId is NOT a foreign key on purpose: an upload can precede any listing,
-- and deleting an account must not erase the fingerprint of an image still live
-- on a listing that account no longer owns.
