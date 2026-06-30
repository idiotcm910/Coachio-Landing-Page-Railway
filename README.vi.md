# Coachio Landing Page — Tài liệu tiếng Việt

> 🇬🇧 English documentation: [README.md](./README.md)

Nền tảng funnel & landing page mã nguồn mở: xây dựng landing page, thu thập lead, bán sản phẩm số với thanh toán SePay/VietQR, gửi email giao dịch và broadcast, chạy chương trình giảm giá, sự kiện vòng quay may mắn, tặng quà ngoài tự động và đọc analytics funnel — tất cả trong một ứng dụng admin. FastAPI + Next.js, giấy phép MIT.

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Tính năng](#2-tính-năng)
3. [Công nghệ & Kiến trúc](#3-công-nghệ--kiến-trúc)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Yêu cầu hệ thống](#5-yêu-cầu-hệ-thống)
6. [Cài đặt & chạy local](#6-cài-đặt--chạy-local)
7. [Chạy bằng Docker](#7-chạy-bằng-docker)
8. [Biến môi trường](#8-biến-môi-trường)
9. [Luồng nghiệp vụ funnel](#9-luồng-nghiệp-vụ-funnel)
10. [API chính](#10-api-chính)
11. [Kiểm thử](#11-kiểm-thử)
12. [Smoke test](#12-smoke-test)
13. [Triển khai & lưu ý](#13-triển-khai--lưu-ý)
14. [Giấy phép](#14-giấy-phép)

---

## 1. Giới thiệu

**Coachio Landing Page** là nền tảng mã nguồn mở dùng để xây dựng và vận hành marketing funnel / landing page. Hệ thống bao gồm toàn bộ vòng đời từ tạo landing page (builder sections + SEO + cache), thu lead ẩn danh, checkout sản phẩm số với thanh toán QR code qua SePay/VietQR, gửi email tự động (receipt, waiting-payment, broadcast campaigns), quản lý mã giảm giá, tổ chức vòng quay may mắn (lucky draw), tặng quà ngoài qua email (file/coupon/link), đến đọc analytics doanh thu theo funnel/sản phẩm — tất cả trong một monorepo duy nhất, dễ tự triển khai.

---

## 2. Tính năng

### Funnel & Landing Builder
- Tạo, chỉnh sửa, publish funnel với nhiều sections
- Cấu hình SEO cho từng funnel (title, description, OG tags)
- Cache landing page in-process (TTL có thể tuỳ chỉnh)
- Variables (biến tuỳ chỉnh) per-funnel dùng trong landing content
- Preview landing trước khi publish

### Thu lead (Lead Capture)
- API thu lead công khai ẩn danh với capture token (per-funnel)
- Export lead ra CSV
- Danh sách lead có thể lọc, phân trang trong admin

### Checkout & Quản lý đơn hàng
- Sản phẩm số/dịch vụ (type: `digital`)
- Luồng checkout: quote → tạo đơn PENDING → thanh toán → SUCCESS
- Tự động hết hạn đơn chưa thanh toán (background job)
- Xem chi tiết đơn, lịch sử đơn trong admin

### Thanh toán SePay / VietQR
- Tạo mã QR thanh toán ngân hàng tự động (VietQR)
- Webhook nhận kết quả từ SePay: `POST /api/v1/hooks/sepay-payment`
- Đối soát order code trong nội dung chuyển khoản → chuyển đơn sang SUCCESS

### Email giao dịch & Broadcast (Resend)
- Email receipt sau khi đơn SUCCESS
- Email waiting-payment khi đơn PENDING
- Broadcast campaigns: soạn HTML, chọn audience theo funnel leads, lên lịch hoặc gửi ngay
- Worker background xử lý hàng đợi gửi email theo batch

### Mã giảm giá (Discounts)
- Tạo mã giảm giá theo phần trăm hoặc số tiền cố định
- Scope giảm giá: toàn hệ thống hoặc giới hạn theo từng funnel
- Đặt mã mặc định (auto-apply)
- Stacking nhiều mã tại checkout

### Lucky Draw (Vòng quay may mắn)
- Tạo sự kiện lucky draw gắn với funnel
- Quản lý giải thưởng (prizes) với số lượng có hạn
- Thêm người tham gia (participants) thủ công hoặc tự động
- Spin (quay) chọn người thắng ngẫu nhiên
- Xem danh sách người thắng, huỷ kết quả

### Tặng quà ngoài (External Gifts)
- Quà có thể là: file tải về, mã coupon, URL tùy chỉnh
- Giao quà tự động sau khi đơn SUCCESS qua email (Resend)
- Gift Automations: quy tắc tặng quà theo funnel/sản phẩm
- Gift Campaigns: chiến dịch tặng quà riêng
- Ledger chống trùng: mỗi đơn thành công chỉ nhận quà một lần
- Background worker xử lý hàng đợi giao quà

### Analytics
- Revenue analytics theo funnel và theo sản phẩm
- Funnel analytics: lượt xem, lead, tỷ lệ chuyển đổi
- Lead status breakdown
- Tích hợp Meta Conversions API (CAPI) để tracking sự kiện Purchase/Lead

### Media Library
- Upload, quản lý file media (S3-compatible hoặc Bunny CDN)
- CDN URL rewrite middleware (migrate legacy Bunny host sang custom CNAME)

### Bảo mật & Auth
- Toàn bộ admin routes yêu cầu JWT (`AdminUser`)
- Public routes ẩn danh (không cần auth)
- Script seed admin đầu tiên

---

## 3. Công nghệ & Kiến trúc

### Monorepo
- **Build system**: [Nx](https://nx.dev/) `22.7.1` với `@nx/next` plugin
- **Package manager**: pnpm `10.13.1`
- **Workspace**: `pnpm-workspace.yaml` khai báo `apps/web` và `packages/*`

### Backend — `apps/api`
- **Framework**: Python 3.12 + [FastAPI](https://fastapi.tiangolo.com/)
- **ORM**: SQLAlchemy + Alembic (migrations)
- **Database**: PostgreSQL 16
- **Cache / Rate-limit**: In-process (InMemoryBackend, no Redis)
- **Email**: [Resend](https://resend.com/) SDK
- **Storage**: boto3 (S3-compatible) + Bunny CDN (tuỳ chọn)
- **Tracking**: Meta Conversions API
- **Background jobs**: asyncio tasks (expire orders, broadcast dispatch, gift dispatch)

### Frontend — `apps/web`
- **Framework**: Next.js 14 (App Router)
- **Ngôn ngữ**: TypeScript
- **Styling**: Tailwind CSS v3
- **Package nội bộ**: `@coachio/api-client`, `@coachio/design-system`
- **Test**: Vitest
- **Kiến trúc route**: 1 Next.js app duy nhất cho cả trang admin (`/admin/*`) lẫn trang funnel công khai (`/funnels/[slug]/*`)

### Packages nội bộ
| Package | Tên npm | Mô tả |
|---------|---------|-------|
| `packages/api-client` | `@coachio/api-client` | HTTP client typed cho toàn bộ API |
| `packages/design-system` | `@coachio/design-system` | Component UI dùng chung |

### Auth
- Admin: JWT Bearer token (đăng nhập qua `POST /api/v1/admin/auth/login`)
- Public: ẩn danh — không cần auth; capture token per-funnel bảo vệ endpoint thu lead
- Giao diện admin: tiếng Việt

### Giấy phép
MIT — xem [LICENSE](./LICENSE).

---

## 4. Cấu trúc thư mục

```
coachio-landing-page/
├── apps/
│   ├── api/                              # FastAPI backend
│   │   ├── alembic/
│   │   │   └── versions/                # Database migrations (Alembic)
│   │   ├── app/
│   │   │   ├── api/v1/endpoints/
│   │   │   │   ├── admin/               # Admin routes (auth, funnels, products, ...)
│   │   │   │   └── public/              # Public routes (funnels, lead capture, lucky)
│   │   │   ├── core/                    # Config (settings), security (JWT, hash)
│   │   │   ├── db/                      # Database session, base
│   │   │   ├── jobs/                    # Background jobs (expiry, broadcast, gift)
│   │   │   ├── middleware/              # CDN URL rewrite middleware
│   │   │   ├── models/                  # SQLAlchemy models
│   │   │   ├── schemas/                 # Pydantic request/response schemas
│   │   │   ├── scripts/
│   │   │   │   └── create_admin.py      # Seed admin user
│   │   │   ├── services/                # Business logic services
│   │   │   └── utils/                   # Helper utilities
│   │   ├── tests/                       # pytest suite (~160 test functions, 26 files)
│   │   ├── main.py                      # FastAPI app entry point
│   │   └── project.json                 # Nx targets (serve/test/lint/migrate/typecheck)
│   └── web/                             # Next.js 14 frontend
│       └── app/
│           ├── admin/                   # Admin pages
│           │   ├── broadcasts/          # Quản lý broadcast email
│           │   ├── discounts/           # Mã giảm giá
│           │   ├── funnels/[funnelId]/  # Chỉnh sửa funnel
│           │   ├── gift-automations/    # Quy tắc tặng quà
│           │   ├── gift-campaigns/      # Chiến dịch quà
│           │   ├── gift-tracking/       # Theo dõi giao quà
│           │   ├── gifts/               # Quản lý quà ngoài
│           │   ├── leads/               # Danh sách lead
│           │   ├── login/               # Đăng nhập admin
│           │   ├── lucky-draw/[eventId] # Sự kiện vòng quay
│           │   ├── media/               # Media library
│           │   ├── orders/              # Đơn hàng
│           │   ├── products/            # Sản phẩm
│           │   └── revenue/             # Revenue analytics
│           ├── components/              # React components (admin + shared + public)
│           ├── draw/[token]/            # Trang vòng quay công khai
│           ├── funnels/[slug]/          # Trang funnel công khai
│           │   ├── checkout/            # Trang checkout
│           │   ├── preview/             # Preview landing (admin)
│           │   └── success/             # Trang thành công sau thanh toán
│           └── _lib/                    # Utilities, hooks nội bộ
├── packages/
│   ├── api-client/                      # @coachio/api-client
│   └── design-system/                   # @coachio/design-system
├── docs/
│   └── smoke-test.md                    # E2E smoke test runbook (13 bước)
├── docker-compose.yml                   # 4 services: db, redis, api, web
├── .env.example                         # Template biến môi trường
├── nx.json                              # Nx configuration
├── package.json                         # Root scripts + devDependencies
└── pnpm-workspace.yaml                  # pnpm workspace config
```

---

## 5. Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu | Ghi chú |
|---------|---------------------|---------|
| Node.js | 20 | Chạy Next.js và Nx |
| pnpm | 10 (cụ thể: `10.13.1`) | Package manager |
| Python | 3.12 | FastAPI backend |
| PostgreSQL | 16 | Database chính |
| Docker + Compose v2 | Engine ≥ 24 | Tuỳ chọn — cho chạy toàn bộ bằng container |

> Không dùng Docker: cài đặt Node, pnpm, Python 3.12 và PostgreSQL trực tiếp trên máy. Không cần Redis.

---

## 6. Cài đặt & chạy local

### Bước 1 — Cài dependencies

```bash
# Cài Node dependencies (Nx + web + packages)
pnpm install

# Cài Python dependencies cho API
cd apps/api
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

### Bước 2 — Tạo file `.env`

```bash
cp .env.example .env
```

Mở `.env` và điền các key bắt buộc:

```env
DATABASE_URL=postgresql://coachio:coachio@localhost:5432/coachio
SECRET_KEY=<random-string-dài>   # openssl rand -hex 32
SEPAY_BANK_NAME=OCB
SEPAY_ACCOUNT_NUMBER=<số-tài-khoản>
RESEND_API_KEY=re_<your-key>
RESEND_FROM_EMAIL=no-reply@example.com
FRONTEND_URL=http://localhost:3100
ALLOWED_ORIGINS=http://localhost:3100
```

### Bước 3 — Tạo database + chạy migration

```bash
# Tạo database (nếu chưa có)
createdb coachio

# Chạy migration qua Nx
pnpm exec nx run api:migrate
# Hoặc trực tiếp từ thư mục apps/api
# cd apps/api && alembic upgrade head
```

### Bước 4 — Seed admin (lần đầu tiên)

```bash
cd apps/api
python -m app.scripts.create_admin --email admin@coachio.ai --password <mật-khẩu>
```

> Lệnh này tạo hoặc cập nhật mật khẩu admin. Email phải dùng TLD thật (`.ai`, `.com`, v.v.) — TLD `.test` bị từ chối bởi validator.

### Bước 5 — Chạy backend

```bash
# Qua Nx (cwd tự động chuyển về apps/api)
pnpm exec nx run api:serve
# Hoặc thủ công
# cd apps/api && uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API chạy tại `http://localhost:8000`. Swagger UI tại `http://localhost:8000/api/v1/docs`.

### Bước 6 — Chạy frontend

```bash
pnpm exec nx run web:dev
# Hoặc dùng shortcut ở root
pnpm dev:web
```

Web chạy tại **`http://localhost:3100`** (port 3100 cho local dev).

### Tóm tắt lệnh nhanh

```bash
pnpm dev:api    # nx run api:serve  → http://localhost:8000
pnpm dev:web    # nx run web:dev    → http://localhost:3100
pnpm api:test   # nx run api:test   (pytest)
pnpm api:lint   # nx run api:lint   (flake8)
pnpm typecheck  # nx run-many -t typecheck (tất cả packages)
```

---

## 7. Chạy bằng Docker

### Bước 1 — Chuẩn bị env

```bash
cp .env.example .env
# Điền các key bắt buộc trong .env (xem phần 6 Bước 2)
```

### Bước 2 — Build & khởi động

```bash
docker compose up --build
```

Lần đầu build sẽ cần internet để pull image và cài pip/pnpm dependencies.

### Services và cổng

| Service | Image | Cổng (host:container) | Mô tả |
|---------|-------|-----------------------|-------|
| `db` | `postgres:16-alpine` | `5432:5432` | PostgreSQL database |
| `api` | Build từ `apps/api/Dockerfile` | `8000:8000` | FastAPI backend |
| `web` | Build từ `apps/web/Dockerfile` | `3000:3000` | Next.js frontend |

### Seed admin (Docker path)

```bash
docker compose exec api python -m app.scripts.create_admin \
  --email admin@coachio.ai \
  --password <mật-khẩu>
```

### Kiểm tra trạng thái

```bash
docker compose ps
# Tất cả 4 services cần hiển thị trạng thái "healthy"
```

### URL sau khi khởi động thành công

- **Web (admin + public funnel)**: `http://localhost:3000`
- **API Swagger docs**: `http://localhost:8000/api/v1/docs`

> **Lưu ý:** `api` tự động chạy `alembic upgrade head` khi khởi động, rồi mới serve uvicorn. `web` đợi `api` healthy trước khi start.

---

## 8. Biến môi trường

Toàn bộ config nằm trong `.env` (copy từ `.env.example`). Bảng dưới mô tả từng nhóm.

### Nhóm: Core API

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `PROJECT_NAME` | `Coachio Landing Page` | Tên hiển thị của ứng dụng |
| `API_V1_PREFIX` | `/api/v1` | Mount prefix cho tất cả routes v1 |
| `DEBUG` | `False` | Bật chế độ debug (chỉ dùng local) |

### Nhóm: Database

| Biến | Ví dụ | Mô tả |
|------|-------|-------|
| `DATABASE_URL` | `postgresql://coachio:coachio@db:5432/coachio` | Postgres connection string (host `db` trong Docker, `localhost` khi chạy local) |

### Nhóm: Bảo mật & JWT Admin

| Biến | Ghi chú |
|------|---------|
| `SECRET_KEY` | **Bắt buộc** — chuỗi random dài. Tạo bằng `openssl rand -hex 32` |
| `ALGORITHM` | `HS256` — thuật toán ký JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` — thời gian sống token admin (phút) |
| `ADMIN_EMAIL` | Email mặc định khi seed admin (dùng bởi script) |

### Nhóm: CORS & URL

| Biến | Mô tả |
|------|-------|
| `ALLOWED_ORIGINS` | Danh sách origin được phép CORS (dấu phẩy hoặc JSON array) |
| `FRONTEND_URL` | URL công khai của web — dùng trong link email và callback |
| `PUBLIC_WEB_BASE_URL` | Base URL cho `event_source_url` trong Meta CAPI |
| `PREFIX_URL_CALLBACK` | Base cho SePay webhook callback URL |

### Nhóm: SePay / VietQR (thanh toán)

| Biến | Mô tả |
|------|-------|
| `SEPAY_BANK_NAME` | Mã ngân hàng ngắn (ví dụ: `OCB`, `MBBank`, `VCB`) |
| `SEPAY_ACCOUNT_NUMBER` | Số tài khoản ngân hàng nhận tiền |

### Nhóm: Resend (email)

| Biến | Mô tả |
|------|-------|
| `RESEND_API_KEY` | API key của Resend |
| `RESEND_FROM_EMAIL` | Địa chỉ email gửi đã verify trên Resend |

### Nhóm: S3-compatible Storage

| Biến | Mô tả |
|------|-------|
| `S3_ENDPOINT` | Endpoint S3 (ví dụ: `https://s3.ap-southeast-1.amazonaws.com`) |
| `S3_BUCKET_NAME` | Tên bucket |
| `S3_ACCESS_KEY` | Access key ID |
| `S3_SECRET_KEY` | Secret access key |
| `S3_REGION` | Region (ví dụ: `ap-southeast-1`) |

### Nhóm: Bunny CDN (tuỳ chọn)

| Biến | Mô tả |
|------|-------|
| `BUNNY_CDN_URL` | URL CDN công khai cho media |
| `BUNNY_STORAGE_ZONE` | Tên storage zone trên Bunny |
| `BUNNY_API_KEY` | API key Bunny |
| `BUNNY_PULL_ZONE_URL` | URL pull zone |
| `BUNNY_REGION` | Region code (để trống = mặc định) |
| `CDN_LEGACY_HOSTS` | Danh sách host Bunny cũ cần rewrite (dấu phẩy) |
| `CDN_CANONICAL_HOST` | Host CDN chuẩn cần rewrite sang; trống = tắt tính năng |

### Nhóm: Meta Conversions API (tuỳ chọn)

| Biến | Mô tả |
|------|-------|
| `META_DEFAULT_PIXEL_ID` | Meta Pixel ID mặc định (khi set, funnel mới tự bật tracking) |
| `META_DEFAULT_CAPI_TOKEN` | CAPI access token mặc định |
| `META_DEFAULT_TEST_EVENT_CODE` | Mã test event (tuỳ chọn, dùng khi debug) |
| `META_GRAPH_API_VERSION` | Phiên bản Graph API (mặc định: `v21.0`) |
| `META_PURCHASE_MIN_VND` | Ngưỡng VND tối thiểu để báo cáo sự kiện Purchase (`10000`) |
| `IPINFO_TOKEN` | Token IPInfo để geo advanced matching (tuỳ chọn) |

### Nhóm: Tuning jobs (tuỳ chọn)

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `LANDING_CACHE_ENABLED` | `True` | Bật/tắt in-process cache cho landing |
| `LANDING_CACHE_TTL` | `3600` | TTL cache landing (giây) |
| `FUNNEL_ORDER_EXPIRY_JOB_INTERVAL_SECONDS` | `300` | Chu kỳ job hết hạn đơn |
| `BROADCAST_BATCH_SIZE` | `100` | Số email gửi mỗi batch |
| `BROADCAST_RATE_DELAY_MS` | `200` | Delay giữa các email (ms) |
| `BROADCAST_MAX_ATTEMPTS` | `3` | Số lần retry tối đa |
| `GIFT_BATCH_SIZE` | `50` | Số quà giao mỗi batch |
| `GIFT_MAX_ATTEMPTS` | `3` | Số lần retry tối đa cho gift dispatch |

### Nhóm: Frontend (Next.js)

> `NEXT_PUBLIC_*` được **bake vào bundle lúc build** — thay đổi đòi hỏi rebuild, không phải chỉ restart container.

| Biến | Scope | Mô tả |
|------|-------|-------|
| `NEXT_PUBLIC_BACKEND_URL` | Bake lúc build | URL API nhìn từ trình duyệt (ví dụ: `http://localhost:8000`) |
| `API_INTERNAL_URL` | Runtime (Docker only) | URL API cho SSR bên trong mạng compose (ví dụ: `http://api:8000`). Ghi đè `NEXT_PUBLIC_BACKEND_URL` phía server. Không bao giờ lộ ra trình duyệt |
| `NEXT_PUBLIC_DEFAULT_FUNNEL_SLUG` | Bake lúc build | Slug của funnel mà route `/` redirect tới. Để trống sẽ hiện trang placeholder |

---

## 9. Luồng nghiệp vụ funnel

Dưới đây là luồng E2E đầy đủ từ cấu hình đến giao dịch thành công:

```
Admin tạo Product
    ↓
Admin tạo Funnel (gắn product, đặt slug, currency=VND)
    ↓
Admin cấu hình landing (sections, SEO, variables, email templates)
    ↓
Admin publish funnel (status: published)
    ↓
Khách vào URL công khai: GET /funnels/[slug]
    → Landing page render từ server (SSR), cache in-process
    ↓
Khách nhập thông tin → Thu lead
    POST /api/v1/public/funnels/leads/capture
    (với capture_token lấy từ admin)
    ↓
Khách xem giá / áp mã giảm giá
    POST /api/v1/public/funnels/{slug}/quote
    ↓
Khách checkout
    POST /api/v1/public/funnels/{slug}/checkout
    → Tạo đơn hàng status=PENDING
    → Tạo QR VietQR (SePay)
    → Trả về order_code + qr_url
    ↓
Khách chuyển khoản (quét QR)
    ↓
SePay gửi webhook
    POST /api/v1/hooks/sepay-payment
    → Match order_code trong nội dung chuyển khoản
    → Đơn chuyển sang status=SUCCESS
    ↓
Hệ thống gửi email receipt (Resend)
    ↓ (nếu có gift automation)
Background gift worker giao quà ngoài qua email
    (file / coupon code / URL)
    ↓ (nếu có Meta CAPI)
Gửi sự kiện Purchase lên Meta Conversions API
```

---

## 10. API chính

Tất cả routes có prefix `/api/v1` (cấu hình qua biến `API_V1_PREFIX`).

### Admin (yêu cầu JWT Bearer token)

| Method | Path | Mô tả |
|--------|------|-------|
| `POST` | `/admin/auth/login` | Đăng nhập admin, nhận JWT |
| `GET/POST` | `/admin/products` | Quản lý sản phẩm |
| `GET/POST/PATCH` | `/admin/funnels` | Quản lý funnel |
| `GET/POST/PATCH/DELETE` | `/admin/funnels/{id}/sections` | Sections của landing |
| `GET/PATCH` | `/admin/funnels/{id}/email-templates` | Email templates per funnel |
| `GET` | `/admin/funnels/{id}/analytics` | Funnel analytics |
| `GET` | `/admin/funnel-analytics` | Revenue analytics (multi-funnel) |
| `GET` | `/admin/funnel-orders` | Danh sách đơn hàng |
| `GET/POST` | `/admin/discounts` | Quản lý mã giảm giá |
| `GET` | `/admin/leads` | Danh sách lead |
| `GET/POST/DELETE` | `/admin/media` | Media library |
| `GET/POST` | `/admin/broadcasts` | Broadcast email campaigns |
| `POST` | `/admin/broadcasts/{id}/send` | Gửi broadcast |
| `GET/POST` | `/admin/gifts` | Quản lý quà ngoài |
| `GET/POST` | `/admin/gift-automations` | Quy tắc tặng quà tự động |
| `GET/POST` | `/admin/gift-campaigns` | Chiến dịch tặng quà |
| `GET` | `/admin/gift-grants` | Theo dõi giao quà |
| `GET/POST` | `/admin/lucky-events` | Sự kiện vòng quay |
| `POST` | `/admin/lucky-events/{id}/spin` | Quay chọn người thắng |
| `GET/POST` | `/admin/url-redirects` | Quản lý URL redirect |

### Public (ẩn danh, không cần auth)

| Method | Path | Mô tả |
|--------|------|-------|
| `GET` | `/public/funnels/{slug}` | Lấy dữ liệu landing page (có cache Redis) |
| `POST` | `/public/funnels/leads/capture` | Thu lead (dùng capture_token) |
| `POST` | `/public/funnels/{slug}/quote` | Tính giá + áp mã giảm giá |
| `POST` | `/public/funnels/{slug}/checkout` | Tạo đơn hàng PENDING + QR |
| `GET` | `/public/funnels/orders/{order_id}/status` | Kiểm tra trạng thái đơn |
| `GET` | `/public/lucky-events/{token}` | Lấy thông tin sự kiện vòng quay |
| `GET` | `/public/url-redirects/{code}` | Resolve URL redirect |

### Webhooks

| Method | Path | Mô tả |
|--------|------|-------|
| `POST` | `/hooks/sepay-payment` | Nhận kết quả thanh toán từ SePay |

### Swagger / OpenAPI

- UI: `http://localhost:8000/api/v1/docs`
- JSON schema: `http://localhost:8000/api/v1/openapi.json`

---

## 11. Kiểm thử

### Backend (pytest)

```bash
# Chạy toàn bộ test suite API
pnpm api:test
# Hoặc
pnpm exec nx run api:test
# Hoặc trực tiếp
cd apps/api && pytest
```

- **~160 test functions** trong **26 file test** (thư mục `apps/api/tests/`)
- Bao gồm: checkout flow, discount engine, broadcast, gift fulfilment, lead capture, in-process landing cache, revenue analytics, lucky draw, media library, URL redirects,...

### Frontend (Vitest)

```bash
pnpm exec nx run web:test
# Hoặc
cd apps/web && npx vitest run
```

- **~167 test cases** trong **10 file test** (thư mục `apps/web/app/`)
- Bao gồm: discount state, lead capture component, landing custom HTML/CSS, preview, email kind catalog, thank-you templates,...

### Kiểm tra migration

```bash
cd apps/api && alembic check
# Phải trả về: "No new upgrade operations detected."
```

### Type checking toàn bộ workspace

```bash
pnpm typecheck
# Chạy nx run-many -t typecheck cho api + web + api-client + design-system
```

---

## 12. Smoke test

Runbook E2E 13 bước đầy đủ nằm tại:

**[docs/smoke-test.md](./docs/smoke-test.md)**

Bao gồm 2 path:
- **Docker Compose** — dùng cho CI/release verification (recommend)
- **Host/dev** — chạy với Postgres + Redis local, không cần Docker

**13 bước kiểm tra:**
0. Seed admin → 1. Admin login → 2. Tạo product → 3. Tạo funnel → 4. Publish → 5. Xem landing public → 6. Thu lead → 7. Tạo + áp mã giảm giá → 8. Checkout → QR SePay → 9. SePay webhook → đơn SUCCESS → 10. Email receipt → 11. Giao quà ngoài → 12. Lucky draw (event/prize/spin/winner) → 13. Broadcast (soạn/gửi/verify jobs)

> Với key placeholder (RESEND dummy, SePay test), Resend trả 401 (được ghi log) là **pass criterion** — luồng order vẫn hoạt động hoàn toàn mà không cần internet.

---

## 13. Triển khai & lưu ý

### Docker build

```bash
docker compose build
# Push image lên registry và chạy compose trên host
```

> Build cần internet (pip install + pnpm install). Trong môi trường offline, cần cache image trước.

### SSR và `API_INTERNAL_URL`

Next.js SSR (Server-Side Rendering) cần fetch API từ phía server. Trong môi trường Docker Compose, SSR fetch phải dùng URL nội bộ của container:

```env
API_INTERNAL_URL=http://api:8000        # SSR phía server dùng DNS nội bộ của compose
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000  # Trình duyệt dùng URL public
```

Nếu không set `API_INTERNAL_URL`, SSR sẽ dùng `NEXT_PUBLIC_BACKEND_URL` — điều này không hoạt động trong compose vì `localhost` phía container web không trỏ đến container api.

### Migration với nhiều replica API

Mặc định, container `api` tự chạy `alembic upgrade head` trước khi serve. Nếu chạy nhiều replica `api`, hãy tách migration thành một step riêng (one-shot) và xoá dòng migrate khỏi entrypoint để tránh race condition.

### Provider thanh toán

Hiện tại chỉ hỗ trợ **SePay / VietQR**. Chưa tích hợp provider thanh toán khác.

### Biến `NEXT_PUBLIC_*` — rebuild sau khi thay đổi

Các biến `NEXT_PUBLIC_*` được bake vào Next.js bundle lúc build. Sau khi thay đổi, cần rebuild image web:

```bash
docker compose build web
docker compose up -d web
```

Không thể thay đổi bằng cách restart container đơn thuần.

---

## 14. Giấy phép

Dự án được phát hành dưới **giấy phép MIT** — xem file [LICENSE](./LICENSE).

Bạn được tự do sử dụng, chỉnh sửa, phân phối lại kể cả cho mục đích thương mại, miễn là giữ lại thông báo bản quyền gốc.
