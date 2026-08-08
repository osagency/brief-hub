"""Leads pipeline helpers — ICP scoring, dedup keys, capacity cap checks, funnel math."""
import re
from datetime import datetime, timezone, timedelta, date
from typing import Any


LEAD_STATUSES = [
    "new", "contacted", "qualified", "nurturing", "call_scheduled",
    "proposal_sent", "won", "lost", "onboarding",
]

LOST_REASONS = ["price", "timing", "no_fit", "silent", "competitor", "other"]

SOURCES = ["outbound", "inbound", "manual"]

CHANNELS = ["LinkedIn", "Apollo", "Google Maps", "SEO", "Referral", "Website form", "Event", "Other"]

ICP_FLAG_KEYS = [
    "family_run",       # Family-run business
    "startup",          # Startup
    "other_b2b",        # Other B2B
    "gap_or_funding",   # visible marketing gap OR recent funding/expansion news
    "responsive_48h",   # responsive within 48 hours (behavioral — flipped after actual response)
]


def normalize_company(name: str) -> str:
    if not name:
        return ""
    n = name.lower().strip()
    # Strip legal suffixes and punctuation for fuzzy dedup
    for suffix in [" pvt ltd", " private limited", " pvt. ltd.", " pvt", " ltd", " limited", " llp", " inc", " inc.", " co.", " co", " corp", " corporation", " llc"]:
        if n.endswith(suffix):
            n = n[: -len(suffix)]
    n = re.sub(r"[^a-z0-9]+", "", n)
    return n


def email_domain(email: str) -> str:
    if not email or "@" not in email:
        return ""
    return email.split("@", 1)[1].lower().strip()


def compute_icp_score(flags: dict) -> tuple[int, str]:
    """Score = count of True flags among the 5. Qualified if >= 2 of 3 signals
    (fit_flag AND gap_or_funding AND responsive_48h)."""
    fit_true = any(bool(flags.get(k)) for k in ("family_run", "startup", "other_b2b"))
    signals = [fit_true, bool(flags.get("gap_or_funding")), bool(flags.get("responsive_48h"))]
    n_signals = sum(1 for s in signals if s)
    # Numeric score = total truthy flags (for sorting/display)
    numeric = sum(1 for k in ICP_FLAG_KEYS if flags.get(k))
    qualified = n_signals >= 2
    tier = "qualified" if qualified else "monitor"
    return numeric, tier


def default_lead_flags() -> dict:
    return {k: False for k in ICP_FLAG_KEYS}


def next_status_on_first_touch(status: str) -> str:
    """After first outbound touch, move new → contacted."""
    return "contacted" if status == "new" else status


def outbound_sequence_offsets() -> list[dict]:
    """4-touch outbound over 12 days."""
    return [
        {"step": 1, "day_offset": 0,  "purpose": "intro"},
        {"step": 2, "day_offset": 4,  "purpose": "value_add"},
        {"step": 3, "day_offset": 8,  "purpose": "soft_ask"},
        {"step": 4, "day_offset": 12, "purpose": "break_up"},
    ]


def inbound_sequence_offsets() -> list[dict]:
    """3-touch inbound: acknowledgment (same-day) → qualifier (D+1) → booking (D+2)."""
    return [
        {"step": 1, "day_offset": 0, "purpose": "acknowledge"},
        {"step": 2, "day_offset": 1, "purpose": "qualifier"},
        {"step": 3, "day_offset": 2, "purpose": "booking_link"},
    ]


def month_key(iso: str | None = None) -> str:
    if iso:
        return iso[:7]
    return datetime.now(timezone.utc).strftime("%Y-%m")


def stale_threshold_days() -> int:
    return 14


def is_stale(last_activity_at: str, status: str) -> bool:
    if status not in ("contacted", "qualified", "nurturing"):
        return False
    try:
        last = datetime.fromisoformat(last_activity_at.replace("Z", "+00:00"))
    except Exception:
        return False
    return (datetime.now(timezone.utc) - last).days >= stale_threshold_days()
