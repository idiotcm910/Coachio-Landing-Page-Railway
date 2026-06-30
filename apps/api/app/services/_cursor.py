"""Keyset pagination cursor encode/decode utilities."""
import base64
from datetime import datetime


def encode(ts: datetime | None, record_id: str) -> str:
    """Encode a (timestamp, id) pair into a URL-safe base64 cursor string."""
    ts_str = ts.isoformat() if ts else ""
    raw = f"{ts_str}|{record_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode(cursor: str) -> tuple[str, str]:
    """Decode a cursor string into (ts_str, id). Raises ValueError on bad input."""
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
    except Exception as exc:
        raise ValueError("invalid cursor encoding") from exc
    parts = raw.split("|", 1)
    if len(parts) != 2:
        raise ValueError("invalid cursor format")
    return parts[0], parts[1]
