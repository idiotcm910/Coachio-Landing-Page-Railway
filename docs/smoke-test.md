# Coachio Landing Page — E2E Smoke Test Runbook

## Overview

This runbook covers two paths: **Docker Compose** (production-like, recommended for CI/release
verification) and **Host/dev** (runs against your local Postgres + Redis, no Docker required).
Both paths walk through the same 13-step E2E checklist at the end.

---

## Path 1 — Docker Compose

### Prerequisites

- Docker Engine ≥ 24, Docker Compose v2
- Outbound internet access (pulls images, calls Resend/SePay in real tests)

### Setup

```bash
# 1. Copy env template and fill real keys
cp .env.example .env
# Edit .env — minimum required:
#   SEPAY_ACCOUNT_NUMBER, SEPAY_BANK_CODE, SEPAY_ACCOUNT_NAME
#   RESEND_API_KEY, RESEND_FROM_EMAIL
#   SECRET_KEY  (random string)
# Leave S3_*/BUNNY_CDN_URL blank to skip CDN; set META_* for pixel tracking.

# 2. Validate compose config
docker compose config -q

# 3. Build + start all services in background
docker compose up --build -d

# 4. Wait until all 4 services are healthy
for i in $(seq 1 40); do
  docker compose ps --format '{{.Service}} {{.Health}}'
  echo "---"
  unhealthy=$(docker compose ps --format '{{.Health}}' | grep -vE 'healthy|^$' | wc -l)
  [ "$unhealthy" -eq 0 ] && echo "ALL HEALTHY" && break
  sleep 5
done
```

Expected: `db  api  web` all show `healthy`.

### Smoke sanity checks

```bash
# API OpenAPI schema
curl -fsS http://localhost:8000/api/v1/openapi.json | head -c 60

# Web (Next.js)
curl -fsS -o /dev/null -w '%{http_code}' http://localhost:3000

# Confirm alembic ran before API serve
docker compose logs api | grep -i 'Running database migrations\|Starting API server'

# Confirm funnel tables exist
docker compose exec db psql -U coachio -d coachio -c '\dt' | grep -E 'funnel|lead|discount'
```

### Seed admin (Docker path)

```bash
docker compose exec api python -m app.scripts.create_admin \
  --email admin@coachio.ai \
  --password <your-password>

# Verify
docker compose exec db psql -U coachio -d coachio \
  -c "SELECT email FROM admin_users;"
```

---

## Path 2 — Host/Dev (no Docker)

### Prerequisites

- Python 3.12, psql (PostgreSQL >= 14)
- venv at `apps/api/.venv` with dependencies installed

### Setup

```bash
# 1. Create a clean smoke database
dropdb --if-exists coachio_smoke && createdb coachio_smoke

# 2. Export env vars (edit values as needed)
export DATABASE_URL="postgresql+psycopg2:///coachio_smoke"
export SECRET_KEY="smoke-secret-key-change-me"
export SEPAY_ACCOUNT_NUMBER="1234567890"
export SEPAY_BANK_CODE="OCB"
export SEPAY_ACCOUNT_NAME="COACHIO SMOKE"
export RESEND_API_KEY="re_dummy"           # placeholder -- send-attempts will log 401
export RESEND_FROM_EMAIL="noreply@coachio.ai"
export S3_ENDPOINT=""
export S3_BUCKET_NAME=""
export S3_ACCESS_KEY=""
export S3_SECRET_KEY=""
export FRONTEND_URL="http://localhost:3100"
export ALLOWED_ORIGINS="http://localhost:3100"

# 3. Run migrations (from apps/api/)
cd apps/api
.venv/bin/alembic upgrade head

# 4. Seed admin (use a real domain -- .test TLD is rejected by email validator)
.venv/bin/python -m app.scripts.create_admin \
  --email admin@coachio.ai --password smokePass123

# 5. Start API server (background)
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8010 &
# Wait for: "Application startup complete."

# Sanity check
curl -fsS http://127.0.0.1:8010/api/v1/openapi.json | head -c 60
```

