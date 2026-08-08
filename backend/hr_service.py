"""HR helpers — leave day counting (with sandwich rule), balance initialization,
probation checks, and handover generation."""
from datetime import date, datetime, timezone, timedelta
from typing import List, Dict, Any


def _parse(d: str) -> date:
    return datetime.strptime(d, "%Y-%m-%d").date()


def probation_end(joining_date: str) -> str:
    """3-month probation. Returns YYYY-MM-DD when the person becomes eligible for leaves."""
    j = _parse(joining_date)
    # +90 days (simple, avoids month-length math edge cases)
    return (j + timedelta(days=90)).isoformat()


def is_past_probation(joining_date: str) -> bool:
    if not joining_date:
        return False
    try:
        return date.today() >= _parse(probation_end(joining_date))
    except Exception:
        return False


def default_balances() -> Dict[str, float]:
    """Annual entitlement once probation is done."""
    return {"PL": 7.0, "CL": 7.0, "SL": 7.0, "PH": 12.0, "CO": 0.0}


def count_leave_days(from_date: str, to_date: str, holidays: List[str], sandwich: bool = True) -> float:
    """Count leave days between from_date and to_date inclusive.
    Sandwich rule: if a weekend/holiday is FLANKED by leave on both sides (Fri+Mon or similar),
    those in-between weekend/holiday days ALSO count. This applies to all leave types per Yusuf.
    Public holidays are excluded normally; sandwich rule reintroduces them if flanked.
    """
    f = _parse(from_date)
    t = _parse(to_date)
    if t < f:
        return 0.0
    holiday_set = set(holidays or [])
    total_days = (t - f).days + 1

    if not sandwich:
        # Count all working days (Mon–Fri, non-holiday)
        count = 0
        for i in range(total_days):
            d = f + timedelta(days=i)
            if d.weekday() >= 5:  # Sat/Sun
                continue
            if d.isoformat() in holiday_set:
                continue
            count += 1
        return float(count)

    # Sandwich rule: every day between f and t counts, EXCEPT if a weekend/holiday
    # sits at the very edge (leading or trailing) — those are not counted.
    # Iterate and count; then trim leading/trailing non-working days.
    days = []
    for i in range(total_days):
        d = f + timedelta(days=i)
        is_working = d.weekday() < 5 and d.isoformat() not in holiday_set
        days.append((d, is_working))
    # trim leading non-working
    while days and not days[0][1]:
        days.pop(0)
    # trim trailing non-working
    while days and not days[-1][1]:
        days.pop()
    return float(len(days))


def working_days_gap(apply_date: str, from_date: str) -> int:
    """How many calendar days between apply_date and leave from_date (integer)."""
    try:
        return (_parse(from_date) - _parse(apply_date)).days
    except Exception:
        return 0


def year_key(d: str | None = None) -> int:
    if d:
        return _parse(d).year
    return date.today().year
