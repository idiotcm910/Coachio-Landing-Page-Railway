#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations (alembic upgrade head)..."
alembic upgrade head

echo "[entrypoint] Starting API server on :8000 ..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
