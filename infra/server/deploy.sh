#!/usr/bin/env bash
# ============================================================================
# StayOnMap — deploy / release. Run as the DEPLOY user from the checkout:
#
#   sudo -u deploy /srv/stayonmap/infra/server/deploy.sh
#
# Phases: git pull -> backend deps + prisma migrate/generate -> frontend build
# -> restart API -> reload nginx. Idempotent and safe to re-run.
#
# The frontend is built with VITE_API_BASE_URL=/api/v1 (relative) so the SPA
# and Socket.io both talk to the API SAME-ORIGIN through nginx — no CORS, no
# hostname baked into the bundle. VITE_GOOGLE_MAPS_API_KEY / VITE_SENTRY_DSN
# come from api.env (sourced below).
# ============================================================================
set -euo pipefail

APP_DIR=/srv/stayonmap
ENV_FILE=/etc/stayonmap/api.env
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"

log() { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }

[[ -d "${BACKEND_DIR}" ]]  || { echo "ERROR: ${BACKEND_DIR} not found — clone the repo into ${APP_DIR} first." >&2; exit 1; }
[[ -f "${ENV_FILE}" ]]     || { echo "ERROR: ${ENV_FILE} not found — run setup-server.sh and fill it in." >&2; exit 1; }

# Export env for the Prisma CLI (DATABASE_URL) and the frontend build (VITE_*).
# shellcheck source=/dev/null
set -a; . "${ENV_FILE}"; set +a
: "${DATABASE_URL:?DATABASE_URL missing from ${ENV_FILE}}"

# ── 1. Pull latest ──────────────────────────────────────────────────────────
log "1. git pull"
git -C "${APP_DIR}" pull --ff-only

# ── 2. Backend: runtime deps + migrations + client ──────────────────────────
log "2. backend deps"
cd "${BACKEND_DIR}"
npm ci --omit=dev

# The Prisma CLI is a devDependency, so --omit=dev did not install it. Invoke
# it at the EXACT version pinned in package.json (must match @prisma/client),
# fetched into the npx cache — never a floating "latest" that could drift.
PRISMA_VERSION="$(node -p "require('./package.json').devDependencies.prisma.replace(/[^0-9.]/g,'')")"
log "3. prisma migrate deploy (${PRISMA_VERSION})"
npx --yes "prisma@${PRISMA_VERSION}" migrate deploy
log "4. prisma generate"
npx --yes "prisma@${PRISMA_VERSION}" generate

# ── 5. Frontend build (same-origin API base) ────────────────────────────────
log "5. frontend build"
cd "${FRONTEND_DIR}"
npm ci
VITE_API_BASE_URL=/api/v1 \
VITE_GOOGLE_MAPS_API_KEY="${VITE_GOOGLE_MAPS_API_KEY:-}" \
VITE_SENTRY_DSN="${VITE_SENTRY_DSN:-}" \
VITE_APP_ENV=production \
  npm run build
# Output is ${FRONTEND_DIR}/dist — served directly by nginx (see stayonmap.conf).

# ── 6. Restart API + reload nginx ───────────────────────────────────────────
log "6. restart API"
sudo /usr/bin/systemctl restart stayonmap-api

log "7. reload nginx"
sudo /usr/sbin/nginx -t
sudo /usr/bin/systemctl reload nginx

log "deploy complete"
echo "Health check:"
sleep 2
curl -fsS http://127.0.0.1:4000/health && echo || echo "WARN: /health did not return 200 yet — check: journalctl -u stayonmap-api -n 50"
