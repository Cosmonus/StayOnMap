#!/usr/bin/env bash
# ============================================================================
# StayOnMap — nightly PostgreSQL backup.
#
#   sudo -u deploy bash /srv/stayonmap/infra/server/backup.sh
#
# Dumps the local DB in PostgreSQL CUSTOM format (-Fc, already zlib-compressed
# — so a separate gzip pass would only add CPU for a few % and complicate
# restore; the format IS the compression). Keeps 14 days in /var/backups/
# stayonmap, prunes older, then pushes offsite if an offsite target is set in
# /etc/stayonmap/api.env (see the OFFSITE PUSH section below).
#
#  >>> READ THIS: self-hosting means BACKUPS ARE NOW YOUR RESPONSIBILITY. <<<
#  Railway snapshotted Postgres automatically; this VM does not. A backup that
#  only lives on the same disk as the DB is not a backup — set an offsite
#  target before you rely on this in anger.
#
# Schedule it with the units next door — this script does nothing on its own:
#   sudo cp /srv/stayonmap/infra/server/systemd/stayonmap-backup.* /etc/systemd/system/
#   sudo systemctl daemon-reload && sudo systemctl enable --now stayonmap-backup.timer
# On 2026-07-30 a verification pass found this script present, executable, and
# NEVER ONCE RUN: nothing scheduled it, and /var/backups/stayonmap was empty.
#
# Restore a dump (custom format). Note the URL is written out by hand WITHOUT
# any ?connection_limit=… — pg_restore and psql reject Prisma's query params
# exactly like pg_dump does (see the libpq_url note below), so do not paste
# DATABASE_URL from api.env verbatim here:
#   pg_restore --clean --if-exists --no-owner --no-acl \
#     -d "postgresql://stayonmap:PASS@127.0.0.1:5432/stayonmap" \
#     /var/backups/stayonmap/stayonmap-YYYYmmdd-HHMMSS.dump
# ============================================================================
set -euo pipefail

# Run from a directory this user can definitely read.
#
# The documented manual invocation is `sudo -u deploy bash …`, which keeps the
# INVOKING user's cwd — typically /home/<someone-else>, which `deploy` cannot
# enter. Every child process inherits it, and on 2026-07-30 that aborted a
# successful backup at the very last step:
#
#     find: Failed to restore initial working directory: /home/hello: Permission denied
#
# find saves and restores its cwd; the restore failed, find exited non-zero,
# and `set -e` killed the script after a good 94M dump had already been written
# — so the offsite push never ran and the exit status said failure. Under
# systemd this never appeared, because a unit's default WorkingDirectory is /.
# A script whose success depends on who invoked it and from where is broken;
# one line fixes it for both paths.
cd /

ENV_FILE=/etc/stayonmap/api.env
BACKUP_DIR=/var/backups/stayonmap
RETAIN_DAYS=14

# shellcheck source=/dev/null
set -a; . "${ENV_FILE}"; set +a
: "${DATABASE_URL:?DATABASE_URL missing from ${ENV_FILE}}"

# ── DATABASE_URL is Prisma-flavoured; libpq is not ──────────────────────────
#
# The first real run of this script (2026-07-30) died on:
#     pg_dump: error: invalid URI query parameter: "connection_limit"
#
# `connection_limit` is a PRISMA driver parameter. libpq has never heard of it,
# and it rejects the ENTIRE URI on the first query parameter it does not
# recognise — so one Prisma-only param makes the URL unusable for pg_dump,
# psql and pg_restore alike, while Prisma itself is perfectly happy. Same story
# for pool_timeout, pgbouncer, schema, socket_timeout, statement_cache_size.
#
# Allow-list rather than deny-list: new Prisma params appear with new Prisma
# versions, and the failure mode of missing one is a backup that stops working.
# The failure mode of dropping a libpq param we forgot to list is a connection
# that needs one more entry here — visible, and much cheaper.
#
# Dropping `schema` is safe: pg_dump takes no search_path from the URI and
# dumps every schema unless told otherwise with -n.
LIBPQ_OK='sslmode|sslrootcert|sslcert|sslkey|sslpassword|connect_timeout|application_name|options|target_session_attrs|channel_binding|gssencmode|client_encoding'

libpq_url() {
  local url="$1" base query kept="" dropped="" kv key
  base="${url%%\?*}"
  if [ "$base" = "$url" ]; then printf '%s' "$url"; return; fi
  query="${url#*\?}"
  local IFS='&'
  for kv in $query; do
    key="${kv%%=*}"
    if [[ "$key" =~ ^(${LIBPQ_OK})$ ]]; then
      kept="${kept:+$kept&}$kv"
    else
      dropped="${dropped:+$dropped, }$key"
    fi
  done
  # Only ever print KEY names — the URL carries the database password.
  if [ -n "$dropped" ]; then
    echo "[backup] note: dropped non-libpq URI params for pg_dump: ${dropped}" >&2
  fi
  printf '%s' "${base}${kept:+?$kept}"
}

