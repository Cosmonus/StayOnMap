// Thresholds mirror the ad-hoc figures used during the manual cleanup
// documented in .claude/roadmap.md's Addenda 3-9 — kept as named constants
// here so future data passes reuse the same tolerances instead of
// reinventing them per one-off script.

// India bounding box — reused verbatim from .claude/security.md's existing
// property-coordinate validation convention, so metro data is checked
// against the same bounds as everything else in this codebase.
export const INDIA_BOUNDS = { minLat: 6, maxLat: 38, minLng: 68, maxLng: 98 }

// A station within this distance of a line's path counts as a genuine
// interchange point for that line (Addendum 6's "tight match").
export const INTERCHANGE_MATCH_METERS = 400

// A station within this distance of *some* line counts as mapped to it;
// beyond this, it's an unmapped/orphan station (Addendum 6's fallback, also
// used as the gap threshold for splitting a line into components —
// Addendum 4's precedent).
export const UNMAPPED_STATION_METERS = 2000
export const PATH_GAP_METERS = 2000

// A gap larger than this on top of the ordinary PATH_GAP_METERS split is
// treated as "possibly an unmodeled branch" rather than just a regular
// residual gap.
export const POSSIBLE_BRANCH_GAP_METERS = 5000

// A line's start/end point should have a real station within this distance
// (Addendum 7's precedent) or it's flagged as terminating unexpectedly.
export const TERMINUS_MATCH_METERS = 500

// Points closer together than this are treated as the "same point" for
// self-loop / duplicate-consecutive-point checks.
export const DUPLICATE_POINT_METERS = 5

// Cities whose metro network is legitimately not built yet — an empty
// `lines` array (and therefore every station being "unmapped") is expected,
// not a defect. See .claude/maps.md's Neighborhood Intelligence section.
export const CITIES_WITH_NO_METRO_YET = new Set(['Surat'])

// Line names containing any of these (lowercase; matched case-insensitively)
// are exempt from the "self-looping path" check — a handful of real transit
// lines are legitimately circular. An explicit extension point rather than
// special-casing a specific line name inline in rules.js.
//   - Rapid MetroRail Gurgaon: Phase 1 is a genuine one-way loop around
//     DLF Cyber City — its path really does start and end at the same point.
export const LOOP_LINE_NAME_HINTS = ['rapid metrorail gurgaon']
