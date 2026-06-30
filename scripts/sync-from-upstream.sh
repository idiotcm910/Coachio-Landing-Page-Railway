#!/usr/bin/env bash
# Sync code from the upstream "coachio-landing-page" repo into this Railway repo.
#
# This repo is a DOWNSTREAM Railway-deploy variant of coachio-landing-page.
# It re-uses 99% of the upstream code and only ADDS / MODIFIES a small set of
# Railway-specific files. This script pulls fresh upstream code but PRESERVES
# the Railway-only additions, then leaves you to review the diff (it does NOT
# auto-commit). Shared files that the Railway edition MODIFIES (see list below)
# may need manual re-application after a sync — review `git diff` carefully.
#
# Usage:  scripts/sync-from-upstream.sh [path-to-upstream]   (default: ../coachio-landing-page)
set -euo pipefail

UPSTREAM="${1:-../coachio-landing-page}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

[ -d "$UPSTREAM" ] || { echo "ERROR: upstream not found: $UPSTREAM" >&2; exit 1; }

# Railway-ONLY files (pure additions) — never overwrite from upstream:
RAILWAY_ONLY=(
  "railway.json"
  "apps/api/railway.toml"
  "apps/web/railway.toml"
  "apps/api/app/core/cache_backend.py"
  "apps/api/app/api/v1/endpoints/health.py"
  "apps/api/tests/test_cache_backend.py"
  "apps/web/app/api/health"
  "docs/railway-template.md"
  "scripts/sync-from-upstream.sh"
  "README.md"
)

EXCLUDES=( ".git" "node_modules" ".venv" "__pycache__" "*.pyc" "*.db" ".next" "dist" ".nx" ".turbo" )

args=( -a )
for e in "${EXCLUDES[@]}";    do args+=( --exclude="$e" ); done
for f in "${RAILWAY_ONLY[@]}"; do args+=( --exclude="$f" ); done

echo "Syncing from $UPSTREAM -> $HERE (Railway-only files preserved)..."
rsync "${args[@]}" "$UPSTREAM"/ "$HERE"/

cat <<'NOTE'

Sync done. NOW REVIEW:
  git status
  git diff

Shared files the Railway edition MODIFIES (re-check these after every sync — upstream
may have changed them and overwritten the Railway tweaks; re-apply if needed):
  - apps/api/app/core/cache.py            (in-process backend accessor; Railway-only, no Redis)
  - apps/api/app/core/landing_cache.py    (uses cache backend)
  - apps/api/app/core/rate_limit.py       (uses cache backend)
  - apps/api/app/services/funnel_analytics_service.py  (uses cache backend)
  - apps/api/app/api/v1/router.py         (mounts /health)
  - apps/api/main.py                       (init cache backend at startup)
  - apps/api/Dockerfile / apps/web/Dockerfile  ($PORT / HOSTNAME binding)
  - README.vi.md                           (if you keep the VI readme in sync)

Commit only after reviewing.
NOTE
