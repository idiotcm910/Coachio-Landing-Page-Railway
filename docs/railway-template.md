# Railway Template — Coachio Landing Page

One-click Railway deployment of Coachio Landing Page: FastAPI api + Next.js web + managed Postgres + managed Redis (optional).

> This repo is a Railway-optimised downstream of [coachio-landing-page](https://github.com/sonlovinbot/coachio-landing-page). Railway-specific files (`railway.toml`, `railway.json`, cache backend, health endpoints) are excluded from upstream sync.

---

## Components (4 services)

| Service | Image / Builder | Notes |
|---------|----------------|-------|
| **api** | `apps/api/Dockerfile` | FastAPI + Alembic; pre-deploy migration |
| **web** | `apps/web/Dockerfile` | Next.js 14 standalone, pnpm workspace build from repo root |
| **Postgres** | Railway managed (postgres:16) | Auto-exposes `DATABASE_URL` |
| **Redis** | Railway managed (redis:7-alpine) | Optional — app falls back to in-memory cache |

---

## Environment Variable Wiring

### api service

| Variable | Template value | Notes |
|----------|---------------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Managed Postgres connection string |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Optional — leave blank → in-memory cache (no Redis needed) |
| `SECRET_KEY` | `${{secret(32)}}` | Auto-generated 32-char random string at deploy time |
| `FRONTEND_URL` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` | Used for CORS + email links back to the web app |
| `NEXT_PUBLIC_BACKEND_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` | Browser-side API base URL (baked into Next.js build) |

Optional (leave blank — feature is inert until filled):

| Variable | Purpose |
|----------|---------|
| `SEPAY_BANK_NAME`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_WEBHOOK_TOKEN` | SePay/VietQR payment |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional + broadcast email |
| `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_ENDPOINT_URL`, `S3_REGION` | S3-compatible file storage |
| `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_KEY`, `BUNNY_CDN_BASE_URL` | BunnyCDN file storage (alt to S3) |
| `META_DEFAULT_PIXEL_ID`, `META_DEFAULT_ACCESS_TOKEN` | Meta CAPI analytics |
| `NEXT_PUBLIC_DEFAULT_FUNNEL_SLUG` | Slug that `/` redirects to (blank = placeholder page) |

### web service

| Variable | Template value | Notes |
|----------|---------------|-------|
| `API_INTERNAL_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}` | SSR fetch to api over private network (no egress) |
| `NEXT_PUBLIC_BACKEND_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` | Browser-side API base URL (baked at build time) |

> `NEXT_PUBLIC_*` variables are baked into the Next.js bundle at **build time**. Changing them after deploy requires a rebuild.

---

## Pre-Deploy Migration

`apps/api/railway.toml` sets `preDeployCommand = ["alembic upgrade head"]`.

Railway runs the migration **after build, before the new replica goes live**. If migration fails, deploy is blocked and the previous version stays live (zero-downtime safety).

On the very first deploy of a fresh template, Postgres is provisioned first. The pre-deploy command runs with `DATABASE_URL` available, so it can reach Postgres. If the deploy fails on migration, re-deploy from the Railway dashboard — subsequent runs are idempotent.

---

## Redis Optional / In-Memory Fallback

If `REDIS_URL` is blank or Redis is unreachable at startup, the api uses an in-memory dict-based cache (TTL, rate-limit counters) instead. The app starts up green without Redis.

**Caveat:** in-memory cache is not shared across replicas. Keep `numReplicas = 1` (Railway default) or provision Redis when scaling horizontally.

---

## Health Checks

| Service | Path | Expected |
|---------|------|----------|
| api | `GET /api/v1/health` | `200 {"status":"ok"}` |
| web | `GET /api/health` | `200 {"status":"ok"}` |

Both paths are configured in each `railway.toml`.

---

## Publishing the Template on Railway (owner-only steps)

The template is published from the Railway dashboard by the repo owner. Steps:

- [ ] Push this repo to a **public** GitHub repository.
- [ ] Open [Railway dashboard](https://railway.com) → your workspace → **Templates** tab → **New Template**.
- [ ] Link the GitHub repo; Railway auto-reads `railway.json` for service definitions.
- [ ] Configure each service's variables (copy the wiring table above); mark optional variables as *prompt* so deployers are asked at deploy time.
- [ ] Set `SECRET_KEY` source to **generated** (`secret(32)`).
- [ ] Add a **Postgres** and **Redis** plugin to the template.
- [ ] Save and preview the template deploy flow.
- [ ] Click **Publish to Marketplace** — Railway team reviews before it appears publicly.
- [ ] After approval, copy the template ID from the marketplace URL.
- [ ] Update the "Deploy on Railway" badge in `README.md` — replace `CHANGE_ME` with the template ID:
  ```
  https://railway.com/new/template/<YOUR_TEMPLATE_ID>
  ```
- [ ] Commit and push the updated README.

> The `railway.json` at repo root describes the template services for Railway's config-as-code reader. As of 2026, the dashboard publish step is still required for marketplace listing; `railway.json` alone does not auto-publish.

---

## Notes

- **Build context:** Railway Root Directory is `/` (repo root). Both Dockerfiles require the full monorepo context for pnpm workspace package resolution (`@coachio/api-client`, `@coachio/design-system`).
- **Private networking:** web SSR calls api via `http://${{api.RAILWAY_PRIVATE_DOMAIN}}` (IPv6 mesh, no egress charges). Public browser calls use `NEXT_PUBLIC_BACKEND_URL`.
- **Watch patterns:** `apps/api/railway.toml` watches `apps/api/**` only; `apps/web/railway.toml` watches `apps/web/**`, `packages/**`, and `pnpm-lock.yaml`. Changes outside these paths do not trigger a rebuild of that service.
- **Scaling:** Default `numReplicas = 1`. Scale api replicas only when Redis is provisioned (in-memory cache is per-replica).
