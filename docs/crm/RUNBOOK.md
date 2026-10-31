# CRM runbook

How to run the CRM on the Hostinger VPS day to day, and what to do when something goes wrong. Paths assume the repo is checked out at `/srv/littlestepz`; adjust if not.

## At a glance

| Thing | Where |
|---|---|
| Site | https://crm.littlestepz.in (nginx: `/etc/nginx/sites-available/crm.littlestepz.in`) |
| Processes | `pm2 ls`: `crm-api` (127.0.0.1:8100), `crm-web` (127.0.0.1:3100) |
| Database | Docker container `crm-postgres` (127.0.0.1:5433), volume `little-stepz-crm_crm-pgdata` |
| Logs | `pm2 logs crm-api`, `pm2 logs crm-web`, `/var/log/crm/*.log` (backups, drills), `/var/log/nginx/` |
| Health | `curl -fsS http://127.0.0.1:8100/health` → `{"status":"ok"}` |
| Backups | `/var/backups/crm` (14 days) and the off-server bucket in `/etc/crm-backup.env` |

Every request has an id: the `X-Request-Id` response header, which also appears in API log lines and audit rows. Ask for it when someone reports an error.

## First install (once)

1. **Server.**
   - Node 22, pnpm 9, Docker, nginx, certbot, rclone, PM2 (`npm i -g pm2`, then `pm2 startup`).
   - `timedatectl set-timezone Asia/Kolkata`.
2. **Code.**
   - `git clone … /srv/littlestepz && cd /srv/littlestepz && git checkout crm`
3. **Database.**
   - `cp docker/.env.sample docker/.env`, then set a long random `CRM_DB_PASSWORD`.
   - `docker compose -f docker/crm-postgres.compose.yml --env-file docker/.env up -d`
4. **Env files** (never committed):
   - `apps/crm-api/.env` from `deploy/crm/env/crm-api.env.production.sample`
   - `apps/crm-web/.env.production` from `deploy/crm/env/crm-web.env.production.sample`
   - `packages/crm-db/.env` with the same `CRM_DATABASE_URL`
   - `chmod 600` all three.
5. **Backups.**
   - `/etc/crm-backup.env` with `OFFSITE=<rclone remote:bucket>`. Run `rclone config` first.
   - Set bucket lifecycle rules for off-server retention, e.g. 30 daily and 12 monthly.
   - `mkdir -p /var/log/crm`
6. **Build and start.** Run `deploy/crm/deploy.sh crm`. The first run's backup is of the empty database.
7. **Owner login.**
   - Set `SEED_ADMIN_*` in `apps/crm-api/.env`, run `pnpm --filter crm-api seed`, then blank those values.
   - Sign in and change the password.
8. **TLS and nginx.**
   - Copy `deploy/crm/nginx/crm.littlestepz.in.conf` to `sites-available`, symlink it, and get the certificate (see the file header).
   - `nginx -t && systemctl reload nginx`
9. **Cron.** Install `deploy/crm/crontab.txt` (`crontab -e`).
10. **Prove it.** Run `deploy/crm/restore-drill.sh`. It must print `PASS`.
11. Work through [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).

## Deploying a new version

```sh
cd /srv/littlestepz && deploy/crm/deploy.sh crm
```

The script:
1. Backs up first.
2. Pulls with fast-forward only.
3. Installs from the lockfile and applies migrations.
4. Builds and reloads PM2.
5. Waits for both health checks.

If it stops, nothing after the failing step ran; read the message. Deploy outside shop hours.

### Rolling back a bad release

- **The release has no migration:**
  - `git checkout <previous-commit>`, then `deploy/crm/deploy.sh <previous-commit>`.
  - `git log --oneline -5` shows the previous commit.
- **The release had a migration:** check `packages/crm-db/prisma/migrations` in the diff. Code alone can't go back past a migration:
  1. `pm2 stop crm-api crm-web`
  2. Restore the backup taken at the start of that deploy (see "Restoring" below).
  3. Check out the previous commit and run `deploy/crm/deploy.sh <previous-commit>`.

  Anything entered after that backup is lost, so prefer fixing forward unless the data is wrong.

## Backups

- `backup.sh` runs nightly at 02:15 and at every deploy.
  - Check it: `tail /var/log/crm/backup.log` and `ls -lh /var/backups/crm`.
  - The latest file should be from today, and the log should say "Copied off-server".
