#!/usr/bin/env bash
# Proves the backups work: takes a fresh backup, restores it into a scratch
# database, and checks every table has the same number of rows as the live one.
# The scratch database is dropped afterwards. Run monthly (deploy/crm/crontab.txt)
# and after any change to the backup set-up. Exits non-zero on any mismatch.
#
#   deploy/crm/restore-drill.sh
#
# Run it when nobody is entering data, or counts on busy tables may differ by
# what was written during the drill.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
CONTAINER="${CONTAINER:-crm-postgres}"
DB_USER="${DB_USER:-crm}"
DB_NAME="${DB_NAME:-littlestepz_crm}"
scratch="${DB_NAME}_drill"
work="$(mktemp -d)"
trap 'rm -rf "$work"; docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -qc "DROP DATABASE IF EXISTS \"$scratch\";" > /dev/null 2>&1 || true' EXIT

echo "== 1. Backup"
BACKUP_DIR="$work" OFFSITE="" RETAIN_DAYS=1 "$here/backup.sh" 2> >(grep -v 'OFFSITE is not set' >&2)
dump="$(ls "$work"/crm-*.dump)"

echo "== 2. Restore into $scratch"
"$here/restore.sh" "$dump" "$scratch" > "$work/restored.txt"
sed -n '1,2p' "$work/restored.txt"

echo "== 3. Compare row counts"
"$here/table-counts.sh" "$DB_NAME" > "$work/live.tsv"
"$here/table-counts.sh" "$scratch" > "$work/copy.tsv"
tables="$(wc -l < "$work/live.tsv" | tr -d ' ')"
rows="$(awk -F'\t' '{ s += $2 } END { print s }' "$work/live.tsv")"
if diff -u "$work/live.tsv" "$work/copy.tsv"; then
  echo "PASS: $tables tables and $rows rows match between $DB_NAME and the restored copy"
else
  echo "FAIL: the restored copy differs from $DB_NAME (see above)" >&2
  exit 1
fi

echo "== 4. Spot checks on the restored copy"
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$scratch" -v ON_ERROR_STOP=1 -At <<'SQL'
SELECT 'migrations applied: ' || count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;
SELECT 'stock ledger matches balances: ' || bool_and(ok)::text FROM (
  SELECT b.quantity = COALESCE(SUM(m.quantity), 0) AS ok
  FROM "StockBalance" b
  LEFT JOIN "StockMovement" m ON m."variantId" = b."variantId" AND m."locationId" = b."locationId" AND m.bucket = b.bucket
  GROUP BY b."variantId", b."locationId", b.bucket, b.quantity) t;
SELECT 'append-only triggers present: ' || count(*) FROM pg_trigger WHERE tgname LIKE '%append_only%' OR tgname LIKE '%no_delete%';
SQL
