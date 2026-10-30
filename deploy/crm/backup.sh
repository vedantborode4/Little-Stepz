#!/usr/bin/env bash
# Nightly backup of the CRM database: a compressed pg_dump, checked readable,
# checksummed, copied off the server, and old local copies pruned.
#
#   deploy/crm/backup.sh                      # cron: 15 2 * * * (see deploy/crm/crontab.txt)
#
# Settings (environment, or /etc/crm-backup.env which is read if present):
#   OFFSITE       rclone destination, e.g. "b2:littlestepz-crm-backups". Empty = local only (warns).
#   BACKUP_DIR    local folder (default /var/backups/crm)
#   RETAIN_DAYS   local copies kept (default 14); off-server retention is set on the bucket
#   CONTAINER / DB_USER / DB_NAME   the crm-postgres container and database
set -euo pipefail

[ -f /etc/crm-backup.env ] && . /etc/crm-backup.env

BACKUP_DIR="${BACKUP_DIR:-/var/backups/crm}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
CONTAINER="${CONTAINER:-crm-postgres}"
DB_USER="${DB_USER:-crm}"
DB_NAME="${DB_NAME:-littlestepz_crm}"
OFFSITE="${OFFSITE:-}"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/crm-$stamp.dump"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --compress=9 --no-owner --no-privileges > "$file.partial"

# A dump pg_restore can't read is not a backup: fail loudly instead of keeping it.
docker exec -i "$CONTAINER" pg_restore --list < "$file.partial" > /dev/null
mv "$file.partial" "$file"
(cd "$BACKUP_DIR" && sha256sum "$(basename "$file")" > "$(basename "$file").sha256")

if [ -n "$OFFSITE" ]; then
  rclone copy "$file" "$OFFSITE/"
  rclone copy "$file.sha256" "$OFFSITE/"
  echo "Copied off-server to $OFFSITE"
else
  echo "WARNING: OFFSITE is not set; this backup exists on this server only" >&2
fi

find "$BACKUP_DIR" -maxdepth 1 -name 'crm-*.dump*' -mtime +"$RETAIN_DAYS" -delete

echo "Backup written: $file ($(du -h "$file" | cut -f1))"
