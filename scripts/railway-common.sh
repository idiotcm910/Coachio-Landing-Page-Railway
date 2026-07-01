#!/usr/bin/env bash
# Shared helpers for the Railway deploy wizards (deploy-railway-a.sh / -b.sh).
# Sourced, not executed directly. Bash 4+ recommended.
#
# Provides: colored logging, [y/N] confirm, prompt helpers, a spinner,
# Railway-CLI auto-install, config collection, and env-var setters.

# ---- colors (respect NO_COLOR + non-tty) -----------------------------------
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'; C_DIM=$'\033[2m'; C_BOLD=$'\033[1m'
  C_BLUE=$'\033[34m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_CYAN=$'\033[36m'
else
  C_RESET=""; C_DIM=""; C_BOLD=""; C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_CYAN=""
fi

STEP_N=0
step()  { STEP_N=$((STEP_N+1)); printf '\n%s━━ Bước %s: %s%s\n' "$C_BOLD$C_BLUE" "$STEP_N" "$*" "$C_RESET"; }
info()  { printf '%s•%s %s\n' "$C_CYAN" "$C_RESET" "$*"; }
ok()    { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
err()   { printf '%s✗ %s%s\n' "$C_RED" "$*" "$C_RESET" >&2; }
die()   { err "$*"; exit 1; }

# confirm "message"  -> returns 0 if user answers y/Y (default No)
confirm() {
  local ans
  read -r -p "$(printf '%s? %s [y/N] ' "$C_YELLOW" "$*$C_RESET")" ans
  [[ "$ans" == [yY] || "$ans" == [yY][eE][sS] ]]
}

# ask VAR "prompt" ["default"]  -> reads into VAR (empty allowed)
ask() {
  local __var="$1" __prompt="$2" __def="${3:-}" __in
  if [[ -n "$__def" ]]; then
    read -r -p "$(printf '  %s [%s]: ' "$__prompt" "$__def")" __in
    __in="${__in:-$__def}"
  else
    read -r -p "$(printf '  %s: ' "$__prompt")" __in
  fi
  printf -v "$__var" '%s' "$__in"
}

# ask_secret VAR "prompt"  -> reads hidden into VAR
ask_secret() {
  local __var="$1" __prompt="$2" __in
  read -r -s -p "$(printf '  %s: ' "$__prompt")" __in; echo
  printf -v "$__var" '%s' "$__in"
}

# spinner runs a command in background while showing a spinner.
# usage: run_spin "Label..." cmd arg1 arg2 ...
run_spin() {
  local label="$1"; shift
  local logf; logf="$(mktemp)"
  ( "$@" ) >"$logf" 2>&1 &
  local pid=$! frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏' i=0
  if [[ -t 1 ]]; then
    while kill -0 "$pid" 2>/dev/null; do
      i=$(( (i+1) % ${#frames} ))
      printf '\r%s%s%s %s' "$C_CYAN" "${frames:$i:1}" "$C_RESET" "$label"
      sleep 0.1
    done
  else
    printf '%s...\n' "$label"; wait "$pid"
  fi
  wait "$pid"; local rc=$?
  if [[ $rc -eq 0 ]]; then printf '\r%s✓%s %s        \n' "$C_GREEN" "$C_RESET" "$label"
  else printf '\r%s✗%s %s        \n' "$C_RED" "$C_RESET" "$label"; sed 's/^/    /' "$logf" | tail -20; fi
  rm -f "$logf"; return $rc
}

# run "Label" cmd args...  — chạy lệnh, STREAM output ra màn hình; nếu lỗi thì
# hiện banner đỏ (label + exit code + lệnh) rồi HỎI bỏ qua/dừng. Dùng cho mọi
# lệnh CLI để lỗi luôn hiển thị thay vì bị nuốt.
run() {
  local label="$1"; shift
  printf '%s  $ %s%s\n' "$C_DIM" "$*" "$C_RESET"
  "$@"; local rc=$?
  if [[ $rc -eq 0 ]]; then ok "$label"; return 0; fi
  echo
  err "LỖI (exit $rc): $label"
  printf '%s    Lệnh: %s%s\n' "$C_DIM" "$*" "$C_RESET"
  echo
  if confirm "Bỏ qua lỗi này và tiếp tục"; then
    warn "Đã bỏ qua — bước sau có thể lỗi theo."; return "$rc"
  fi
  die "Dừng vì lỗi ở: $label. Sửa xong chạy lại script."
}

# ensure_railway_cli: install @railway/cli if missing (with progress)
ensure_railway_cli() {
  if command -v railway >/dev/null 2>&1; then
    ok "Railway CLI: $(railway --version 2>/dev/null | head -1)"
    return 0
  fi
  warn "Chưa có Railway CLI."
  if command -v npm >/dev/null 2>&1; then
    confirm "Cài Railway CLI bằng npm (npm i -g @railway/cli)" \
      && run_spin "Đang cài @railway/cli qua npm" npm install -g @railway/cli
  elif command -v brew >/dev/null 2>&1; then
    confirm "Cài Railway CLI bằng Homebrew (brew install railway)" \
      && run_spin "Đang cài railway qua brew" brew install railway
  else
    confirm "Cài Railway CLI bằng script chính thức (curl | sh)" \
      && run_spin "Đang cài railway (installer chính thức)" bash -c 'curl -fsSL https://railway.com/install.sh | sh'
  fi
  hash -r 2>/dev/null || true
  command -v railway >/dev/null 2>&1 \
    && { ok "Đã cài Railway CLI: $(railway --version 2>/dev/null | head -1)"; return 0; }
  die "Cài Railway CLI thất bại. Cài thủ công: npm i -g @railway/cli  (hoặc xem https://docs.railway.com/guides/cli) rồi chạy lại."
}

ensure_prereqs() {
  command -v git >/dev/null 2>&1 || die "Thiếu 'git'."
  command -v curl >/dev/null 2>&1 || warn "Thiếu 'curl' (có thể cần cho installer)."
}

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 32
  else head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

# ---- config collection (shared) --------------------------------------------
# Sets globals: PROJECT_NAME, SECRET_KEY, STORAGE_*, RESEND_*, SEPAY_*, META_*
collect_common_config() {
  step "Nhập cấu hình (Enter để bỏ qua = tắt tính năng đó)"
  ask PROJECT_NAME "Tên project Railway" "coachio-landing-page"
  SECRET_KEY="$(gen_secret)"; ok "Đã tự sinh SECRET_KEY."

  echo; info "${C_BOLD}Cloudflare R2 (media)${C_RESET} — lấy ở dash.cloudflare.com → R2 → Manage R2 API Tokens."
  ask STORAGE_ENDPOINT   "STORAGE_ENDPOINT (https://<ACCOUNT_ID>.r2.cloudflarestorage.com)"
  ask STORAGE_BUCKET     "STORAGE_BUCKET (tên bucket)"
  ask STORAGE_ACCESS_KEY "STORAGE_ACCESS_KEY (R2 Access Key ID)"
  ask_secret STORAGE_SECRET_KEY "STORAGE_SECRET_KEY (R2 Secret Access Key)"
  ask STORAGE_REGION     "STORAGE_REGION" "auto"
  ask STORAGE_PUBLIC_URL "STORAGE_PUBLIC_URL (https://pub-<hash>.r2.dev)"

  echo; info "${C_BOLD}Resend (email)${C_RESET} — resend.com → API Keys."
  ask_secret RESEND_API_KEY "RESEND_API_KEY"
  ask RESEND_FROM_EMAIL "RESEND_FROM_EMAIL (địa chỉ gửi đã verify)"

  echo; info "${C_BOLD}SePay (thanh toán)${C_RESET}"
  ask SEPAY_BANK_NAME      "SEPAY_BANK_NAME (vd OCB, MBBank)"
  ask SEPAY_ACCOUNT_NUMBER "SEPAY_ACCOUNT_NUMBER"

  echo; info "${C_BOLD}Meta CAPI (tracking)${C_RESET}"
  ask META_DEFAULT_PIXEL_ID  "META_DEFAULT_PIXEL_ID"
  ask_secret META_DEFAULT_CAPI_TOKEN "META_DEFAULT_CAPI_TOKEN"
}

# add "--set K=V" to the RV array only when value is non-empty
_rv=()
_rv_add() { local k="$1" v="$2"; [[ -n "$v" ]] && _rv+=( --set "$k=$v" ); }

# set_api_vars <service_name> <web_service_name>
set_api_vars() {
  local svc="$1" web="$2"; _rv=()
  _rv_add DATABASE_URL '${{Postgres.DATABASE_URL}}'
  _rv_add SECRET_KEY "$SECRET_KEY"
  _rv_add ALLOWED_ORIGINS "https://\${{$web.RAILWAY_PUBLIC_DOMAIN}}"
  _rv_add FRONTEND_URL "https://\${{$web.RAILWAY_PUBLIC_DOMAIN}}"
  _rv_add STORAGE_ENDPOINT "$STORAGE_ENDPOINT"
  _rv_add STORAGE_BUCKET "$STORAGE_BUCKET"
  _rv_add STORAGE_ACCESS_KEY "$STORAGE_ACCESS_KEY"
  _rv_add STORAGE_SECRET_KEY "$STORAGE_SECRET_KEY"
  _rv_add STORAGE_REGION "$STORAGE_REGION"
  _rv_add STORAGE_PUBLIC_URL "$STORAGE_PUBLIC_URL"
  _rv_add RESEND_API_KEY "$RESEND_API_KEY"
  _rv_add RESEND_FROM_EMAIL "$RESEND_FROM_EMAIL"
  _rv_add SEPAY_BANK_NAME "$SEPAY_BANK_NAME"
  _rv_add SEPAY_ACCOUNT_NUMBER "$SEPAY_ACCOUNT_NUMBER"
  _rv_add META_DEFAULT_PIXEL_ID "$META_DEFAULT_PIXEL_ID"
  _rv_add META_DEFAULT_CAPI_TOKEN "$META_DEFAULT_CAPI_TOKEN"
  run "Set ${#_rv[@]} biến cho service '$svc'" railway variables --service "$svc" "${_rv[@]}"
}

# set_web_vars <web_service_name> <api_service_name>
set_web_vars() {
  local web="$1" api="$2"; _rv=()
  _rv_add NEXT_PUBLIC_BACKEND_URL "https://\${{$api.RAILWAY_PUBLIC_DOMAIN}}"
  _rv_add API_INTERNAL_URL "https://\${{$api.RAILWAY_PUBLIC_DOMAIN}}"
  local slug; ask slug "NEXT_PUBLIC_DEFAULT_FUNNEL_SLUG (slug funnel cho trang /, Enter bỏ qua)"
  _rv_add NEXT_PUBLIC_DEFAULT_FUNNEL_SLUG "$slug"
  run "Set ${#_rv[@]} biến cho service '$web'" railway variables --service "$web" "${_rv[@]}"
}

print_admin_hint() {
  cat <<EOF

${C_BOLD}Tạo admin (1 lần)${C_RESET} — sau khi api đã deploy + migration chạy:
  railway run --service api python -m app.scripts.create_admin --email ban@email.com --password 'matkhau-manh'
  (hoặc dùng Shell của service api trên dashboard)
EOF
}
