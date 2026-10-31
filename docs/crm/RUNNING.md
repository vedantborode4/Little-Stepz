# Running the CRM locally

Prerequisites: Node 22, pnpm 9, Docker Desktop (running).

## 1. Database

```sh
cp docker/.env.sample docker/.env            # set CRM_DB_PASSWORD
docker compose -f docker/crm-postgres.compose.yml --env-file docker/.env up -d
```

This starts `crm-postgres` on `127.0.0.1:5433`. It is completely separate from the website database.

## 2. Environment files

| File | From | Notes |
|---|---|---|
| `packages/crm-db/.env` | `.env.sample` | `CRM_DATABASE_URL` using the password from step 1 |
| `apps/crm-api/.env` | `.env.sample` | Same `CRM_DATABASE_URL`; `ACCESS_TOKEN_SECRET` must be 32+ random characters; `SEED_ADMIN_*` sets the owner login |
| `apps/crm-web/.env.local` | `.env.sample` | `CRM_API_ORIGIN=http://127.0.0.1:8100` |

## 3. Install, migrate, seed

```sh
pnpm install
pnpm --filter @repo/crm-db build             # prisma generate + compile
cd packages/crm-db && npx prisma migrate deploy && cd -
pnpm --filter @repo/crm-schema build
pnpm --filter crm-api seed                    # business profile, Store/Godown, accounts, owner admin
```

Optional demo catalog (products and variants marked SAMPLE, refused in production): `pnpm --filter crm-api seed:demo`.

`SEED_DEMO_USERS=true` also creates `cashier@demo.local` and `ops@demo.local` (password `Demo-pass-123`). This is refused when `NODE_ENV=production`.

## 4. Run

```sh
pnpm --filter crm-api dev     # http://localhost:8100  (tsx watch)
pnpm --filter crm-web dev     # http://localhost:3100
```

The browser only talks to `:3100`. Next.js proxies `/api/*` to the API, so the refresh cookie is first-party.

## 5. Checks

```sh
pnpm --filter crm-api check-types
pnpm --filter crm-api test        # Vitest against littlestepz_crm_test (same container)
pnpm --filter crm-web lint
pnpm --filter crm-web check-types
```

The test database is migrated, never wiped, and tests don't depend on it being empty. To start it fresh, run this yourself. It only drops the `_test` database:

```sh
cd packages/crm-db
CRM_DATABASE_URL=<your url with littlestepz_crm_test> npx prisma migrate reset --force --skip-seed
```

## Importing data and the website sync locally

- **Import Data** (admin) takes .csv or .xlsx files. Sample files live in the test suite (`apps/crm-api/test/imports.test.ts`) and show the expected columns.
- `WEBSITE_SYNC_MODE=mock` in `apps/crm-api/.env` lets Settings → Integrations run dry runs against built-in SAMPLE data. Nothing from the real website is read, and linking is refused for demo data.
- **Product photos** upload to Cloudinary only when `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are set in `apps/crm-api/.env`; the website's account works, and the CRM stays inside `CLOUDINARY_FOLDER` (default `littlestepz-crm`). Without them, uploads say so and photos can still be added by link.

## Backups and the restore drill

The scripts in `deploy/crm/` also work locally (Git Bash on Windows) against the Docker container:

```sh
bash deploy/crm/restore-drill.sh     # backup → restore into a scratch DB → compare every table → drop it
```

## Production

Local builds are for development and demos. Going live follows [RUNBOOK.md](RUNBOOK.md) (install, deploy, backups, restore) and [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md). Demo users and SAMPLE data must never exist in production; the seed scripts refuse them when `NODE_ENV=production`.
