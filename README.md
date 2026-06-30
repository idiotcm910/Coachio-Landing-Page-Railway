# Coachio Landing Page

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/CHANGE_ME)

> 🇻🇳 Tài liệu tiếng Việt: [README.vi.md](./README.vi.md)
> This repo is a Railway-optimised downstream of [coachio-landing-page](https://github.com/sonlovinbot/coachio-landing-page).

Open-source funnel & landing-page platform: build landing pages, capture leads,
sell digital products with SePay/VietQR checkout, send transactional + broadcast
emails, run discounts, lucky-draw events, deliver external gifts, and read
funnel analytics — all from one admin app. FastAPI + Next.js, MIT licensed.

## Features

- **Funnel & landing builder** — sections, SEO, custom variables, preview before publish.
- **Lead capture** — anonymous public capture with token, exportable leads.
- **Checkout & orders** — digital/service products, order status, expiry of unpaid orders.
- **SePay / VietQR payment** — QR generation + webhook → order SUCCESS.
- **Email** — transactional receipt / waiting-payment + broadcast campaigns (Resend).
- **Discounts** — codes with scope + default activation, stacking at checkout.
- **Lucky draw** — events, prizes, public spin, winners.
- **External gifts** — deliver downloadable file / coupon code / custom URL by email.
- **Analytics** — funnel + revenue analytics, optional Meta CAPI tracking.

## Tech Stack

- **API:** Python 3.12, FastAPI, SQLAlchemy, Alembic, Resend, boto3. In-process cache (no Redis).
- **Web:** Next.js 14, Tailwind v3, `@coachio/api-client`, `@coachio/design-system`.
- **Infra:** Postgres 16, Docker Compose. Monorepo: nx + pnpm.

## Prerequisites

- Docker + Docker Compose v2 (for the one-command run).
- For local dev without Docker: Node 20 + pnpm 10, Python 3.12, Postgres 16.

## Quick start (Docker)

```bash
cp .env.example .env          # fill SEPAY_*, RESEND_*, S3_* etc. (placeholders ok for smoke)
docker compose up --build     # starts db, api (migrates), web
```

- Web: http://localhost:3000
- API docs (Swagger): http://localhost:8000/api/v1/docs

`api` runs `alembic upgrade head` on start, then serves uvicorn. `web` waits for
`api` to become healthy before starting.

## Environment

All config lives in `.env` (see `.env.example` for every key + a one-line note).
Required to actually transact: `DATABASE_URL`, `SECRET_KEY`,
`SEPAY_BANK_NAME`, `SEPAY_ACCOUNT_NUMBER`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`FRONTEND_URL`. Storage (`S3_*` / `BUNNY_*`) and `META_DEFAULT_*` are optional.

### Frontend env

These variables are consumed by the web app and easy to overlook because they
are not part of the API config:

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Baked at **build** time | Browser-facing API base URL. After changing, rebuild: `docker compose build web`. |
| `API_INTERNAL_URL` | Runtime (compose only) | SSR fetch URL inside the compose network (e.g. `http://api:8000`). Never exposed to the browser. |
| `NEXT_PUBLIC_DEFAULT_FUNNEL_SLUG` | Baked at **build** time | Slug of the funnel that `/` redirects to. Omitting it shows a "not configured" placeholder at the root. |

`NEXT_PUBLIC_*` variables are baked into the Next.js bundle at build time — changing
them requires a rebuild, not just a container restart.

## Local dev (without Docker)

```bash
pnpm install
# 1) Postgres running locally; set DATABASE_URL in .env
# 2) API (migrations + reload server)
pnpm exec nx run api:migrate
pnpm exec nx run api:serve        # http://localhost:8000
# 3) Seed first admin (one-time)
cd apps/api && python -m app.scripts.create_admin --email admin@example.com --password <secret>
# 4) Web
pnpm exec nx run web:dev          # http://localhost:3100
```

Other nx targets: `nx run api:test`, `nx run api:lint`, `nx run api:typecheck`,
`nx run web:typecheck`.

## Deploy

- Build images: `docker compose build`. Push to your registry, run compose on host.
- **Scaling note:** the `api` entrypoint runs `alembic upgrade head` on every start.
  If you run more than one `api` replica, run migrations as a single one-shot step
  and remove the migrate line from the entrypoint to avoid concurrent-migration races.

## Smoke test

End-to-end verification runbook lives in
`docs/smoke-test.md` (admin → funnel → publish → lead → checkout → SePay webhook →
receipt email → gift → lucky-draw → broadcast → discount).

## Deploy lên Railway

One-click deploy: api (FastAPI) + web (Next.js) + Postgres — see [`docs/railway-template.md`](./docs/railway-template.md) for the full env-var wiring table, pre-deploy migration notes, and the marketplace publish checklist.

> The badge link above uses `CHANGE_ME` — update it with your template ID after publishing on the Railway dashboard.

## License

MIT — see [LICENSE](./LICENSE).
