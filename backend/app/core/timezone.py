from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))


def now_ist():
    """Return naive datetime in IST for storage and backend math."""
    return datetime.now(IST).replace(tzinfo=None)
