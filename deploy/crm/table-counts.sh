#!/usr/bin/env bash
# Exact row count of every table in a CRM database, one "table<TAB>rows" line each.
#
#   deploy/crm/table-counts.sh [database]
set -euo pipefail

CONTAINER="${CONTAINER:-crm-postgres}"
DB_USER="${DB_USER:-crm}"
db="${1:-${DB_NAME:-littlestepz_crm}}"

docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$db" -v ON_ERROR_STOP=1 -At -F $'\t' <<'SQL'
SELECT table_name,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
SQL
