# Production checklist

Real data goes into the CRM only when every box in sections 1–4 is ticked **on the VPS**. A box ticked locally does not count.

Items marked ✅ were verified on the development machine in phase 14. They still need repeating on the server.

## 1. Server and network

- [ ] VPS time zone is `Asia/Kolkata`; OS security updates are on (`unattended-upgrades`)
- [ ] Firewall allows only 22, 80 and 443 (`ufw status`); SSH is key-only and root login is off
- [ ] `ss -tlnp` shows 8100, 3100 and 5433 bound to **127.0.0.1** only ✅ (API default `HOST=127.0.0.1`, `next start --hostname 127.0.0.1`, compose binds `127.0.0.1:5433`)
- [ ] nginx site installed; `nginx -t` passes; HTTP redirects to HTTPS
- [ ] Certificate issued for `crm.littlestepz.in`, and `certbot renew --dry-run` passes
- [ ] https://crm.littlestepz.in shows the sign-in page with a valid certificate and an HSTS header

## 2. Secrets and configuration

- [ ] `apps/crm-api/.env` from the production sample:
  - `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY_HOPS=1`, `CORS_ORIGIN=https://crm.littlestepz.in`
  - a fresh 48-byte `ACCESS_TOKEN_SECRET`
- [ ] `CRM_DB_PASSWORD` is long and random, and differs from every other password on the server
- [ ] `chmod 600` on `docker/.env`, `apps/crm-api/.env`, `apps/crm-web/.env.production`, `packages/crm-db/.env` and `/etc/crm-backup.env`
- [ ] `WEBSITE_SYNC_MODE=off`. `mock` is refused in production ✅
- [ ] `NEXT_PUBLIC_DEMO_MODE=false`
- [ ] `SEED_ADMIN_*` blanked after the owner account was created

## 3. Data

- [ ] Database created fresh with `prisma migrate deploy`; the demo seed was **never** run against it. It refuses to run in production ✅
- [ ] No `@demo.local` users, and nothing named "SAMPLE"
- [ ] Business profile filled in (legal name, GSTIN, state Telangana); locations Store and Godown; receiving accounts with the business/personal flags right
- [ ] GST rates and HSN codes confirmed by the CA for every category
- [ ] Opening stock entered through **Import Data**, with costs left blank where unknown ✅ (import keeps unknown costs unknown)
- [ ] Staff users created with the right roles (Cashier / Ops); each has changed their temporary password

## 4. Backups and recovery

- [ ] rclone configured; `OFFSITE` set in `/etc/crm-backup.env`; bucket lifecycle set (e.g. 30 daily, 12 monthly)
- [ ] `deploy/crm/backup.sh` run by hand: prints "Copied off-server", and the file is visible in the bucket
- [ ] Cron installed from `deploy/crm/crontab.txt`; the next morning `/var/log/crm/backup.log` shows the 02:15 run
- [ ] `deploy/crm/restore-drill.sh` prints **PASS** on the VPS ✅ (passed locally: 54 tables, 659 rows matched, stock ledger reconciled, 26 append-only triggers present)
- [ ] Restore of a real off-server copy into a scratch database, done once by hand following RUNBOOK.md
- [ ] `restore.sh` refuses to overwrite the live database without `CONFIRM_LIVE_RESTORE=yes` ✅

## 5. Security review

| Check | State |
|---|---|
| Every API route except sign-in requires a session; every module route checks a permission | ✅ reviewed (`requirePermission` on all 20 routers; auth routes are rate limited) |
| Cashier and Ops responses carry no cost, margin or profit fields | ✅ tested per module |
| Customer contacts masked in lists and reports; reveal is audited | ✅ tested |
| SQL parameterised (no `$queryRawUnsafe` / `$executeRawUnsafe`), no `dangerouslySetInnerHTML` | ✅ searched |
| Refresh cookie `httpOnly`, `SameSite=Strict`, `Secure` in production; tokens hashed at rest and rotated | ✅ |
| Spreadsheet exports neutralise formulas; uploads capped at 5 MB / 5,000 rows | ✅ |
| Ledgers, audit log, import history and sync runs reject UPDATE/DELETE at the database | ✅ tested |
| Sign-in throttled (20 failures / 15 min / IP), with the real client IP from nginx | ✅ locally; confirm on VPS that the audit log shows client IPs, not 127.0.0.1 |
| Dependency audit: `pnpm audit --prod` reviewed, no high/critical in CRM packages | [ ] on the release commit |

## 6. After go-live

- [ ] First week: the backup log is checked every morning
- [ ] First month: the restore drill log shows PASS on the 1st
- [ ] Cash closing done daily, so discrepancies surface the same day

## Known limits (accepted for go-live)

- **One API process.** The sign-in limiter is in memory. Moving it to Redis is needed before running more than one process.
- **XLSX imports load in memory.** Admin-only, with a 5 MB cap.
- **Courier statuses are entered by hand.**

## Future integrations (not built; each needs its own approval)

| Integration | Note |
|---|---|
| Website order import | Needs the export endpoints in WEBSITE_SYNC_CONTRACT.md with order lines, and real data to design against |
| Two-way stock sync to the website | Optional; needs explicit owner approval; the CRM never writes to the website today |
| Delhivery live tracking | API key and a polling job; statuses would still pass through the same shipment rules |
| GST e-invoicing | Stays in the billing software unless decided otherwise |
| Supplier payables, WhatsApp messages, barcodes | Out of scope by decision |
