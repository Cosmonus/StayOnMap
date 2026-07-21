#!/usr/bin/env bash
# StayOnMap routing server — one-shot setup for a fresh Ubuntu 24.04 box
# (Hetzner CX32/8GB is the tested target; any x86 VPS with 8GB+ works).
#
# What it does, in order:
#   1. Docker + osmium install
#   2. Download the Geofabrik India extract (~1.5 GB, free)
#   3. Cut it down to the 9 supported-city bboxes (extracts.json — GENERATED
#      from backend/src/config/cityCenters.js, do not hand-edit) and merge
#      them into one small PBF (~300-500 MB)
#   4. Build the OSRM graph with the FOOT profile (walking — the product
#      decision: walk time returns to cards when it can be MEASURED)
#   5. Serve osrm-routed on :5000 via docker compose, restart-always
#
# Run as root on the fresh box:   bash setup-osrm.sh
# Re-run safe: every step skips work it already did.
set -euo pipefail

DATA=/data
OSRM_IMAGE=ghcr.io/project-osrm/osrm-backend:v6.0.0
INDIA_PBF_URL=https://download.geofabrik.de/asia/india-latest.osm.pbf

echo "== 1. packages =="
if ! command -v docker >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq docker.io docker-compose-v2 osmium-tool curl
  systemctl enable --now docker
fi

mkdir -p "$DATA/extracts"
cd "$DATA"

echo "== 2. India extract =="
if [ ! -f india-latest.osm.pbf ]; then
  curl -fL --retry 3 -o india-latest.osm.pbf.part "$INDIA_PBF_URL"
  mv india-latest.osm.pbf.part india-latest.osm.pbf
fi

echo "== 3. city extracts + merge =="
# extracts.json must sit next to this script when you copy them to the box.
if [ ! -f cities.osm.pbf ]; then
  osmium extract --config "$(dirname "$0")/extracts.json" --overwrite india-latest.osm.pbf
  osmium merge /data/extracts/*.osm.pbf -o cities.osm.pbf --overwrite
fi

echo "== 4. OSRM graph (foot profile) =="
if [ ! -f cities.osrm.fileIndex ]; then
  docker run --rm -v "$DATA:/data" "$OSRM_IMAGE" osrm-extract -p /opt/foot.lua /data/cities.osm.pbf
  docker run --rm -v "$DATA:/data" "$OSRM_IMAGE" osrm-partition /data/cities.osrm
  docker run --rm -v "$DATA:/data" "$OSRM_IMAGE" osrm-customize /data/cities.osrm
fi

echo "== 5. serve =="
cp "$(dirname "$0")/docker-compose.yml" "$DATA/docker-compose.yml"
cd "$DATA" && docker compose up -d

echo "== smoke test (walking route across central Bengaluru) =="
sleep 3
curl -s "http://localhost:5000/route/v1/foot/77.5946,12.9716;77.6046,12.9816?overview=false" | head -c 300
echo
echo "== DONE. Point the backend at this box: ROUTING_URL=http://<this-ip>:5000 =="
echo "== (restrict :5000 to the backend's egress IP in the Hetzner firewall) =="