DUMP_URL="$(libpq_url "${DATABASE_URL}")"

mkdir -p "${BACKUP_DIR}"
timestamp="$(date +%Y%m%d-%H%M%S)"
outfile="${BACKUP_DIR}/stayonmap-${timestamp}.dump"

echo "[backup] dumping -> ${outfile}"
# -Fc custom format, --no-owner/--no-acl so it restores cleanly onto any role.
pg_dump --format=custom --no-owner --no-acl --file="${outfile}" "${DUMP_URL}"

# Sanity: a valid custom dump lists its TOC without error.
pg_restore --list "${outfile}" >/dev/null
echo "[backup] verified. size: $(du -h "${outfile}" | cut -f1)"

echo "[backup] pruning dumps older than ${RETAIN_DAYS} days"
find "${BACKUP_DIR}" -name 'stayonmap-*.dump' -type f -mtime "+${RETAIN_DAYS}" -print -delete

# ── OFFSITE PUSH — configured in api.env, NOT by editing this file ──────────
#
# This used to be a block of commented-out examples with "uncomment one".
# That was bad advice: this file is git-tracked and deploy.sh runs `git pull`
# on every merge, so a local edit here is either clobbered or blocks the pull
# outright — the same trap a manual `chmod` on the box already sprang once
# (see .claude/ops.md). Anything that varies per box belongs in
# /etc/stayonmap/api.env, which is not in git and is already sourced above.
#
# Set ONE of these in api.env to enable. Unset = on-disk only, and the script
# says so loudly, because a dump on the same disk as the database is not a
# backup — it does not survive the one event backups exist for.
#
#   BACKUP_GCS_BUCKET=gs://your-bucket/stayonmap      # needs gsutil + a service account
#   BACKUP_S3_URI=s3://your-bucket/stayonmap          # needs awscli
#   BACKUP_RSYNC_TARGET=backups@host:/backups/stayonmap
#
offsite_ok=""
if [ -n "${BACKUP_GCS_BUCKET:-}" ]; then
  echo "[backup] offsite -> ${BACKUP_GCS_BUCKET}"
  gsutil cp "${outfile}" "${BACKUP_GCS_BUCKET}/" && offsite_ok=1
elif [ -n "${BACKUP_S3_URI:-}" ]; then
  echo "[backup] offsite -> ${BACKUP_S3_URI}"
  aws s3 cp "${outfile}" "${BACKUP_S3_URI}/" && offsite_ok=1
elif [ -n "${BACKUP_RSYNC_TARGET:-}" ]; then
  echo "[backup] offsite -> ${BACKUP_RSYNC_TARGET}"
  rsync -az "${outfile}" "${BACKUP_RSYNC_TARGET}/" && offsite_ok=1
else
  echo "[backup] WARNING: no offsite target set (BACKUP_GCS_BUCKET / BACKUP_S3_URI /"
  echo "[backup]          BACKUP_RSYNC_TARGET in ${ENV_FILE}). This dump lives only on"
  echo "[backup]          the same disk as the database it came from."
fi

# `set -e` already aborts on a failed push, so reaching here with the variable
# empty means no target was configured rather than a push that failed. Said
# explicitly so the distinction survives in the journal.
#
# Written as an `if` rather than `[ ... ] && echo`: under `set -e` a trailing
# AND-list whose test fails is exempt from exiting, but only by a rule most
# readers have to look up — and it is the LAST statement here, where a future
# edit could easily make it the script's exit status.
if [ -n "${offsite_ok}" ]; then
  echo "[backup] offsite copy confirmed."
fi

echo "[backup] done."

# ============================================================================
# SCHEDULING
#
# The units are real files now, not a recipe to retype:
#   infra/server/systemd/stayonmap-backup.service
#   infra/server/systemd/stayonmap-backup.timer
#
#   sudo cp /srv/stayonmap/infra/server/systemd/stayonmap-backup.* /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now stayonmap-backup.timer
#   systemctl list-timers stayonmap-backup.timer     # next / last run
#   sudo systemctl start stayonmap-backup            # run one now
#   journalctl -u stayonmap-backup -n 50             # what happened
#
# The timer sets Persistent=true, so a run missed while the VM was off happens
# at next boot instead of being skipped silently.
#
# Verify the whole picture (scheduled? fresh? offsite on?) with:
#   sudo /srv/stayonmap/infra/server/verify-production.sh
# ============================================================================
