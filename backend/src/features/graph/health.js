// Is the graph actually built?
//
// The brief asks for observability on graph and ranking latency. The honest
// version of that here is TWO different questions, and only one of them is about
// speed:
//
//   COVERAGE — how much of the graph exists at all. This is the one that
//   matters at this stage, because every failure so far has been a thing that
//   was never computed rather than a thing that was slow. A listing with no
//   SIMILAR_TO edges and a listing whose edges are slow to read look identical
//   to a user (an empty row), and only one of them has ever happened.
//
//   LATENCY — how long tool calls take. Kept in-process, in a rolling window,
//   deliberately NOT in a table: metrics storage is a real system, this is a
//   handful of counters, and a table would need retention, pruning and a
//   migration to answer a question a restart may legitimately forget.
//
// Read-only. Nothing here computes or repairs anything — it reports, and the
// repair is a script an operator runs.
import { prisma } from '../../lib/prisma.js'
import { intelError } from '../../lib/intelLog.js'
import { TOOL_NAMES } from './tools.js'

// ── Latency, in process ─────────────────────────────────────────────────────
// Per tool: call count, failures, and a bounded sample of durations. Bounded
// because an unbounded array in a long-lived process is a memory leak wearing a
// metrics costume.
const SAMPLE_SIZE = 100
const samples = new Map()

/** Called by runTool on every call. Cheap by design — it is on the hot path. */
export function recordToolTiming(tool, ms, ok) {
  let stat = samples.get(tool)
  if (!stat) {
    stat = { calls: 0, failures: 0, durations: [] }
    samples.set(tool, stat)
  }
  stat.calls++
  if (!ok) stat.failures++
  stat.durations.push(ms)
  if (stat.durations.length > SAMPLE_SIZE) stat.durations.shift()
}

/** Test seam, and the reset an operator gets for free by restarting. */
export function resetToolTimings() {
  samples.clear()
}

function percentile(sorted, p) {
  if (!sorted.length) return null
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))
  return sorted[index]
}

export function toolLatency() {
  return [...samples.entries()]
    .map(([tool, stat]) => {
      const sorted = [...stat.durations].sort((a, b) => a - b)
      return {
        tool,
        calls: stat.calls,
        failures: stat.failures,
        p50: percentile(sorted, 0.5),
        // p95 over a 100-sample window, so it is a recent picture rather than a
        // lifetime average that hides a regression under months of good data.
        p95: percentile(sorted, 0.95),
      }
    })
    .sort((a, b) => b.calls - a.calls)
}

// ── Coverage ────────────────────────────────────────────────────────────────

/**
 * What fraction of the graph exists, and what to run if it doesn't.
 *
 * Every metric here names the script that fixes it. A coverage number with no
 * remedy beside it is a number somebody reads, frowns at, and forgets.
 */
export async function getGraphHealth() {
  try {
    const [activeListings, withSimilarity, withLocality, localities, aliases, similarityEdges, fingerprints, images] =
      await Promise.all([
        prisma.property.count({ where: { status: 'ACTIVE' } }),
        // DISTINCT listings that have at least one edge — not a row count, which
        // would exceed the listing count and read as >100% coverage.
        prisma.propertySimilarity.findMany({ distinct: ['propertyId'], select: { propertyId: true } })
          .then((rows) => rows.length),
        prisma.property.count({ where: { status: 'ACTIVE', localityId: { not: null } } }),
        prisma.locality.count(),
        prisma.localityAlias.count(),
        prisma.propertySimilarity.count(),
        prisma.imageFingerprint.count(),
        prisma.propertyImage.count(),
      ])

    const bySource = await prisma.locality.groupBy({ by: ['source'], _count: { _all: true } })

    const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null)

    return {
      listings: { active: activeListings },
      similarity: {
        listingsWithEdges: withSimilarity,
        coveragePct: pct(withSimilarity, activeListings),
        totalEdges: similarityEdges,
        // The gap this closes is real: edges are built on create/edit/moderation,
        // so a listing that was already ACTIVE when the feature shipped never
        // gets any until somebody runs this.
        remedy: withSimilarity < activeListings ? 'node scripts/backfill-similarity.mjs --confirm' : null,
      },
      locality: {
        resolved: withLocality,
        coveragePct: pct(withLocality, activeListings),
        localities,
        aliases,
        // BOUNDARY means the area came from the map; LANDMARK means it fell back
        // to owner-typed text. An all-LANDMARK city usually means the boundary
        // seeder never ran there.
        bySource: Object.fromEntries(bySource.map((r) => [r.source, r._count._all])),
        remedy: withLocality < activeListings ? 'node scripts/backfill-localities.mjs --confirm' : null,
      },
      images: {
        fingerprinted: fingerprints,
        total: images,
        coveragePct: pct(fingerprints, images),
        // Until this is 100%, reused-photo detection is INERT rather than wrong:
        // with no fingerprint it reports "no evidence", never a false match.
        remedy: fingerprints < images ? 'node scripts/backfill-image-fingerprints.mjs --confirm' : null,
      },
      tools: {
        registered: TOOL_NAMES.length,
        // Empty until tools are called in this process — a restart forgets, and
        // that is an accepted trade for not building a metrics store.
        latency: toolLatency(),
      },
    }
  } catch (err) {
    intelError('graph.health_failed', err, {})
    return null
  }
}