> **Note on external services:** With dummy keys, Resend calls return "API key is invalid"
> (logged as ERROR) and SePay QR URL is generated from config but not live-verified.
> The order flow (PENDING -> SUCCESS via webhook) works fully without internet access.

### Teardown (host path)

```bash
kill $(pgrep -f "uvicorn main:app --host 127.0.0.1 --port 8010")
dropdb coachio_smoke   # optional
```

---

## E2E Checklist (13 steps)

All routes use prefix `BASE=http://localhost:8000/api/v1` (Docker) or
`BASE=http://127.0.0.1:8010/api/v1` (host dev). Adjust accordingly.

---

### Step 0 — Seed / create admin

**Action:** see Path 1 or Path 2 setup above.

**Expect:** admin row exists in `admin_users`.

**Verify (Docker):**
```bash
docker compose exec db psql -U coachio -d coachio \
  -c "SELECT email FROM admin_users;"
```

---

### Step 1 — Admin login  *(criterion: admin-only auth works)*

```bash
curl -s "$BASE/admin/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@coachio.ai","password":"<password>"}'
```

**Expect:** HTTP 200 + JSON `{"access_token":"<jwt>","token_type":"bearer"}`.

```bash
TOKEN=$(curl -s "$BASE/admin/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@coachio.ai","password":"<password>"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

---

### Step 2 — Create product  *(criterion: products)*

```bash
curl -s -w '\nHTTP_%{http_code}' "$BASE/admin/products" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Product","slug":"test-product","type":"digital","base_price":100000,"status":"active"}'
```

**Expect:** HTTP 201 + product `id`.

```bash
PRODUCT_ID=<id from response>
```

---

### Step 3 — Create funnel  *(criterion: funnel build)*

```bash
curl -s -w '\nHTTP_%{http_code}' "$BASE/admin/funnels" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"product_id\":\"$PRODUCT_ID\",\"title\":\"Smoke Funnel\",\"slug\":\"smoke\",\"currency\":\"VND\"}"
```

**Expect:** HTTP 201 + funnel `id`.

```bash
FUNNEL_ID=<id from response>
SLUG="smoke"
```

---

### Step 4 — Publish funnel  *(criterion: publish -> public landing)*

```bash
curl -s -w '\nHTTP_%{http_code}' -X PATCH "$BASE/admin/funnels/$FUNNEL_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"published"}'
```

**Expect:** HTTP 200 + `"status":"published"`.

---

### Step 5 — Public landing  *(criterion: view landing public)*

```bash
curl -s -w '\nHTTP_%{http_code}' "$BASE/public/funnels/$SLUG"
```

**Expect:** HTTP 200 + JSON with `title`, `product_name`, `price`. In-process landing cache populated on first hit.

---

### Step 6 — Capture lead  *(criterion: thu lead)*

```bash
# Get capture token (admin)
curl -s "$BASE/admin/funnels/$FUNNEL_ID/capture-token" \
  -H "Authorization: Bearer $TOKEN"
# Response: {"capture_token":"fct_...","capture_endpoint":"/api/v1/public/funnels/leads/capture"}

CAPTURE_TOKEN=<token from response>

# Submit lead
curl -s -w '\nHTTP_%{http_code}' "$BASE/public/funnels/leads/capture" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$CAPTURE_TOKEN\",\"email\":\"buyer@example.com\",\"name\":\"Test Buyer\",\"phone\":\"0912345678\"}"
```

**Expect:** HTTP 200 + `{"ok":true}`.

**Verify lead recorded:**
```bash
curl -s "$BASE/admin/leads?funnel_id=$FUNNEL_ID" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['total'])"
```

---

### Step 7 — Discount: create + apply at checkout  *(criterion: discount stacking)*

```bash
# 7a: Create 10% discount scoped to this funnel
curl -s -w '\nHTTP_%{http_code}' "$BASE/admin/discounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"SMOKE10\",\"discount_type\":\"percent\",\"discount_value\":10,\"is_active\":true,\"scopes\":[{\"owner_type\":\"funnel\",\"owner_id\":\"$FUNNEL_ID\"}]}"
# Expect: 201

