-- View HISTORY, which Property.viewCount could not provide: it is a lifetime
-- total, and the host dashboard asks windowed questions ("last 30 days") plus
-- one per-person question ("she has viewed it 4 times") beside a visit request.

-- One row per listing per day. Deliberately NOT one row per view event: a
-- listing with real traffic would generate millions of rows to answer a
-- question that only ever needs daily totals.
CREATE TABLE IF NOT EXISTS "PropertyDailyView" (
    "id"         TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "day"        DATE NOT NULL,
    "count"      INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PropertyDailyView_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PropertyDailyView_propertyId_day_key" ON "PropertyDailyView"("propertyId", "day");
CREATE INDEX IF NOT EXISTS "PropertyDailyView_day_idx" ON "PropertyDailyView"("day");
ALTER TABLE "PropertyDailyView" DROP CONSTRAINT IF EXISTS "PropertyDailyView_propertyId_fkey";
ALTER TABLE "PropertyDailyView" ADD CONSTRAINT "PropertyDailyView_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-identified-viewer counts. Surfaced to an owner in exactly one place:
-- beside a visit request from that same person, who has already identified
-- themselves by asking to come round. There is no "who looked at my listing"
-- endpoint, and there must not be one — that would be surveillance of people
-- who only browsed.
CREATE TABLE IF NOT EXISTS "PropertyViewer" (
    "id"           TEXT NOT NULL,
    "propertyId"   TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "count"        INTEGER NOT NULL DEFAULT 1,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyViewer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PropertyViewer_propertyId_userId_key" ON "PropertyViewer"("propertyId", "userId");
CREATE INDEX IF NOT EXISTS "PropertyViewer_userId_idx" ON "PropertyViewer"("userId");
ALTER TABLE "PropertyViewer" DROP CONSTRAINT IF EXISTS "PropertyViewer_propertyId_fkey";
ALTER TABLE "PropertyViewer" ADD CONSTRAINT "PropertyViewer_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
