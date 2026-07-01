import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.middleware.cdn_url_rewrite import CDNUrlRewriteMiddleware
from app.jobs.expire_pending_funnel_orders import start_expiry_job
from app.jobs.broadcast_dispatch_job import start_broadcast_job


class RailsStyleFormatter(logging.Formatter):
    """Ruby on Rails-style log format: I, [2024-01-15T10:30:00.123456 #12345]  INFO -- : message"""

    LEVEL_LETTERS = {
        logging.DEBUG: "D",
        logging.INFO: "I",
        logging.WARNING: "W",
        logging.ERROR: "E",
        logging.CRITICAL: "F",
    }

    def format(self, record: logging.LogRecord) -> str:
        level_letter = self.LEVEL_LETTERS.get(record.levelno, "?")
        timestamp = datetime.utcfromtimestamp(record.created).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]
        pid = os.getpid()
        return f"{level_letter}, [{timestamp} #{pid}]  {record.levelname:5} -- : {record.getMessage()}"


# Configure application logging - Rails-style format
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(RailsStyleFormatter())
logging.basicConfig(
    level=logging.DEBUG,
    handlers=[_handler],
    force=True,
)

for _noisy_logger_name in ("boto3", "botocore", "s3transfer", "urllib3"):
    logging.getLogger(_noisy_logger_name).setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def _app_resources():
    """Initialize cache backend, then start background jobs."""
    # Eager init so the selected backend is logged once at boot time.
    from app.core.cache import get_backend
    _active_backend = get_backend()
    logger.info("Cache backend: in-memory (%s)", type(_active_backend).__name__)

    expiry_task = asyncio.create_task(start_expiry_job())
    broadcast_task = asyncio.create_task(start_broadcast_job())
    try:
        yield
    finally:
        for task in (expiry_task, broadcast_task):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with _app_resources():
        yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    debug=settings.DEBUG,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rewrite legacy Bunny CDN host(s) -> custom CNAME host in JSON responses.
# No-op unless both CDN_LEGACY_HOSTS and CDN_CANONICAL_HOST are configured.
_cdn_rewrite_pairs = settings.cdn_rewrite_pairs
if _cdn_rewrite_pairs:
    app.add_middleware(CDNUrlRewriteMiddleware, rewrite_pairs=_cdn_rewrite_pairs)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {
        "message": "Coachio Landing Page API",
        "docs": f"{settings.API_V1_PREFIX}/docs",
        "version": "1.0.0",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
