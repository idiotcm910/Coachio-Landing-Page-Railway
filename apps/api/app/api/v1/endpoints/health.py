"""Health check endpoint — used by Railway healthcheck and monitoring.

GET /api/v1/health
- No authentication required.
- Performs a lightweight DB ping (SELECT 1) and returns status.
- Returns 200 {"status":"ok","db":"ok"} on success.
- Returns 503 {"status":"degraded","db":"down"} when DB is unreachable.
"""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.base import get_db

router = APIRouter()


@router.get("")
def health_check(db: Session = Depends(get_db)):
    """Lightweight liveness + DB readiness probe."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "db": "down"},
        )
