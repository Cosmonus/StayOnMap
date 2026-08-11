-- Enum values ONLY. Postgres cannot use a newly-added enum value in the same
-- transaction that added it, so the tables and columns that reference these
-- live in the next migration (see .claude/database.md's migration gotcha).

-- Does this POI still exist as far as our sources are concerned?
--
-- Deliberately TWO values, not the nine-stage pipeline a POI-quality brief
-- usually asks for. DISCOVERED / NORMALIZED / MATCHED / REVALIDATED are things
-- the PIPELINE did, not states the row is in — modelling a pipeline stage as a
-- row status means the column answers "where did this get to last Tuesday"
-- rather than "does this place exist", and the two drift the moment a stage is
-- reordered.
--
-- ABSENT_FROM_SOURCE is likewise NOT "closed". A POI vanishing from OSM means
-- demolished, retagged out of our vocabulary, re-mapped under a new osmId, OR a
-- mapper's mistake. We can observe the absence; we cannot observe the reason,
-- and a value called CLOSED would assert one we do not have.
CREATE TYPE "PoiStatus" AS ENUM ('ACTIVE', 'ABSENT_FROM_SOURCE');

-- What happened to a recorded disagreement.
--
-- Conflicts are their own table rather than a POI status, because a place can
-- be perfectly ACTIVE and simultaneously have an open disagreement about its
-- phone number. Folding the two together forces a row to pick one fact to
-- report and loses the other.
CREATE TYPE "PoiConflictStatus" AS ENUM (
    -- Recorded, nobody has looked.
    'OPEN',
    -- The incoming value was applied, or later confirmed correct.
    'ACCEPTED',
    -- The incoming value was wrong; the stored value was kept.
    'REJECTED',
    -- A later fetch conflicted on the same attribute, so this one is history.
    'SUPERSEDED'
);
