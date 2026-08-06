#!/usr/bin/env bash
# ============================================================================
# StayOnMap — single-VM server bootstrap. Run ONCE as root on a fresh
# Ubuntu 24.04 box (GCP e2-standard-2 now; portable to any Ubuntu VM, e.g.
# a replacement VM, later — same script, new IP).
#
#   sudo bash setup-server.sh
#
# Installs Node LTS, PostgreSQL 16, nginx, certbot, ufw, unattended-upgrades;
# creates the app DB+role, the deploy user, /srv/stayonmap, and
# /etc/stayonmap/api.env; installs (but does NOT start) the systemd unit and
# nginx site. Every step is guarded — re-running is safe and near-instant.
#
# DELIBERATELY NOT INSTALLED:
#   * Redis  — production uses Upstash (external). REDIS_URL stays remote.
#   * Object storage — property images stay on Supabase (external).
#   * OSRM   — separate concern; run infra/routing/setup-osrm.sh afterwards.
#
# It does NOT clone the private app repo (needs a deploy key). See
# README-server.md step (b)/(e) for the clone + first-deploy steps.
# ============================================================================
set -euo pipefail

# ── Tunables ────────────────────────────────────────────────────────────────
NODE_MAJOR=22                       # NodeSource LTS ("Jod"); covers Prisma 7 / Express 5 / socket.io 4
APP_USER=deploy
APP_DIR=/srv/stayonmap
ENV_DIR=/etc/stayonmap
DB_NAME=stayonmap
DB_USER=stayonmap
BACKUP_DIR=/var/backups/stayonmap

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: run as root (sudo bash setup-server.sh)" >&2
  exit 1
fi

log() { printf '\n== %s ==\n' "$*"; }

# ── 1. Base packages ────────────────────────────────────────────────────────
log "1. apt base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl gnupg git build-essential ufw \
  nginx certbot python3-certbot-nginx \
  postgresql postgresql-contrib \
  unattended-upgrades openssl

# ── 2. Node.js (NodeSource) ─────────────────────────────────────────────────
log "2. Node.js ${NODE_MAJOR}.x"
current_node_major=""
if command -v node >/dev/null 2>&1; then
  current_node_major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
fi
if [[ "${current_node_major}" != "${NODE_MAJOR}" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
else
  echo "Node ${current_node_major}.x already present — skipping."
fi
node -v
npm -v

# ── 3. PostgreSQL: role + database (idempotent) ─────────────────────────────
log "3. PostgreSQL role + database"
systemctl enable --now postgresql

role_exists="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" || true)"
generated_pass=""
if [[ "${role_exists}" != "1" ]]; then
  generated_pass="$(openssl rand -hex 24)"
  sudo -u postgres psql -qc "CREATE ROLE \"${DB_USER}\" LOGIN PASSWORD '${generated_pass}'"
  echo "Created role ${DB_USER}."
else
  echo "Role ${DB_USER} already exists — password left unchanged."
fi

db_exists="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" || true)"
if [[ "${db_exists}" != "1" ]]; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
  echo "Created database ${DB_NAME}."
else
  echo "Database ${DB_NAME} already exists — skipping."
fi
# Postgres on Ubuntu listens on localhost only by default; we never open 5432
# in ufw, so it stays box-local. No change required here.

# ── 4. deploy user + directories ────────────────────────────────────────────
log "4. deploy user + directories"
if ! id "${APP_USER}" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "${APP_USER}"
  echo "Created user ${APP_USER}."
fi
mkdir -p "${APP_DIR}"
chown "${APP_USER}:${APP_USER}" "${APP_DIR}"
mkdir -p "${BACKUP_DIR}"
chown "${APP_USER}:${APP_USER}" "${BACKUP_DIR}"
mkdir -p "${ENV_DIR}"

