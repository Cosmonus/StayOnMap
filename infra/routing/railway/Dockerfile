# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# StayOnMap routing server — self-contained OSRM (FOOT profile) for Railway.
#
# Railway builders have no volumes and no shell access, so unlike
# ../setup-osrm.sh (which stages data on a VPS disk), EVERYTHING happens
# inside the image build:
#
#   Stage "clip"   debian + osmium-tool: download Geofabrik India (~1.5 GB),
#                  cut it to the 9 supported-city bboxes (inlined below from
#                  ../extracts.json — regenerate there from
#                  backend/src/config/cityCenters.js if cities change, then
#                  mirror here), merge into one cities.osm.pbf (~300-500 MB).
#   Stage "graph"  osrm-backend: osrm-extract with the FOOT profile, then the
#                  MLD pipeline (osrm-partition + osrm-customize). MLD, NOT
#                  contract/CH — CH preprocessing needs far more RAM; MLD is
#                  what ../docker-compose.yml serves and what fits a shared
#                  builder.
#   Final          osrm-backend runtime + ONLY the .osrm* graph artifacts.
#
# Expected sizes (estimates — verify on first build):
#   download        ~1.5 GB (never in a layer; deleted in the same RUN)
#   cities.osm.pbf  ~300-500 MB (clip-stage layer, discarded by multi-stage)
#   .osrm* graph    ~2-4 GB for the 9-city foot network
#   final image     osrm runtime (~100 MB) + graph  =>  roughly 2-4 GB.
#                   If Railway rejects the image for size, shrink the bboxes
#                   or split cities into two services — don't switch to CH.
#
# Peak build RAM is osrm-extract on the merged PBF — the Hetzner sizing doc
# (../README.md) budgets 8 GB for this step. Whether Railway's builder grants
# that much is NOT verifiable from here; if the build OOMs, see
# README-railway.md's "if the build fails" fallback (build locally, push to
# GHCR, deploy the image).
# ---------------------------------------------------------------------------

# Same pinned image as ../setup-osrm.sh / ../docker-compose.yml — keep in sync.
ARG OSRM_IMAGE=ghcr.io/project-osrm/osrm-backend:v6.0.0

# Swap for a Geofabrik mirror without editing this file: on Railway, set a
# service variable PBF_URL (Railway passes service variables to Dockerfile
# builds as build args when an ARG of the same name exists).
ARG PBF_URL=https://download.geofabrik.de/asia/india-latest.osm.pbf

# ---- Stage A: download + clip -------------------------------------------
FROM debian:bookworm-slim AS clip
ARG PBF_URL

RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends osmium-tool wget ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Bboxes inlined VERBATIM from ../extracts.json ([minLng, minLat, maxLng,
# maxLat] — osmium's order). Do not hand-edit: regenerate extracts.json from
# backend/src/config/cityCenters.js and copy the values here.
COPY <<'JSON' /extracts.json
{
  "directory": "/data/extracts",
  "extracts": [
    { "output": "delhi.osm.pbf",     "bbox": [76.595,  28.0749, 77.823,  29.1529] },
    { "output": "mumbai.osm.pbf",    "bbox": [72.3549, 18.5819, 73.4005, 19.5701] },
    { "output": "kolkata.osm.pbf",   "bbox": [87.9261, 22.1684, 88.8017, 22.9768] },
    { "output": "chennai.osm.pbf",   "bbox": [79.8557, 12.6785, 80.6857, 13.4869] },
    { "output": "bengaluru.osm.pbf", "bbox": [77.1798, 12.5674, 78.0094, 13.3758] },
    { "output": "hyderabad.osm.pbf", "bbox": [78.0631, 16.9808, 78.9103, 17.7892] },
    { "output": "ahmedabad.osm.pbf", "bbox": [72.181,  22.6632, 72.9618, 23.3818] },
    { "output": "pune.osm.pbf",      "bbox": [73.4304, 18.1162, 74.283,  18.9246] },
    { "output": "surat.osm.pbf",     "bbox": [72.4939, 20.8558, 73.1683, 21.4846] }
  ]
}
JSON

# Bump this (set a CACHE_BUST service variable on Railway, e.g. "2026-10")
# to invalidate the layer cache below and force a fresh OSM download —
# that's the quarterly data-refresh mechanism (see README-railway.md).
ARG CACHE_BUST=initial

# One RUN chain so the 1.5 GB india PBF never persists in any layer —
# only cities.osm.pbf survives this stage.
RUN echo "cache-bust: ${CACHE_BUST}" \
 && mkdir -p /data/extracts \
 && wget --tries=5 --waitretry=30 --retry-connrefused --progress=dot:giga \
      -O /data/india-latest.osm.pbf "$PBF_URL" \
 && osmium extract --strategy=simple --config /extracts.json --overwrite /data/india-latest.osm.pbf \
 && osmium merge /data/extracts/*.osm.pbf -o /data/cities.osm.pbf --overwrite \
 && rm -rf /data/india-latest.osm.pbf /data/extracts

# ---- Stage B: build the OSRM graph (foot profile, MLD) ------------------
FROM ${OSRM_IMAGE} AS graph
COPY --from=clip /data/cities.osm.pbf /data/cities.osm.pbf

# foot.lua ships inside the osrm-backend image at /opt — the product decision
# is walking only (that's what walkEnrich MEASURES; car/bike are future).
# rm the PBF in the same RUN so it isn't copied into the final stage below.
RUN osrm-extract -p /opt/foot.lua /data/cities.osm.pbf \
 && osrm-partition /data/cities.osrm \
 && osrm-customize /data/cities.osrm \
 && rm -f /data/cities.osm.pbf

# ---- Final stage: runtime + graph only ----------------------------------
FROM ${OSRM_IMAGE}
# /data now holds only the .osrm* artifacts (PBF was rm'd in the graph stage).
COPY --from=graph /data/ /data/

EXPOSE 5000

# --ip :: — Railway's private network is IPv6-only; the default 0.0.0.0 bind
#   would be unreachable at <service>.railway.internal. On Linux a v6 socket
#   is dual-stack by default, so local `docker run -p 5000:5000` tests still
#   work. If boot logs ever show a bind/parse error on "::", fall back to
#   0.0.0.0 — but then the backend can't reach it privately (see README).
# --port 5000 — fixed; Railway's injected PORT is irrelevant because this
#   service never gets a public domain. backend's ROUTING_URL hardcodes :5000.
# --max-table-size 200 — matches ../docker-compose.yml; walkTable() batches
#   one origin against up to ~200 POI destinations per /table call.
# osrm-routed loads the graph into RAM at boot (expect ~1-2 GB resident,
# up to a minute of load time before routes answer). If memory is tight,
# add --mmap to serve the graph memory-mapped from disk at some latency cost.
CMD ["osrm-routed", "--algorithm", "mld", "--ip", "::", "--port", "5000", "--max-table-size", "200", "/data/cities.osrm"]