- A run fails loudly if the dump can't be read back (`pg_restore --list`).
- If OFFSITE isn't set it **warns**: the backup exists on the VPS only, and a lost VPS means lost data. Fix that the same day.
- **Monthly:** `restore-drill.sh` restores the latest state into a scratch database and compares every table. Check `/var/log/crm/restore-drill.log` for `PASS`.

## Restoring

Look before overwriting anything. Restore into a scratch database first:

```sh
deploy/crm/restore.sh /var/backups/crm/crm-<stamp>.dump              # → littlestepz_crm_restore
docker exec -it crm-postgres psql -U crm -d littlestepz_crm_restore  # inspect
```

When you are sure, replace the live database:

```sh
pm2 stop crm-api
CONFIRM_LIVE_RESTORE=yes deploy/crm/restore.sh /var/backups/crm/crm-<stamp>.dump littlestepz_crm
pm2 start crm-api
```

To restore from off-server, fetch the file and its `.sha256` first:

```sh
rclone copy <remote>/crm-<stamp>.dump . && rclone copy <remote>/crm-<stamp>.dump.sha256 .
```

The checksum is verified automatically.

## Everyday admin tasks

| Task | How |
|---|---|
| New staff member | Settings → Users & roles → Add user. They get a temporary password and must change it at first sign-in. |
| Someone left | Deactivate the user. Every request checks this, so they are signed out at once. Their history stays. |
| Forgotten password | Admin resets it in Users & roles (new temporary password). |
| Locked out by the rate limit | Wait 15 minutes, or `pm2 restart crm-api`, which clears the in-memory counter. |
| Cash day closed by mistake | Cash Closing → Reopen (admin, needs a reason; audited). |
| Wrong import | Import Data → the batch → Roll back. Refused once its records are used; then correct by hand (adjustment, edit, archive). |
| Wrong stock entry | Inventory → the document → Reverse. Entries owned by a purchase, sale, return, count or import are reversed from that record. |
| Who changed this? | Audit History, filtered by record. It shows before/after, user, time and request id. |

## Incidents

| Symptom | Check | Fix |
|---|---|---|
| Site down (502) | `pm2 ls`; `pm2 logs crm-api --lines 100` | `pm2 restart crm-api crm-web`. If it crashes on start, the log names the env variable or migration at fault. |
| API "Invalid crm-api environment" | The log lists each bad variable | Fix `apps/crm-api/.env`, then `pm2 restart crm-api --update-env` |
| `/health` fails, DB errors in log | `docker ps`; `docker logs crm-postgres --tail 50` | `docker compose -f docker/crm-postgres.compose.yml --env-file docker/.env up -d`. Check `df -h`. |
| Disk full | `df -h`; `du -sh /var/backups/crm /var/lib/docker` | Prune old local backups, `pm2 flush`, `docker system prune` (never `docker volume prune`) |
| Certificate expired | `certbot certificates` | `certbot renew && systemctl reload nginx` |
| Backup log shows FAIL or no file today | `/var/log/crm/backup.log` | Run `deploy/crm/backup.sh` by hand and read the error. Usually the container is down, rclone credentials expired, or the disk is full. |
| Everything is slow | `pm2 monit`; `docker stats crm-postgres` | Restart the API. If reports are slow, narrow the date range. |
| Suspected breach | Audit History (filter by user; rows carry the IP) | 1. Deactivate the affected users (immediate). 2. Rotate `ACCESS_TOKEN_SECRET` and the DB password (below). 3. Restore only if data was altered. |

## Rotating secrets

| Secret | Steps |
|---|---|
| `ACCESS_TOKEN_SECRET` | New value in `apps/crm-api/.env`, then `pm2 restart crm-api --update-env`. Everyone signs in again within 15 min. |
| Database password | 1. `ALTER ROLE crm PASSWORD '…'` in psql. 2. Update `docker/.env`, `apps/crm-api/.env` and `packages/crm-db/.env`. 3. `pm2 restart crm-api --update-env`. |
| Website sync key | Change it on both sides (see WEBSITE_SYNC_CONTRACT.md), then restart both. |

## Website sync

- It is **off** in production until the website's export endpoints exist and have been reviewed.
- To turn it on:
  1. Set `WEBSITE_SYNC_MODE=live`, `WEBSITE_SYNC_URL` and `WEBSITE_SYNC_KEY`.
  2. Restart the API.
  3. Go to Settings → Integrations → Dry run, and review the report.
  4. Only then use Link IDs.
- It never writes to the website.
