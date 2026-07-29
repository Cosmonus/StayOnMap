#!/usr/bin/env bash
# Read-only production verification for the StayOnMap VM.
#
#   ssh <you>@<box>
#   sudo /srv/stayonmap/infra/server/verify-production.sh
#
# Answers the questions that cannot be answered from code, in one pass. It
# CHANGES NOTHING: no writes, no restarts, no migrations. Safe to run any time,
# including mid-incident.
#
# It never prints a secret's VALUE — only whether it is set, and for the JWT
# secrets whether they satisfy the boot-time rules in config/env.js (length,
# not a placeholder, not equal to each other). That way the output can be
# pasted into an issue or a chat without leaking the box.
#
# Exit code is 0 if every CRITICAL check passed, 1 otherwise, so it can be
# wired to a cron/alert later.

set -uo pipefail

APP_DIR=${APP_DIR:-/srv/stayonmap}
ENV_FILE=${ENV_FILE:-/etc/stayonmap/api.env}
SERVICE=${SERVICE:-stayonmap-api}

RED=$'\e[31m'; GRN=$'\e[32m'; YEL=$'\e[33m'; DIM=$'\e[2m'; OFF=$'\e[0m'
fails=0; warns=0

section() { printf '\n%s── %s %s\n' "$DIM" "$1" "$OFF"; }
ok()   { printf '  %sPASS%s  %s\n' "$GRN" "$OFF" "$1"; }
warn() { printf '  %sWARN%s  %s\n' "$YEL" "$OFF" "$1"; warns=$((warns+1)); }
bad()  { printf '  %sFAIL%s  %s\n' "$RED" "$OFF" "$1"; fails=$((fails+1)); }
note() { printf '        %s%s%s\n' "$DIM" "$1" "$OFF"; }

# Read a var from the env file without sourcing it (sourcing would execute it
# and would also dump every secret into this shell's environment).
envval() { sed -n "s/^[[:space:]]*${1}=//p" "$ENV_FILE" 2>/dev/null | tail -1 | sed 's/^"//;s/"$//'; }
envset() { [ -n "$(envval "$1")" ]; }

# ─────────────────────────────────────────────────────────────────────────────
section "1. BACKUPS  (the only item here whose failure is unrecoverable)"

if [ -x "$APP_DIR/infra/server/backup.sh" ]; then
  ok "backup.sh present and executable"
else
  bad "backup.sh missing or not executable at $APP_DIR/infra/server/backup.sh"
fi

