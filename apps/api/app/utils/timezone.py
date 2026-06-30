"""
Timezone conversion utilities shared across Zalo services + email rendering.
"""
from datetime import datetime, timezone, timedelta

VN_OFFSET = timedelta(hours=7)
VN_TZ = timezone(VN_OFFSET)


def vn_to_utc(dt: datetime) -> datetime:
    """Convert VN local time (UTC+7) to UTC.

    Accepts naive datetime (assumed VN local) or tz-aware datetime.
    Returns a UTC-aware datetime.
    """
    if dt.tzinfo is None:
        # Naive — assumed VN time
        return (dt - VN_OFFSET).replace(tzinfo=timezone.utc)
    # Already aware — just convert
    return dt.astimezone(timezone.utc)


def utc_to_vn(dt: datetime) -> datetime:
    """Convert a UTC datetime to VN local time (UTC+7).

    Accepts naive datetime (assumed UTC — DB timestamps are stored in UTC) or
    tz-aware datetime. Returns a VN-aware datetime.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(VN_TZ)


def format_vn(dt: datetime, fmt: str = "%d/%m/%Y %H:%M") -> str:
    """Format a UTC/aware datetime as a VN local-time string (giờ Việt Nam)."""
    return utc_to_vn(dt).strftime(fmt)
