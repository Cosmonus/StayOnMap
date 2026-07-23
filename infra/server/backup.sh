#!/usr/bin/env bash
# ============================================================================
# StayOnMap — nightly PostgreSQL backup.
#
#   sudo -u deploy bash /srv/stayonmap/infra/server/backup.sh
#
# Dumps the local DB in PostgreSQL CUSTOM format (-Fc, already zlib-compressed
# — so a separate gzip pass would only add CPU for a few % and complicate
# restore; the format IS the compression). Keeps 14 days in /var/backups/
# stayonmap, prunes older. An OPTIONAL, clearly-marked offsite push block is at
# the bottom — leave it commented to keep everything on-box.
#
#  >>> READ THIS: self-hosting means BACKUPS ARE NOW YOUR RESPONSIBILITY. <<<
#  Railway snapshotted Postgres automatically; this VM does not. A backup that
#  only lives on the same disk as the DB is not a backup — enable the offsite
#  block (or copy the dumps elsewhere) before you rely on this in anger.
#
# Restore a dump (custom format):
#   pg_restore --clean --if-exists --no-owner --no-acl \
#     -d "postgresql://stayonmap:PASS@127.0.0.1:5432/stayonmap" \
#     /var/backups/stayonmap/stayonmap-YYYYmmdd-HHMMSS.dump
# ============================================================================
set -euo pipefail

ENV_FILE=/etc/stayonmap/api.env
BACKUP_DIR=/var/backups/stayonmap
RETAIN_DAYS=14

# shellcheck source=/dev/null
set -a; . "${ENV_FILE}"; set +a
: "${DATABASE_URL:?DATABASE_URL missing from ${ENV_FILE}}"

mkdir -p "${BACKUP_DIR}"
timestamp="$(date +%Y%m%d-%H%M%S)"
outfile="${BACKUP_DIR}/stayonmap-${timestamp}.dump"

echo "[backup] dumping -> ${outfile}"
# -Fc custom format, --no-owner/--no-acl so it restores cleanly onto any role.
pg_dump --format=custom --no-owner --no-acl --file="${outfile}" "${DATABASE_URL}"

# Sanity: a valid custom dump lists its TOC without error.
pg_restore --list "${outfile}" >/dev/null
echo "[backup] verified. size: $(du -h "${outfile}" | cut -f1)"

echo "[backup] pruning dumps older than ${RETAIN_DAYS} days"
find "${BACKUP_DIR}" -name 'stayonmap-*.dump' -type f -mtime "+${RETAIN_DAYS}" -print -delete

# ── OPTIONAL OFFSITE PUSH — UNCOMMENT AND CONFIGURE ONE ─────────────────────
# On-disk backups die with the disk. Push offsite to survive VM loss.
#
# Google Cloud Storage (install: `curl https://sdk.cloud.google.com | bash`,
# auth a service account with Storage Object Creator on the bucket):
#   gsutil cp "${outfile}" "gs://YOUR-BUCKET/stayonmap/"
#
# Any S3-compatible target (awscli):
#   aws s3 cp "${outfile}" "s3://YOUR-BUCKET/stayonmap/"
#
# Or rsync to another host:
#   rsync -az "${outfile}" backups@your-other-host:/backups/stayonmap/
# ────────────────────────────────────────────────────────────────────────────

echo "[backup] done."

# ============================================================================
# SCHEDULING — pick ONE.
#
# A) systemd timer (preferred — journald logs, no per-user crontab). Create
#    /etc/systemd/system/stayonmap-backup.service :
#      [Unit]
#      Description=StayOnMap nightly DB backup
#      [Service]
#      Type=oneshot
#      User=deploy
#      ExecStart=/usr/bin/bash /srv/stayonmap/infra/server/backup.sh
#    and /etc/systemd/system/stayonmap-backup.timer :
#      [Unit]
#      Description=Run StayOnMap DB backup nightly
#      [Timer]
#      OnCalendar=*-*-* 02:30:00
#      Persistent=true
#      [Install]
#      WantedBy=timers.target
#    Then:
#      sudo systemctl daemon-reload
#      sudo systemctl enable --now stayonmap-backup.timer
#      systemctl list-timers stayonmap-backup.timer
#
# B) cron (deploy user's crontab — `crontab -e -u deploy`):
#      30 2 * * * bash /srv/stayonmap/infra/server/backup.sh >> /var/log/stayonmap-backup.log 2>&1
# ============================================================================
