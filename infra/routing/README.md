# StayOnMap Routing Server (self-hosted OSRM, walking profile)

Phase 3 of the spatial backlog: every distance the platform shows today is
straight-line, which is wrong exactly where it matters in Indian cities (rail
lines, nullahs, arterials with no crossing). This directory provisions the
free-software fix — a self-hosted [OSRM](https://project-osrm.org/) instance
serving **measured walking distances** over real street network for all 9
supported cities. No per-call metering, no API key, no vendor.

## Cost & sizing

| Option | Spec | Price | Verdict |
|---|---|---|---|
| **Hetzner CX32** | 4 vCPU / 8 GB / 80 GB | ~€6.8/mo | The target. 9-city merged extract (~300-500 MB PBF) builds and serves comfortably in 8 GB |
| Hetzner CX22 | 2 vCPU / 4 GB | ~€3.8/mo | Serving fits; the one-time graph BUILD may OOM. Build on CX32, resize down, or build locally and rsync `/data` |
| Google Cloud e2-standard-2 | 2 vCPU / 8 GB | ~$49/mo (or credits) | Only if the credits come through — 7× Hetzner at list price |

## Steps (operator — ~30 min hands-on, ~1 h runtime)

1. Create the server (Ubuntu 24.04, x86). Add your SSH key.
2. Copy this directory to the box:
   `scp -r infra/routing root@<ip>:/root/routing`
3. Run it: `ssh root@<ip> "bash /root/routing/setup-osrm.sh"`
   Downloads Geofabrik India (~1.5 GB), cuts it to the 9 city bboxes
   (`extracts.json` — generated from `backend/src/config/cityCenters.js`,
   regenerate there if cities ever change), merges, builds the foot-profile
   graph, serves on `:5000`. Idempotent — re-run safe.
4. Firewall: in the Hetzner console restrict inbound `:5000` to the backend's
   egress IP (Railway egress IPs are listed in the service's settings). OSRM
   has no auth of its own — the firewall IS the auth.
5. Point the backend at it: set `ROUTING_URL=http://<ip>:5000` on Railway.
   The backend's `routingProvider.js` health-probes it; absent or down, every
   consumer falls back to haversine exactly as today — the router can never
   break a page, only improve it.

## Refresh cadence

OSM street networks change slowly. Quarterly is plenty: re-run
`setup-osrm.sh` after deleting `/data/india-latest.osm.pbf` and
`/data/cities.osrm*` — it re-downloads, rebuilds, and `docker compose up -d`
swaps the graph with seconds of downtime.

## What the backend does with it

`backend/src/features/spatial/routingProvider.js` — `walkTable()` batches one
cell/property origin against many POI destinations via OSRM's `/table`
endpoint (one HTTP call, not N). Distances come back as **network metres and
seconds** — the difference between `DERIVED` (haversine arithmetic) and
`MEASURED` (a walk that follows streets) in the provenance vocabulary, and
what lets walk-time return to POI cards honestly (it was removed 2026-07-20
because straight-line × 1.35 across a rail line is fiction).

Module wiring lands once this server exists — the integration is deliberately
not merged before it can be verified against a live router.
