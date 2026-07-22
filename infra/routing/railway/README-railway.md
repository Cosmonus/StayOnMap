# OSRM on Railway — operator runbook

The routing server (self-hosted OSRM, FOOT profile, 9 supported cities)
deployed as a Railway service instead of the originally planned Hetzner box.
Everything — Geofabrik download, bbox clip, MLD graph build — happens inside
the Docker image build (`Dockerfile` here), because Railway builders have no
volumes. The parent kit (`../README.md`, `../setup-osrm.sh`) stays as the
documented VPS alternative.

## Deploy (one-time, ~10 min hands-on + a long first build)

1. **Create the service** in the `angelic-blessing` Railway project
   (same project as stayonmap-backend + Postgres, so private networking works):
   - Dashboard: **New → Empty Service**, name it `osrm-routing`.
   - Settings → Source: connect the GitHub repo, branch `master`,
     **Root Directory = `infra/routing/railway`**. Railway picks up the
     `railway.json` + `Dockerfile` in that directory automatically.
   - CLI alternative, from this directory:
     `railway link` (pick angelic-blessing) then
     `railway up --service osrm-routing`.
2. **Do NOT generate a public domain.** The backend reaches it over Railway
   private networking only. No public port = no exposure = no auth needed —
   the same "the firewall IS the auth" stance as the Hetzner kit, with
   Railway's private network playing the firewall.
3. **Wait out the first build.** It downloads ~1.5 GB from Geofabrik, clips
   with osmium, and builds the foot-profile MLD graph — expect somewhere in
   the 30-90 min range and heavy builder memory use (the Hetzner sizing for
   the graph step was 8 GB). Subsequent deploys reuse the cached layers and
   are fast unless `CACHE_BUST` changes.
4. **Point the backend at it**: on the `stayonmap-backend` service set
   `ROUTING_URL=http://osrm-routing.railway.internal:5000`
   (substitute the service name you chose) and redeploy the backend.
5. **Verify**:
   - osrm-routing deploy logs end with osrm-routed's "running and waiting for
     requests" line (graph load takes up to a minute after boot — this is why
     `railway.json` sets **no healthcheck**: Railway would probe before the
     graph is resident. `routingProvider.js` does its own health probe — a
     real tiny Bengaluru route, cached 60 s — so a still-loading router just
     means haversine fallback for another minute, never an error).
   - Backend side: after the next cell materialisation, POI facts gain
     `walkM`/`walkSeconds` (walk data), and there is no
     `spatial.routing_table_failed` in the intel logs. Absent/down router is
     a supported state — pages keep haversine, nothing breaks.

## Notes that will bite if forgotten

- **IPv6**: Railway private networking is IPv6-only, which is why the
  Dockerfile's CMD binds `--ip ::`. If you ever change the CMD, keep that
  flag or `railway.internal` resolution will connect to nothing.
- **Port**: fixed at 5000; Railway's injected `PORT` is deliberately ignored
  (no public domain, and the backend's `ROUTING_URL` hardcodes `:5000`).
- **Data refresh (quarterly is plenty)**: set/change the `CACHE_BUST`
  service variable on osrm-routing (e.g. `2026-10`) — Railway passes service
  variables to Dockerfile builds as build args, so changing it invalidates
  the download layer and the next deploy rebuilds from fresh OSM data.
  `PBF_URL` can be overridden the same way if Geofabrik needs a mirror.
- **City list changes**: the bboxes are inlined in the Dockerfile from
  `../extracts.json` (itself generated from
  `backend/src/config/cityCenters.js`). If cities change, regenerate
  extracts.json first, then mirror the values into the Dockerfile — they
  must never drift apart.
- **Cost expectation** (usage-based, always-on): the graph sits resident in
  RAM, ~1-2 GB for the clipped 9-city foot network, plus a mostly-idle vCPU.
  On Railway's usage pricing that's roughly $10-25/mo — comparable to the
  Hetzner CX32 (~€6.8/mo) once Railway's convenience premium is counted. If
  memory is the binding constraint, add `--mmap` to the CMD to serve the
  graph memory-mapped from disk (lower RSS, slightly slower queries).

## If the first build fails

- **Builder OOM during `osrm-extract`** is the likely failure. Fallback that
  keeps Railway as the runtime: build the image locally
  (`docker build -t ghcr.io/<you>/stayonmap-osrm:YYYY-MM infra/routing/railway`),
  push to GHCR (private is fine), and switch the Railway service's source
  from the repo to that **Docker image**. Same runtime behaviour, zero
  builder-memory dependence.
- **Image too large** (final image is runtime + ~2-4 GB of graph): shrink
  bboxes or split into two services before considering CH — the MLD choice
  is deliberate (CH preprocessing needs far more build memory).
- Geofabrik down / throttled: set `PBF_URL` to a mirror and redeploy.
