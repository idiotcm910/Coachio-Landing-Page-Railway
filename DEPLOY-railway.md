# Hướng dẫn deploy Coachio Landing Page lên Railway — Tiếng Việt

Hướng dẫn **đầy đủ từ đầu đến cuối** deploy bản này lên **Railway** (railway.com). Railway chạy **server thật** nên hợp với app này hơn Vercel: **background job chạy realtime trong process** (broadcast/gift/đơn hết hạn), monorepo nhiều service gốc, Postgres managed. Đã **bỏ Redis** (cache in-process).

> **Kiến trúc:** 1 repo monorepo → **2 service** (`api` FastAPI, `web` Next.js) + **1 Postgres** managed. Background job chạy trong service `api`. Media dùng **S3/Bunny** (tùy chọn). Không Redis.

> **Chi phí:** Railway không có gói free vĩnh viễn — có **$5 credit dùng thử**, sau đó **Hobby ~$5/tháng** tính theo usage (rẻ, và chạy được thật).

---

## Mục lục
1. [Push repo lên GitHub](#1-push-repo-lên-github)
2. [Tạo project + Postgres](#2-tạo-project--postgres)
3. [Service API (FastAPI)](#3-service-api-fastapi)
4. [Service WEB (Next.js)](#4-service-web-nextjs)
5. [Biến môi trường](#5-biến-môi-trường)
6. [Nối web ↔ api ↔ DB](#6-nối-web--api--db)
7. [Migration + tạo admin](#7-migration--tạo-admin)
8. [Background jobs](#8-background-jobs)
9. [Chạy thử](#9-chạy-thử)
10. [Xử lý lỗi](#10-xử-lý-lỗi)

---

## 1. Push repo lên GitHub
Railway deploy từ GitHub. Đẩy repo này lên 1 repo GitHub của bạn (vd `Coachio-Landing-Page-Railway`), rồi mới làm bước 2.

---

## 2. Tạo project + Postgres
1. https://railway.com → **New Project → Deploy from GitHub repo** → chọn repo.
2. Railway tạo **1 service** đầu tiên từ repo — đây sẽ là service **api** (cấu hình ở bước 3).
3. Bấm **+ Create → Database → Add PostgreSQL** → Railway tạo Postgres managed (tên mặc định `Postgres`).

---

## 3. Service API (FastAPI)
> Nếu lỡ tạo service `api` **rỗng** (vd bằng script): vào service đó → **Settings → Remove Service** để xóa, rồi tạo lại **từ GitHub** như dưới.

Project → **+ Create → GitHub Repo** → chọn repo → đổi **Service Name = `api`** → **Settings**:
- **Source → Root Directory**: `/` (gốc repo).
- **Build**: Builder = **Dockerfile**, Dockerfile Path = `apps/api/Dockerfile`.
- **Deploy → Custom Start Command**: `sh -c 'uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}'`  *(bọc `sh -c` để Railway shell-expand `$PORT`; nếu không sẽ lỗi "'$PORT' is not a valid integer")*
- **Deploy → Pre-Deploy Command**: `alembic upgrade head`  *(tự tạo bảng mỗi lần deploy)*
- **Deploy → Healthcheck Path**: `/api/v1/health`
- (Tùy chọn) **Watch Paths**: `apps/api/**` *(chỉ rebuild khi code api đổi)*
- **Variables → Raw Editor** → dán nội dung file **`railway-api.env.example`** (xem Bước 5).

> Repo đã có sẵn `apps/api/railway.toml` ghi đúng các giá trị build/deploy trên.

---

## 4. Service WEB (Next.js)
Trong project → **+ Create → GitHub Repo** → chọn **cùng repo** → tạo service thứ 2. Mở nó → **Settings**:
- **Source → Root Directory**: `/` (gốc repo — cần cho pnpm workspace).
- **Build**: Builder = **Dockerfile**, Dockerfile Path = `apps/web/Dockerfile`.
- **Deploy → Custom Start Command**: `node apps/web/server.js`
- **Deploy → Healthcheck Path**: `/api/health`
- (Tùy chọn) **Watch Paths**: `apps/web/**`, `packages/**`, `pnpm-lock.yaml`
- Đổi tên service thành **`web`**.
- **Variables → Raw Editor** → dán nội dung file **`railway-web.env.example`** (xem Bước 5).

---

## 5. Biến môi trường
**Cách nhanh (khuyến nghị):** repo có sẵn 2 file — mở, copy **toàn bộ**, dán vào **Variables → Raw Editor** của từng service:
- Service `api` ← **`railway-api.env.example`** → nhớ sửa `SECRET_KEY` (chạy `openssl rand -hex 32` lấy chuỗi) + điền R2/Resend nếu có.
- Service `web` ← **`railway-web.env.example`**.

> ⚠️ Tham chiếu `${{web...}}` / `${{api...}}` chỉ resolve khi service đặt **đúng tên** `api`, `web`, `Postgres`.

Chi tiết từng biến (để tham khảo):
### Service `api` (Variables)
| Biến | Giá trị |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` *(tham chiếu Postgres managed)* |
| `SECRET_KEY` | chuỗi ngẫu nhiên mạnh — `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` *(CORS cho web)* |
| `FRONTEND_URL` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |
| *(tùy chọn — để trống vẫn chạy)* | `RESEND_API_KEY`,`RESEND_FROM_EMAIL`; `SEPAY_BANK_NAME`,`SEPAY_ACCOUNT_NUMBER`; `STORAGE_ENDPOINT`,`STORAGE_BUCKET`,`STORAGE_ACCESS_KEY`,`STORAGE_SECRET_KEY` (media); `META_DEFAULT_PIXEL_ID`,`META_DEFAULT_CAPI_TOKEN` |

### Service `web` (Variables)
| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` |
| `API_INTERNAL_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` *(SSR; dùng public cho đơn giản)* |
| `NEXT_PUBLIC_DEFAULT_FUNNEL_SLUG` | *(tùy chọn)* slug funnel cho trang `/` |

> Bắt buộc: trước hết vào service `api` và `web` → tab **Settings → Networking → Generate Domain** để mỗi service có public domain (thì `RAILWAY_PUBLIC_DOMAIN` mới có giá trị).

---

## 6. Nối web ↔ api ↔ DB
- `${{Postgres.DATABASE_URL}}` → api tự nối DB.
- `${{api.RAILWAY_PUBLIC_DOMAIN}}` / `${{web.RAILWAY_PUBLIC_DOMAIN}}` → Railway tự thay bằng domain thật khi deploy (đặt biến dạng tham chiếu, không gõ domain tay).
- (Nâng cao) Muốn web gọi api qua **mạng nội bộ** (nhanh hơn, không ra internet): đặt `API_INTERNAL_URL = http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8000` và sửa start command api thành `--port 8000`. Để đơn giản thì dùng public như bảng trên.

Sau khi đủ biến → **Deploy** lại cả 2 service.

---

## 6b. Media với Cloudflare R2 (miễn phí) — tùy chọn
Railway không có object storage/CDN. Dùng **Cloudflare R2** (S3-compatible, free 10GB, không phí egress) — code chạy nguyên, chỉ điền env vào service `api`:
1. Cloudflare dashboard → **R2 → Create bucket** (vd `coachio-media`).
2. Bucket → **Settings → Public access → Allow** → copy **Public URL** dạng `https://pub-<hash>.r2.dev` (hoặc gắn custom domain).
3. **R2 → Manage API Tokens → Create** (Object Read & Write) → lấy `Access Key ID` + `Secret Access Key` + `Account ID`.
4. Điền vào Variables của service `api`:

| Biến | Giá trị |
|---|---|
| `STORAGE_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `STORAGE_BUCKET` | tên bucket (vd `coachio-media`) |
| `STORAGE_ACCESS_KEY` | R2 Access Key ID |
| `STORAGE_SECRET_KEY` | R2 Secret Access Key |
| `STORAGE_REGION` | `auto` |
| `STORAGE_PUBLIC_URL` | `https://pub-<hash>.r2.dev` *(URL public ở bước 2 — dùng để nhúng ảnh vào landing)* |

> Upload đi qua S3 API của R2 (`STORAGE_*`); ảnh hiển thị công khai dùng `STORAGE_PUBLIC_URL`. Không set → media tắt, app vẫn chạy.

---

## 7. Migration + tạo admin
- **Migration**: đã tự chạy qua **Pre-Deploy Command** (`alembic upgrade head`) mỗi lần deploy api. Khỏi làm tay.
- **Tạo admin** (1 lần): mở service `api` → tab **`Console`** (terminal trong container; service phải đã deploy xanh), chạy:
  ```bash
  python -m app.scripts.create_admin --email ban@email.com --password 'matkhau-manh'
  ```
  *(chạy trong môi trường api nên đã có `DATABASE_URL` + `SECRET_KEY`).*

---

## 8. Background jobs
**Không cần cấu hình gì thêm** — vì api là server chạy liên tục, các job chạy **trong process** qua lifespan của FastAPI:
- Gửi **broadcast** email (interval `BROADCAST_JOB_INTERVAL_SECONDS`).
- Gửi **gift** (interval `GIFT_JOB_INTERVAL_SECONDS`).
- **Hết hạn đơn** PENDING (interval `FUNNEL_ORDER_EXPIRY_JOB_INTERVAL_SECONDS`).

> Đây là khác biệt lớn so với Vercel: trên Railway job chạy **realtime**, không bị giới hạn cron 1×/ngày. (Muốn tách riêng thành service `worker` thì tạo thêm 1 service cùng repo với start command riêng — nhưng với demo/khối lượng nhỏ, để in-process là đủ.)

---

## 9. Chạy thử
1. Mở domain web (`https://web-...up.railway.app`) → `/admin` đăng nhập (admin ở bước 7).
2. Tạo **Product** (digital) → tạo **Funnel** → **Publish**.
3. Mở landing public `/funnels/<slug>` → kiểm tra 200.
4. Thử thu lead + checkout (có `SEPAY_*` thì ra QR).
5. Kiểm tra `https://api-...up.railway.app/api/v1/health` → `{"status":"ok"}`.

---

## 10. Xử lý lỗi
- **api deploy đỏ ở Pre-Deploy** → migration lỗi: kiểm tra `DATABASE_URL` đã trỏ `${{Postgres.DATABASE_URL}}` chưa; xem log.
- **web 502 / không gọi được api** → kiểm tra `NEXT_PUBLIC_BACKEND_URL` (web) + `ALLOWED_ORIGINS` (api) đã trỏ đúng domain chưa; cả 2 service đã **Generate Domain** chưa.
- **`RAILWAY_PUBLIC_DOMAIN` rỗng** → vào Settings → Networking → **Generate Domain** cho service đó.
- **Build web lỗi pnpm workspace** → đảm bảo Root Directory = `/` (build context có `packages/`).
- **Ảnh không upload được** → chưa set `STORAGE_*` (media là tùy chọn; điền key nếu cần media).
- **Đăng nhập admin lỗi** → đã tạo admin (bước 7) + `SECRET_KEY` đã set chưa.

---

Vướng bước nào gửi log Railway để được hỗ trợ. 🚂