# Either a systemd timer or a cron entry is acceptable.
timer_state=$(systemctl is-active stayonmap-backup.timer 2>/dev/null)
cron_hit=$( { crontab -l 2>/dev/null; cat /etc/cron.d/* 2>/dev/null; } | grep -c "backup.sh" )
if [ "$timer_state" = "active" ]; then
  ok "stayonmap-backup.timer is active"
  note "$(systemctl list-timers stayonmap-backup.timer --no-pager 2>/dev/null | sed -n 2p)"
elif [ "$cron_hit" -gt 0 ]; then
  ok "backup.sh is scheduled via cron"
else
  bad "BACKUP IS NOT SCHEDULED — no active systemd timer and no cron entry"
  note "Nothing is being backed up. This is the single highest-consequence gap."
fi

backup_dir=${BACKUP_DIR:-/var/backups/stayonmap}
if [ -d "$backup_dir" ]; then
  newest=$(find "$backup_dir" -type f -name '*.dump' -o -type f -name '*.sql*' 2>/dev/null | xargs -r ls -t 2>/dev/null | head -1)
  if [ -n "$newest" ]; then
    age_h=$(( ( $(date +%s) - $(stat -c %Y "$newest") ) / 3600 ))
    size=$(du -h "$newest" | cut -f1)
    if [ "$age_h" -le 48 ]; then ok "most recent dump ${age_h}h old (${size})"
    else bad "most recent dump is ${age_h}h old (${size}) — backups have stopped"; fi
    [ "$(stat -c %s "$newest")" -lt 10240 ] && bad "newest dump is under 10KB — almost certainly an empty/failed dump"
  else
    bad "no dump files found in $backup_dir"
  fi
else
  warn "backup dir $backup_dir does not exist (set BACKUP_DIR= if it lives elsewhere)"
fi

# A dump on the same disk as the database is not a backup — backup.sh says so
# itself. The offsite block ships fully commented out, so "enabled" means an
# UNCOMMENTED gsutil/aws/rsync line referencing $outfile exists.
if grep -qE '^[[:space:]]*(gsutil|aws|rsync|rclone)[[:space:]].*outfile' \
        "$APP_DIR/infra/server/backup.sh" 2>/dev/null; then
  ok "offsite push is enabled ($(grep -oE '^[[:space:]]*(gsutil|aws|rsync|rclone)' "$APP_DIR/infra/server/backup.sh" | head -1 | tr -d ' '))"
else
  bad "OFFSITE PUSH NOT ENABLED — dumps sit on the same disk as the database"
  note "Disk loss or VM deletion takes the database and every backup together."
  note "Uncomment one target at the bottom of infra/server/backup.sh."
fi

# ─────────────────────────────────────────────────────────────────────────────
section "2. SERVICE HEALTH"

if systemctl is-active --quiet "$SERVICE"; then
  ok "$SERVICE active — up $(systemctl show -p ActiveEnterTimestamp --value "$SERVICE")"
  restarts=$(systemctl show -p NRestarts --value "$SERVICE")
  [ "${restarts:-0}" -gt 5 ] && warn "$SERVICE has restarted $restarts times — check journalctl for a crash loop" \
                             || ok "restart count: ${restarts:-0}"
else
  bad "$SERVICE is NOT running"
fi

port=$(envval PORT); port=${port:-5000}
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://localhost:${port}/health")
[ "$code" = "200" ] && ok "/health -> 200 (liveness)" || bad "/health -> ${code:-no response}"

ready=$(curl -s --max-time 10 "http://localhost:${port}/health/ready")
rcode=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://localhost:${port}/health/ready")
if [ "$rcode" = "200" ]; then ok "/health/ready -> 200 ${ready}"
elif [ "$rcode" = "404" ]; then warn "/health/ready 404 — box predates the readiness probe; deploy master"
else bad "/health/ready -> ${rcode:-no response} ${ready}"; fi

systemctl is-active --quiet nginx && ok "nginx active" || bad "nginx is NOT running"

# ─────────────────────────────────────────────────────────────────────────────
section "3. DATABASE"

if systemctl is-active --quiet postgresql; then
  ok "postgresql active"
  sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1 && ok "postgres accepting connections" \
    || bad "postgres is running but not accepting connections"
  conns=$(sudo -u postgres psql -tAc "SELECT count(*) FROM pg_stat_activity" 2>/dev/null)
  maxc=$(sudo -u postgres psql -tAc "SHOW max_connections" 2>/dev/null)
  [ -n "$conns" ] && note "connections: ${conns}/${maxc}"
  dbsize=$(sudo -u postgres psql -tAc "SELECT pg_size_pretty(pg_database_size(current_database()))" 2>/dev/null)
  [ -n "$dbsize" ] && note "database size: ${dbsize}"
else
  bad "postgresql is NOT running"
fi

# Pending migrations mean the deployed code and the schema disagree.
if [ -d "$APP_DIR/backend" ]; then
  pending=$(cd "$APP_DIR/backend" && npx prisma migrate status 2>&1 | grep -ci "following migration.*not.*applied\|pending")
  [ "${pending:-0}" -eq 0 ] && ok "no pending Prisma migrations" \
                            || bad "PENDING MIGRATIONS — deployed code may not match the schema"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "4. CONFIG  (presence only — no values printed)"

if [ -r "$ENV_FILE" ]; then
  ok "$ENV_FILE readable"
else
  bad "$ENV_FILE missing or unreadable (run this with sudo)"
fi

for v in DATABASE_URL JWT_SECRET ADMIN_JWT_SECRET FRONTEND_URL SUPABASE_URL \
         SUPABASE_SERVICE_ROLE_KEY GOOGLE_MAPS_KEY MAIL_PROVIDER MAIL_FROM; do
  envset "$v" && ok "$v set" || bad "$v MISSING"
done

for v in SENTRY_DSN REDIS_URL SPATIAL_DAILY_API_BUDGET MAIL_DAILY_CAP VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY; do
  envset "$v" && ok "$v set" || warn "$v not set"
done

# These are the boot rules in config/env.js. If they fail the API will refuse
# to start on its NEXT restart -- which is a deploy, i.e. the worst moment to
# find out.
js=$(envval JWT_SECRET); as=$(envval ADMIN_JWT_SECRET)
[ ${#js} -ge 32 ] && ok "JWT_SECRET length ok" || bad "JWT_SECRET under 32 chars — API will refuse to boot"
[ ${#as} -ge 32 ] && ok "ADMIN_JWT_SECRET length ok" || bad "ADMIN_JWT_SECRET under 32 chars — API will refuse to boot"
if [ -n "$js" ] && [ "$js" = "$as" ]; then
  bad "JWT_SECRET == ADMIN_JWT_SECRET — a user token would verify as an admin token"
else
  ok "JWT secrets differ"
fi
case "$js$as" in *your_*|*_here*|*changeme*|*placeholder*) bad "a JWT secret still holds an .env.example placeholder";; esac

sentry=$(envval SENTRY_DSN)
[ -z "$sentry" ] && note "Sentry is INERT without SENTRY_DSN — nothing surfaces prod errors beyond journalctl"

# ─────────────────────────────────────────────────────────────────────────────
section "5. HOST"

read -r _ total used avail pct _ <<<"$(df -h / | tail -1)"
pctn=${pct%\%}
[ "$pctn" -lt 80 ] && ok "disk ${pct} used (${avail} free of ${total})" \
                   || bad "disk ${pct} used — only ${avail} free"

memtotal=$(awk '/MemTotal/{printf "%.1f", $2/1024/1024}' /proc/meminfo)
memavail=$(awk '/MemAvailable/{printf "%.1f", $2/1024/1024}' /proc/meminfo)
note "memory: ${memavail}G available of ${memtotal}G"
swap=$(awk '/SwapTotal/{print $2}' /proc/meminfo)
[ "${swap:-0}" -gt 0 ] && ok "swap configured" \
  || warn "no swap — an OOM kills the API outright rather than degrading (matters if OSRM lands here)"

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ok "ufw active"
  note "$(ufw status | grep -E '^(80|443|22)' | tr '\n' ' ')"
else
  warn "ufw not active — relying on GCP VPC firewall alone"
fi

if command -v certbot >/dev/null; then
  exp=$(certbot certificates 2>/dev/null | grep -m1 "Expiry Date" | sed 's/.*Expiry Date: //')
  [ -n "$exp" ] && note "TLS: $exp"
  systemctl is-enabled --quiet certbot.timer 2>/dev/null && ok "certbot renewal timer enabled" \
    || warn "certbot renewal timer not enabled — TLS will expire"
fi

# ─────────────────────────────────────────────────────────────────────────────
printf '\n%s────────────────────────────────────────%s\n' "$DIM" "$OFF"
if [ "$fails" -eq 0 ]; then
  printf '  %sAll critical checks passed%s (%d warnings)\n\n' "$GRN" "$OFF" "$warns"
  exit 0
else
  printf '  %s%d CRITICAL check(s) failed%s, %d warnings\n\n' "$RED" "$fails" "$OFF" "$warns"
  exit 1
fi