# 7b: Quote with discount code
curl -s -w '\nHTTP_%{http_code}' "$BASE/public/funnels/$SLUG/quote" \
  -H 'Content-Type: application/json' \
  -d '{"discount_codes":["SMOKE10"]}'
```

**Expect (7b):** HTTP 200 + `subtotal_amount=100000`, `discount_amount=10000`, `final_amount=90000`, discount entry with `applied=true`.

---

### Step 8 — Checkout -> order PENDING + SePay QR  *(criterion: checkout -> QR)*

```bash
curl -s -w '\nHTTP_%{http_code}' "$BASE/public/funnels/$SLUG/checkout" \
  -H 'Content-Type: application/json' \
  -d '{"buyer_name":"Test Buyer","buyer_email":"buyer@example.com","buyer_phone":"0912345678","discount_codes":["SMOKE10"]}'
```

**Expect:** HTTP 201 + `{"order_id":"...","order_code":"SEP##########","status":"PENDING","final_amount":90000,"qr_url":"https://qr.sepay.vn/..."}`.

```bash
ORDER_CODE=<order_code from response>
ORDER_ID=<order_id from response>
```

---

### Step 9 — SePay webhook -> order SUCCESS  *(criterion: webhook SUCCESS)*

```bash
curl -s -w '\nHTTP_%{http_code}' "$BASE/hooks/sepay-payment" \
  -H 'Content-Type: application/json' \
  -d "{
    \"gateway\":\"OCB\",
    \"transactionDate\":\"2026-06-30 10:00:00\",
    \"accountNumber\":\"1234567890\",
    \"content\":\"$ORDER_CODE smoke test\",
    \"transferType\":\"in\",
    \"description\":\"smoke\",
    \"transferAmount\":90000,
    \"referenceCode\":\"REF001\",
    \"accumulated\":90000,
    \"id\":1
  }"
```

**Expect:** HTTP 200 + `{"status":"success","order_code":"...","funnel_id":"..."}`.

**Verify order flipped:**
```bash
curl -s "$BASE/public/funnels/orders/$ORDER_ID/status"
# Expect: {"order_id":"...","status":"SUCCESS",...}
```

---

### Step 10 — Receipt email sent  *(criterion: email receipt)*

**Action:** inspect API logs.

```bash
# Docker path
docker compose logs api | grep -i 'receipt\|Funnel email\|resend'

# Host path
grep -i 'receipt\|Funnel email' /tmp/api-smoke.log
```

**Expect:** Lines like `Funnel email failed (key=receipt order=...): API key is invalid`
confirm the email render path was reached. With real `RESEND_API_KEY` the email delivers;
with a placeholder, the logged 401 from Resend is the pass criterion.

---

### Step 11 — External gift delivery *(criterion: giao qua ngoai -- optional)*

```bash
# (Requires gift_automations configured -- use admin API or check gift_grants table)
docker compose exec db psql -U coachio -d coachio \
  -c "SELECT status FROM gift_grants LIMIT 5;"
```

**Expect:** rows present with `status='pending'` or `'delivered'` after an order SUCCESS that triggers a gift rule.

---

### Step 12 — Lucky draw: event -> spin -> winner  *(criterion: lucky draw)*

```bash
# 12a: Create event
curl -s -w '\nHTTP_%{http_code}' "$BASE/admin/lucky-events" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"funnel_id\":\"$FUNNEL_ID\",\"title\":\"Smoke Draw\",\"slug\":\"smoke-draw\"}"
# EVENT_ID=<id>

# 12b: Add a prize
curl -s -w '\nHTTP_%{http_code}' "$BASE/admin/lucky-events/$EVENT_ID/prizes" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Grand Prize","quantity":5}'
# PRIZE_ID=<id>

# 12c: Set event to open (use "action" field, not "status")
curl -s -w '\nHTTP_%{http_code}' -X PATCH "$BASE/admin/lucky-events/$EVENT_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"action":"open"}'

