-- Graph layer, step 4: the SIMILAR_TO edge, tunable ranking weights, and the
-- edge projection that makes "traverse the graph" a real operation instead of a
-- figure of speech.
--
-- No enum changes, so one migration is safe.

-- ── PropertySimilarity ──────────────────────────────────────────────────────

CREATE TABLE "PropertySimilarity" (
    "id"         TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "similarId"  TEXT NOT NULL,
    "score"      DOUBLE PRECISION NOT NULL,
    "reasons"    JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertySimilarity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropertySimilarity_propertyId_similarId_key" ON "PropertySimilarity"("propertyId", "similarId");
-- The only read this table serves: top-k for one listing.
CREATE INDEX "PropertySimilarity_propertyId_score_idx" ON "PropertySimilarity"("propertyId", "score");

-- CASCADE on both ends. An edge to a deleted listing is not a fact about
-- anything, and leaving it would surface a 404 in a "similar homes" row.
ALTER TABLE "PropertySimilarity" ADD CONSTRAINT "PropertySimilarity_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertySimilarity" ADD CONSTRAINT "PropertySimilarity_similarId_fkey"
    FOREIGN KEY ("similarId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── RankingWeights ──────────────────────────────────────────────────────────

CREATE TABLE "RankingWeights" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "weights"   JSONB NOT NULL,
    "note"      TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankingWeights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RankingWeights_name_key" ON "RankingWeights"("name");

-- Deliberately NOT seeded with a default row. Code owns the defaults
-- (features/graph/ranking.js), so an empty table is a working system; a seeded
-- row would be a second copy of the same numbers, free to drift from the code
-- that documents what each one means.

-- ── GraphEdge — the projection ──────────────────────────────────────────────
--
-- The thesis of this whole layer is that PostgreSQL IS the graph: the
-- relationships already exist as foreign keys and join tables, and what was
-- missing was a way to walk them uniformly. This view is that uniformity — one
-- (src, dst, type) shape over relationships that are physically stored six
-- different ways.
--
-- Node ids are "Type:id", exactly as the brief specifies, so every node in a
-- traversal result points back at an unambiguous PostgreSQL row.
--
-- A VIEW rather than a table: it stores nothing, cannot drift from the rows it
-- projects, and needs no synchronisation. That is the entire reason there is no
-- separate graph store to keep in step.
--
-- Not modelled in schema.prisma — Prisma's `views` support is a preview feature,
-- and adopting a preview flag for one read is a poor trade. It is queried with
-- $queryRaw from features/graph/repository.js, which is the one place that knows
-- this exists.
--
-- SCALE NOTE: traversal over this view is bounded by depth and row limit in the
-- repository, which is what keeps it honest at any size. If the union itself
-- ever becomes the cost, the answer is a materialised edge table refreshed on
-- write — not a graph database. See docs/graph-layer-proposal-2026-08-07.md.
CREATE VIEW "GraphEdge" AS
    -- A listing sits in an area.
    SELECT 'Property:' || p."id"   AS src,
           'Locality:' || p."localityId" AS dst,
           'LOCATED_IN'            AS type
      FROM "Property" p
     WHERE p."localityId" IS NOT NULL

    UNION ALL
    -- …and an area sits in a city. City is a config constant, not a table, so
    -- the node is synthesised from the column. It is still a real node id.
    SELECT DISTINCT 'Locality:' || l."id", 'City:' || l."citySlug", 'IN_CITY'
      FROM "Locality" l

    UNION ALL
    -- Who listed it.
    SELECT 'Property:' || p."id", 'User:' || p."ownerId", 'LISTED_BY'
      FROM "Property" p

    UNION ALL
    -- What it is.
    SELECT 'Property:' || p."id", 'PropertyType:' || p."type", 'HAS_TYPE'
      FROM "Property" p

    UNION ALL
    -- What it has.
    SELECT 'Property:' || pa."propertyId", 'Amenity:' || pa."amenityId", 'HAS_AMENITY'
      FROM "PropertyAmenity" pa

    UNION ALL
    -- What it resembles.
    SELECT 'Property:' || ps."propertyId", 'Property:' || ps."similarId", 'SIMILAR_TO'
      FROM "PropertySimilarity" ps

    UNION ALL
    -- What a person kept.
    SELECT 'User:' || s."userId", 'Property:' || s."propertyId", 'SAVED'
      FROM "SavedListing" s

    UNION ALL
    -- What a person looked at.
    SELECT 'User:' || v."userId", 'Property:' || v."propertyId", 'VIEWED'
      FROM "PropertyViewer" v

    UNION ALL
    -- Who asked to visit what.
    SELECT 'User:' || a."tenantId", 'Property:' || a."propertyId", 'REQUESTED_VISIT'
      FROM "Appointment" a

    UNION ALL
    -- Who talked to whom about what. The edge that makes CONTACTED navigable
    -- without exposing a single message.
    SELECT 'User:' || c."tenantId", 'User:' || c."ownerId", 'CONTACTED'
      FROM "Conversation" c;
