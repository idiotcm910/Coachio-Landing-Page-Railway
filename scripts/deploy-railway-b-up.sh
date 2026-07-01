#!/usr/bin/env bash
# ============================================================================
# Coachio Landing Page — Railway deploy wizard  (B: railway up / full tự động)
#
# Không cần dashboard: script tạo project + Postgres + 2 service, deploy code
# LOCAL bằng 'railway up', set toàn bộ env, generate domain.
# Đổi lại: KHÔNG auto-deploy khi git push — cập nhật thì chạy lại script này
# (hoặc 'railway up --service <svc>' ở đúng thư mục).
#
# Chạy:  bash scripts/deploy-railway-b-up.sh
#
# LƯU Ý: phần 'railway up' cho monorepo (build đúng Dockerfile mỗi service) là
# best-effort — nếu Railway không tự nhận Dockerfile của service, xem gợi ý cuối
# mỗi bước (set Dockerfile path 1 lần trong Settings của service, rồi up lại).
# ============================================================================
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
ROOT="$PWD"
# shellcheck source=scripts/railway-common.sh
source "scripts/railway-common.sh"

printf '%s%s Coachio → Railway (B: railway up — full tự động)%s\n' "$C_BOLD" "$C_BLUE" "$C_RESET"

step "Kiểm tra công cụ"
ensure_prereqs
ensure_railway_cli

collect_common_config

echo; info "Tóm tắt: project='${PROJECT_NAME}' (deploy code local bằng railway up)"
confirm "Bắt đầu" || die "Đã hủy."

step "Đăng nhập Railway"
confirm "Chạy 'railway login' (mở trình duyệt)" && railway login || die "Cần đăng nhập."

step "Tạo project"
if confirm "Tạo project mới '${PROJECT_NAME}' (Không = dùng project đang link)"; then
  railway init --name "$PROJECT_NAME" || die "railway init thất bại."
else
  railway link || die "railway link thất bại."
fi
ok "Đã có project."

step "Thêm PostgreSQL (managed)"
confirm "Thêm plugin PostgreSQL" && { railway add --database postgres || warn "Có thể Postgres đã tồn tại — bỏ qua."; }

# ---- deploy 1 service từ 1 thư mục app -------------------------------------
# up_service <service_name> <app_dir> <dockerfile_rel_to_appdir>
up_service() {
  local svc="$1" dir="$2"
  step "Tạo + deploy service '$svc' (từ $dir/)"
  info "Chạy 'railway up' trong $dir/ (tạo service nếu chưa có)."
  if confirm "Deploy '$svc' bây giờ"; then
    ( cd "$ROOT/$dir" && railway up --service "$svc" ) \
      && ok "Đã bắt đầu deploy '$svc'." \
      || warn "railway up cho '$svc' lỗi. Fallback: mở Settings service '$svc' → Build → Dockerfile Path = '$dir/Dockerfile', Root Directory = '/', rồi chạy lại 'cd $dir && railway up --service $svc'."
  fi
}

up_service api apps/api
up_service web apps/web

step "Set biến môi trường"
confirm "Set biến cho service 'api'" && { set_api_vars api web && ok "Đã set biến api." || err "Set biến api lỗi."; }
confirm "Set biến cho service 'web'" && { set_web_vars web api && ok "Đã set biến web." || err "Set biến web lỗi."; }

step "Tạo domain public"
confirm "Generate domain cho 'api' và 'web'" && {
  railway domain --service api || warn "Không tạo được domain api."
  railway domain --service web || warn "Không tạo được domain web."
}

step "Redeploy để nạp biến mới"
confirm "Redeploy 'api' và 'web' (nạp env vừa set)" && { railway redeploy --service api; railway redeploy --service web; }

print_admin_hint
cat <<EOF

${C_BOLD}Cập nhật sau này (B không auto-deploy theo git):${C_RESET}
  cd apps/api && railway up --service api      # deploy lại backend
  cd apps/web && railway up --service web      # deploy lại frontend
EOF
echo; ok "Xong luồng B."
