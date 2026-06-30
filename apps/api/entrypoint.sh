#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations (alembic upgrade head)..."
alembic upgrade head

echo "[entrypoint] Starting API server on :${PORT:-8000} ..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
