#!/usr/bin/env bash
# ============================================================================
# Coachio Landing Page — Railway deploy wizard  (A: GitHub auto-deploy)
#
# Tự động: cài Railway CLI, login, tạo project, thêm Postgres, set toàn bộ env,
# generate domain, nhắc deploy. GUIDED (dashboard) cho bước tạo 2 service từ
# GitHub (Railway CLI chưa làm trọn phần này).
#
# Kết quả: web + api nối GitHub → mỗi lần git push là tự deploy lại.
# Chạy:  bash scripts/deploy-railway-a-github.sh
# ============================================================================
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
# shellcheck source=scripts/railway-common.sh
source "scripts/railway-common.sh"

printf '%s%s Coachio → Railway (A: GitHub auto-deploy)%s\n' "$C_BOLD" "$C_BLUE" "$C_RESET"

step "Kiểm tra công cụ"
ensure_prereqs
ensure_railway_cli

collect_common_config
ask GH_REPO "GitHub repo (owner/repo) đã push code Railway" ""

echo; info "Tóm tắt: project='${PROJECT_NAME}', repo='${GH_REPO:-<chưa nhập>}'"
confirm "Bắt đầu deploy theo cấu hình trên" || die "Đã hủy."

step "Đăng nhập Railway"
confirm "Chạy 'railway login' (mở trình duyệt để duyệt)" && railway login || die "Cần đăng nhập để tiếp tục."

step "Tạo project"
if confirm "Tạo project mới '${PROJECT_NAME}' (Không = dùng project đang link)"; then
  railway init --name "$PROJECT_NAME" || die "railway init thất bại."
else
  railway link || die "railway link thất bại."
fi
ok "Đã có project."

step "Thêm PostgreSQL (managed)"
confirm "Thêm plugin PostgreSQL vào project" && { railway add --database postgres || warn "Có thể Postgres đã tồn tại — bỏ qua."; }

step "Tạo 2 service từ GitHub  (phần DASHBOARD — CLI chưa làm trọn)"
cat <<EOF
${C_YELLOW}Mở dashboard project vừa tạo và làm thủ công 2 service (đặt TÊN đúng: 'api' và 'web'):${C_RESET}

  1) + Create → GitHub Repo → chọn '${GH_REPO:-repo của bạn}' → đặt tên service = ${C_BOLD}api${C_RESET}
     Settings:  Root Directory = /   |  Build = Dockerfile 'apps/api/Dockerfile'
     Deploy:    Start = 'uvicorn main:app --host 0.0.0.0 --port \$PORT'
                Pre-Deploy = 'alembic upgrade head'   |  Healthcheck = /api/v1/health
  2) + Create → GitHub Repo → cùng repo → đặt tên service = ${C_BOLD}web${C_RESET}
     Settings:  Root Directory = /   |  Build = Dockerfile 'apps/web/Dockerfile'
     Deploy:    Start = 'node apps/web/server.js'   |  Healthcheck = /api/health

(Repo đã có sẵn apps/api/railway.toml + apps/web/railway.toml ghi đúng các giá trị này.)
EOF
read -r -p "$(printf '%sTạo xong 2 service tên đúng ''api'' và ''web'' → nhấn Enter để tiếp...%s' "$C_YELLOW" "$C_RESET")" _

step "Set biến môi trường (tự động qua CLI)"
confirm "Set biến cho service 'api'" && set_api_vars api web
confirm "Set biến cho service 'web'" && set_web_vars web api

step "Tạo domain public"
confirm "Generate domain cho 'api' và 'web'" && {
  run "Domain cho 'api'" railway domain --service api
  run "Domain cho 'web'" railway domain --service web
}

step "Deploy"
info "Các service GitHub sẽ tự deploy khi có commit. Muốn ép deploy ngay:"
echo "    railway redeploy --service api   &&   railway redeploy --service web"
confirm "Ép redeploy ngay bây giờ" && {
  run "Redeploy 'api'" railway redeploy --service api
  run "Redeploy 'web'" railway redeploy --service web
}

print_admin_hint
echo; ok "Xong luồng A. Kiểm tra: <api-domain>/api/v1/health → 200, rồi vào <web-domain>/admin."
