"""Date utility functions for date window resolution."""

from datetime import datetime, timedelta, date
from typing import Optional, Tuple


class DateWindowError(ValueError):
    """Raised when there's an error resolving a date window."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)


def resolve_date_window(
    days: int,
    start_date: Optional[date],
    end_date: Optional[date]
) -> Tuple[datetime, datetime]:
    """Resolve the date window. If start/end provided, they take precedence over days.

    Args:
        days: Number of days to look back when no explicit dates provided
        start_date: Optional start date (inclusive)
        end_date: Optional end date (inclusive)

    Returns:
        Tuple of (start_datetime, end_datetime) where:
        - start_datetime is midnight at the start of start_date
        - end_datetime is midnight at the start of the day after end_date

    Raises:
        DateWindowError: If start_date is after end_date

    Examples:
        >>> resolve_date_window(30, None, None)  # Last 30 days
        >>> resolve_date_window(30, date(2024, 1, 1), date(2024, 1, 31))  # Explicit range
        >>> resolve_date_window(30, date(2024, 1, 1), None)  # From start to today
        >>> resolve_date_window(30, None, date(2024, 1, 31))  # Ending on specific date
    """
    today = datetime.utcnow().date()

    if start_date and end_date:
        if start_date > end_date:
            raise DateWindowError("start_date must be before or equal to end_date")
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
        return start_dt, end_dt

    if start_date and not end_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(today + timedelta(days=1), datetime.min.time())
        return start_dt, end_dt

    if end_date and not start_date:
        start_dt = datetime.combine(end_date - timedelta(days=days), datetime.min.time())
        end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
        return start_dt, end_dt

    # Fallback to days window ending today
    end_dt = datetime.combine(today + timedelta(days=1), datetime.min.time())
    start_dt = end_dt - timedelta(days=days + 1)
    return start_dt, end_dt
