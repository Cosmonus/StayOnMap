# StayOnMap Routing Server (self-hosted OSRM, walking profile)

Phase 3 of the spatial backlog: every distance the platform shows today is
straight-line, which is wrong exactly where it matters in Indian cities (rail
lines, nullahs, arterials with no crossing). This directory provisions the
free-software fix — a self-hosted [OSRM](https://project-osrm.org/) instance
serving **measured walking distances** over real street network for all 9
supported cities. No per-call metering, no API key, no vendor.

## Google Cloud path (the only path — infra is Google Cloud only)

The router is a **plain Ubuntu box** running `setup-osrm.sh`, which builds the
graph on the box from scratch: no registry, no prebuilt image, nothing to make
public. That script is vendor-neutral — it needs Ubuntu 24.04, x86, disk, and
RAM, nothing else.

**Try the existing production VM first.** The backend API, Postgres and frontend
already share one Google Cloud VM (`infra/server/README-server.md`). Serving
routes is light; only the one-time graph build is hungry. If that VM has the
headroom for the build — or you build the graph elsewhere and copy `/data` in —
this costs **nothing extra**, needs no firewall rule at all, and `ROUTING_URL`
becomes `http://127.0.0.1:5000`. Check free RAM and disk before assuming it
won't fit.

If it won't fit, add a **second Google Cloud VM** (see sizing below). Runbook:

```bash
# 1. Create the VM (Ubuntu 24.04, x86) in the same project/region. Note its IP.
# 2. From THIS repo on your laptop, copy the kit up:
scp -r infra/routing <you>@<box-ip>:~/
# 3. On the box:
ssh <you>@<box-ip>
sudo bash ~/routing/setup-osrm.sh       # ~30-45 min: download, clip, build, serve
# 4. VPC firewall rule: allow inbound TCP :5000 from the API VM only.
# 5. Tell the session the box IP — it sets ROUTING_URL in /etc/stayonmap/api.env
#    on the production VM and restarts the API.
```

The graph builds in one shot and osrm-routed serves on :5000, restart-always.
`ROUTING_URL` is the only backend change; everything wired in the read path
lights up with no deploy.

**Securing :5000** — OSRM has no auth. It computes routes over public OSM data,
so there's no data to leak; the only risk is someone borrowing your routing CPU.
On the same VM, bind it to loopback and the question disappears. On a second VM,
use a VPC firewall rule scoped to the API VM's internal IP — an internal-only
route means :5000 is never exposed to the internet at all, and the firewall IS
the auth. (A secret path prefix behind a tiny Caddy proxy still works as an
alternative — `routingProvider.js` appends fixed paths, so a prefix is fine.)

## Cost & sizing

Cheapest first. The 9-city merged extract is ~300-500 MB PBF; **serving** it is
light, the one-time **build** is what needs the RAM.

| Option | Spec | Extra cost | Verdict |
|---|---|---|---|
| **The existing production VM** | whatever it already is | **₹0** | Try this first. If it can't build the graph, build elsewhere and copy `/data` in — then it only ever has to serve. Bind to `127.0.0.1`, no firewall rule needed. |
| Second GCP VM, e2-standard-2 | 2 vCPU / 8 GB | ~$49/mo list | Builds and serves comfortably. Free if the Google Cloud credits land. |
| Second GCP VM, e2-medium | 2 vCPU / 4 GB | ~$25/mo list | Serving fits; the graph BUILD may OOM. Build on a bigger machine, then resize down, or build locally and copy `/data` up. |

⚠ Note the list prices honestly: a second always-on VM is the most expensive
line item this project would carry. Exhaust the "same VM" option before adding
one.

## Steps (operator — ~30 min hands-on, ~1 h runtime)

1. Create the VM (Ubuntu 24.04, x86) in the same project and region as the API
   VM, or skip to step 3 if you're using the API VM itself.
2. Copy this directory to the box:
   `scp -r infra/routing <you>@<ip>:~/routing`
3. Run it: `ssh <you>@<ip> "sudo bash ~/routing/setup-osrm.sh"`
   Downloads Geofabrik India (~1.5 GB), cuts it to the 9 city bboxes
   (`extracts.json` — generated from `backend/src/config/cityCenters.js`,
   regenerate there if cities ever change), merges, builds the foot-profile
   graph, serves on `:5000`. Idempotent — re-run safe.
4. Firewall: add a VPC rule allowing inbound `:5000` from the API VM's internal
   IP only — or skip it entirely if OSRM is on the API VM bound to loopback.
   OSRM has no auth of its own; the firewall IS the auth.
5. Point the backend at it: set `ROUTING_URL=http://<ip>:5000` in
   `/etc/stayonmap/api.env` on the production VM and restart `stayonmap-api`.
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
