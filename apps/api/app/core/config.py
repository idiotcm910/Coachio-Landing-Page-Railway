from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Admin Configuration
    ADMIN_EMAIL: str = "admin@coachio.ai"

    # API
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Coachio Landing Page API"
    DEBUG: bool = False

    # S3 Configuration
    S3_ENDPOINT: str = ""
    S3_BUCKET_NAME: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_REGION: str = ""
    BUNNY_CDN_URL: str = ""

    # CDN host rewrite — migrate legacy Bunny shared host(s) (e.g. coachio-prod.b-cdn.net,
    # which some VN ISPs DNS-sinkhole) to a custom CNAME host (e.g. cdn.coachio.ai).
    # Applied to outgoing JSON API responses, covering both plain URL columns and URLs
    # embedded inside JSONB content — without touching the database.
    # Comma-separated legacy hosts to rewrite FROM; empty = feature disabled.
    CDN_LEGACY_HOSTS: str = ""
    # Canonical CDN host to rewrite TO; empty = feature disabled.
    CDN_CANONICAL_HOST: str = ""

    @property
    def cdn_rewrite_pairs(self) -> List[tuple]:
        """List of (legacy_host, canonical_host) pairs for CDN URL rewriting."""
        to = self.CDN_CANONICAL_HOST.strip()
        if not to:
            return []
        seen, pairs = set(), []
        for raw in self.CDN_LEGACY_HOSTS.split(","):
            host = raw.strip()
            if host and host != to and host not in seen:
                seen.add(host)
                pairs.append((host, to))
        return pairs

    # CORS — stored as raw string to support comma-separated .env values
    # Use `allowed_origins_list` property to access as List[str]
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def allowed_origins_list(self) -> List[str]:
        v = self.ALLOWED_ORIGINS.strip()
        if v.startswith("["):
            import json
            return json.loads(v)
        return [s.strip() for s in v.split(",") if s.strip()]

    # Funnel landing page write-through cache
    LANDING_CACHE_ENABLED: bool = True
    LANDING_CACHE_TTL: int = 3600  # safety-net TTL (seconds); write-through keeps it fresh

    # SePay Payment
    SEPAY_BANK_NAME: str = ""
    SEPAY_ACCOUNT_NUMBER: str = ""
    # Callback Configuration
    PREFIX_URL_CALLBACK: str = ""

    # Bunny CDN
    BUNNY_STORAGE_ZONE: str = ""
    BUNNY_API_KEY: str = ""
    BUNNY_PULL_ZONE_URL: str = ""
    BUNNY_REGION: str = ""

    # Resend
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = ""

    # Meta Conversions API (CAPI) — tracking spec
    META_GRAPH_API_VERSION: str = "v21.0"
    META_PURCHASE_MIN_VND: int = 10000
    # Base URL for building event_source_url in CAPI events; set to the public funnel web host
    PUBLIC_WEB_BASE_URL: str = "https://coachio.ai"
    # IPInfo token for geo Advanced Matching. Empty string = geo disabled (skip silently).
    IPINFO_TOKEN: str = ""
    # Global default Meta tracking values. When both pixel id and CAPI token are set,
    # newly created funnels auto-provision tracking_config (enabled) from these defaults.
    # Empty = no auto-provisioning. Changing them requires a service restart.
    META_DEFAULT_PIXEL_ID: str = ""
    META_DEFAULT_CAPI_TOKEN: str = ""
    META_DEFAULT_TEST_EVENT_CODE: str = ""

    # Funnel pending-order expiry job
    FUNNEL_ORDER_EXPIRY_JOB_INTERVAL_SECONDS: int = 300  # Seconds between expiry job runs

    # Broadcast email campaign worker
    BROADCAST_BATCH_SIZE: int = 100           # jobs claimed+sent per tick (Resend batch cap)
    BROADCAST_RATE_DELAY_MS: int = 200        # throttle sleep between batches (milliseconds)
    BROADCAST_MAX_ATTEMPTS: int = 3           # per-job retry ceiling
    BROADCAST_STUCK_TIMEOUT_S: int = 300      # reaper: requeue 'sending' jobs older than this
    BROADCAST_JOB_INTERVAL_SECONDS: int = 5   # worker loop sleep between ticks

    # Gift campaign worker (mechanism 2) — mirrors BROADCAST_* tuning
    GIFT_BATCH_SIZE: int = 50                  # gift jobs claimed+processed per tick
    GIFT_RATE_DELAY_MS: int = 200             # throttle sleep between batches (milliseconds)
    GIFT_MAX_ATTEMPTS: int = 3                # per-job / per-email retry ceiling
    GIFT_STUCK_TIMEOUT_S: int = 300          # reaper: requeue 'sending' jobs older than this
    GIFT_JOB_INTERVAL_SECONDS: int = 5       # worker loop sleep between ticks

    # Frontend URL
    FRONTEND_URL: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
