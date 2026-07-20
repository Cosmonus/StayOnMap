-- The OSM tag each PoiIndex row was classified from, e.g. "leisure=garden".
--
-- Without it the tag→category mapping is lossy and irreversible: a suspected
-- mis-mapping cannot be measured against stored data, and correcting one means
-- re-fetching the country instead of reclassifying in place. Nullable: rows
-- seeded before this column keep working, and null reads as "not recorded".
ALTER TABLE "PoiIndex" ADD COLUMN IF NOT EXISTS "sourceTag" TEXT;

-- Indexed because the point is to ASK questions of it ("how many park rows came
-- from leisure=garden"), which is a scan over 114k+ rows otherwise.
CREATE INDEX IF NOT EXISTS "PoiIndex_sourceTag_idx" ON "PoiIndex"("sourceTag");