# ── 5. /etc/stayonmap/api.env from template ─────────────────────────────────
log "5. api.env"
if [[ ! -f "${ENV_DIR}/api.env" ]]; then
  cp "${SCRIPT_DIR}/api.env.example" "${ENV_DIR}/api.env"
  chown "${APP_USER}:${APP_USER}" "${ENV_DIR}/api.env"
  chmod 600 "${ENV_DIR}/api.env"
  echo "Wrote ${ENV_DIR}/api.env (from template) — FILL IN THE REAL VALUES."
else
  echo "${ENV_DIR}/api.env already exists — not overwriting."
fi

# ── 6. systemd unit (installed, enabled, NOT started) ───────────────────────
# Not started here: the API would crash-loop until api.env is filled and the
# repo is cloned + built. deploy.sh (or step (e)) starts it.
log "6. systemd unit"
install -m 644 "${SCRIPT_DIR}/systemd/stayonmap-api.service" /etc/systemd/system/stayonmap-api.service
systemctl daemon-reload
systemctl enable stayonmap-api.service >/dev/null 2>&1 || true

# ── 7. sudoers for deploy.sh (restart API, reload nginx) ────────────────────
log "7. sudoers for deploy user"
cat > /etc/sudoers.d/stayonmap-deploy <<EOF
# Lets the deploy user restart the API and reload nginx from deploy.sh, only.
${APP_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl restart stayonmap-api, /usr/bin/systemctl reload nginx, /usr/sbin/nginx -t
EOF
chmod 440 /etc/sudoers.d/stayonmap-deploy
visudo -cf /etc/sudoers.d/stayonmap-deploy

# ── 8. nginx site ───────────────────────────────────────────────────────────
log "8. nginx site"
install -m 644 "${SCRIPT_DIR}/nginx/stayonmap.conf" /etc/nginx/sites-available/stayonmap.conf
ln -sf /etc/nginx/sites-available/stayonmap.conf /etc/nginx/sites-enabled/stayonmap.conf
rm -f /etc/nginx/sites-enabled/default
# nginx -t passes even before the frontend is built (missing root just 404s).
if nginx -t; then
  systemctl reload nginx
  echo "nginx reloaded."
else
  echo "WARNING: nginx -t failed — inspect /etc/nginx/sites-available/stayonmap.conf" >&2
fi

# ── 9. Firewall (ufw) ───────────────────────────────────────────────────────
# Allow SSH + HTTP + HTTPS ONLY. NOT 5432 (Postgres stays localhost) and NOT
# 5000 (OSRM stays localhost via ROUTING_URL=127.0.0.1:5000).
log "9. ufw"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

# ── 10. Unattended security upgrades ────────────────────────────────────────
log "10. unattended-upgrades"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true

# ── Done ────────────────────────────────────────────────────────────────────
cat <<EOF

============================================================================
 setup-server.sh complete.
============================================================================
EOF
if [[ -n "${generated_pass}" ]]; then
  cat <<EOF
 GENERATED POSTGRES PASSWORD (shown ONCE — copy into DATABASE_URL now):

     ${generated_pass}

 DATABASE_URL="postgresql://${DB_USER}:${generated_pass}@127.0.0.1:5432/${DB_NAME}?connection_limit=10&pool_timeout=20"

EOF
else
  echo " Postgres role already existed — reuse the DATABASE_URL you set before."
  echo
fi
cat <<EOF
 NEXT STEPS (full detail in infra/server/README-server.md):
   b) Clone the repo as the deploy user into ${APP_DIR}:
        sudo -u ${APP_USER} git clone <repo> ${APP_DIR}   (deploy key needed)
   c) Fill ${ENV_DIR}/api.env with the real production values
      (JWT_SECRET / ADMIN_JWT_SECRET copied VERBATIM from the current box —
      do not regenerate, that signs everyone out).
   d) If replacing an existing box: migrate the DB in (pg_dump -> pg_restore)
      — README step (d).
   e) First deploy:  sudo -u ${APP_USER} ${APP_DIR}/infra/server/deploy.sh
   f) TLS AFTER dns points here:  certbot --nginx -d www.stayonmap.com -d stayonmap.com
   h) OSRM (optional):  bash ${APP_DIR}/infra/routing/setup-osrm.sh
============================================================================
EOF
