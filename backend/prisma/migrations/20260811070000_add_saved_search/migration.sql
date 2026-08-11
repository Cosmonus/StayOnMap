-- A filter set worth telling somebody about later.
--
-- `query` is the VALIDATED output of the same Zod shape /pins takes, stored
-- whole — a saved search IS a saved pins query, so the matcher hands it
-- straight to buildFilterWhere() and cannot drift from what the map showed.
-- Json rather than columns for the same reason SpatialContext.modules is:
-- the shape follows the filter registry, which changes; nothing filters ON a
-- stored search, so nothing earns promotion to a real column.
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