# 12d: Add a participant manually
curl -s -w '\nHTTP_%{http_code}' "$BASE/admin/lucky-events/$EVENT_ID/participants" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"display_name":"Test Participant","phone":"0912345678"}'

# 12e: Spin (admin endpoint -- picks a random eligible participant)
curl -s -w '\nHTTP_%{http_code}' "$BASE/admin/lucky-events/$EVENT_ID/spin" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"prize_id\":\"$PRIZE_ID\"}"
```

**Expect:** HTTP 200 + `{"winner":{"id":"...","prize_name":"Grand Prize","display_name":"Test Participant",...}}`.

**Verify winners:**
```bash
curl -s "$BASE/admin/lucky-events/$EVENT_ID/winners" \
  -H "Authorization: Bearer $TOKEN"
```

> **Note:** The PATCH `/status` endpoint uses `{"action":"open"}` or `{"action":"lock"}` --
> NOT `{"status":"open"}`.

---

### Step 13 — Broadcast: draft -> send -> jobs created  *(criterion: broadcast)*

```bash
# 13a: Create broadcast draft targeting funnel leads
curl -s -w '\nHTTP_%{http_code}' "$BASE/admin/broadcasts" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"title\":\"Smoke Broadcast\",
    \"subject\":\"Hello from smoke\",
    \"html_body\":\"<p>Smoke test email</p>\",
    \"audience_config\":{\"funnel_ids\":[\"$FUNNEL_ID\"]}
  }"
# BROADCAST_ID=<id>

# 13b: Send (dispatches to broadcast_send_jobs and background worker)
#   NOTE: requires Content-Type: application/json with {} body; bare POST returns 422
curl -s -w '\nHTTP_%{http_code}' -X POST "$BASE/admin/broadcasts/$BROADCAST_ID/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Expect (13b):** HTTP 200 + `"status":"sending"`.

**Verify jobs created:**
```bash
# Docker path
docker compose exec db psql -U coachio -d coachio \
  -c "SELECT status, count(*) FROM broadcast_send_jobs GROUP BY status;"

# Host path
psql coachio_smoke -c "SELECT status, count(*) FROM broadcast_send_jobs GROUP BY status;"
```

**Expect:** rows with `status='sending'` or `'failed'` (latter expected with placeholder `RESEND_API_KEY`).

---

## Result

All core steps (1-9, 12-13) pass -> OSS package verified end-to-end.
External-service failures (Resend 401, Meta CAPI unreachable) are **acceptable** with placeholder keys.
Record date + commit hash here when verified: ______

---

## Success Criterion Map (spec §9)

| Spec §9 criterion | Smoke step |
|---|---|
| `docker compose up` -> 4 services healthy | P4 Task 9 + Path 1 setup |
| Tao funnel | Step 3 |
| Publish | Step 4 |
| Xem landing public | Step 5 |
| Thu lead | Step 6 |
| Discount: tao ma -> ap checkout | Step 7 |
| Checkout -> QR SePay | Step 8 |
| Webhook SUCCESS | Step 9 |
| Email receipt | Step 10 |
| Giao qua ngoai (tuy) | Step 11 |
| Lucky draw: event -> spin -> winner | Step 12 |
| Broadcast: soan -> gui toi leads | Step 13 |
| Khong con ref course/llm/vibecreator; typecheck pass | P4 Task 8 REF-SCAN + api boot |

---

## Known Gotchas

- **Email domain for admin:** `.test` TLD is rejected by the email validator in `AdminLoginRequest`.
  Use a real TLD (`.ai`, `.com`, etc.) when seeding.
- **Lucky event status update:** uses `{"action":"open"}` not `{"status":"open"}`.
- **Broadcast send body:** POST to `/{cid}/send` requires `Content-Type: application/json` with `{}`
  (empty JSON body); omitting body returns 422.
- **SePay webhook `id` field:** required integer -- include any non-null integer in the payload.
- **SSR internal URL (Docker):** Next.js SSR fetches use `API_INTERNAL_URL=http://api:8000`
  (set in compose `web.environment`). Browser fetches use `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000`.
