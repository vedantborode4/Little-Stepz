#!/usr/bin/env bash
# Deploys the CRM on the VPS from the checked-out repo:
# backup → pull → install → migrate → build → reload → health check.
#
#   deploy/crm/deploy.sh [git-ref]        # default: the current branch
#
# Stops at the first failure. Migrations only ever run after a fresh backup,
# so a bad release can be rolled back with restore.sh (docs/crm/RUNBOOK.md).
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
ref="${1:-$(git rev-parse --abbrev-ref HEAD)}"

echo "== Backup before deploying"
"$root/deploy/crm/backup.sh"

echo "== Fetch $ref"
git fetch --prune origin
git checkout "$ref"
git pull --ff-only origin "$ref"
echo "Deploying $(git rev-parse --short HEAD)"

echo "== Install"
pnpm install --frozen-lockfile

echo "== Shared packages and migrations"
pnpm --filter @repo/crm-db build
pnpm --filter @repo/crm-schema build
pnpm --filter @repo/crm-db db:deploy

echo "== Build apps"
pnpm --filter crm-api build
pnpm --filter crm-web build

echo "== Reload"
pm2 startOrReload "$root/deploy/crm/ecosystem.config.cjs" --update-env
pm2 save

echo "== Health"
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8100/health > /dev/null && curl -fsS -o /dev/null http://127.0.0.1:3100/login; then
    echo "Healthy: $(git rev-parse --short HEAD) is live"
    exit 0
  fi
  sleep 3
done
echo "Health check failed; see: pm2 logs crm-api --lines 100" >&2
exit 1
