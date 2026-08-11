-- Enum value only — the columns that use it are in the next migration, because
-- Postgres cannot use a newly-added enum value in the transaction that added it.

-- Has anything INDEPENDENT of the source corroborated this place?
--
-- Three values, and every one of them is reachable today. That constraint is
-- the point: a verification vocabulary full of states nothing can currently
-- produce reads as a roadmap, and a roadmap in an enum column is indexed,
-- queried and reported on as though it were data.
--
-- The one independent check that exists right now is the postcode. OSM carries
-- `addr:postcode` on a minority of Indian POIs; PincodeDirectory carries India
-- Post's own district and state for every pincode in the country. Agreement
-- between a volunteer mapper and a government directory is genuine
-- corroboration from a source with no knowledge of the other.
CREATE TYPE "PoiVerificationStatus" AS ENUM (
    -- Nothing has checked this, which is the honest state for most rows.
    -- Distinct from CONTRADICTED: not-checked is not a finding.
    'UNVERIFIED',
    -- An independent source agrees. Today that means the OSM postcode resolves
    -- to the state the POI's city is in.
    'CROSS_CHECKED',
    -- An independent source DISAGREES. This is the interesting one and it is
    -- deliberately not called "invalid" — a mapper's typo, a genuinely
    -- mis-placed POI and a pincode that legitimately straddles a boundary all
    -- land here, and the row does not know which.
    'CONTRADICTED'
);
