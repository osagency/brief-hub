"""Gmail integration via Google Workspace Domain-Wide Delegation.

The Workspace super-admin creates a service account with domain-wide delegation
authority and grants it `gmail.readonly` + `gmail.modify` scopes. This backend
then impersonates ANY @osagency.in user by email — no per-user OAuth consent.

Credentials: a single JSON key file (set via GMAIL_SA_FILE env var) OR raw
JSON string (set via GMAIL_SA_JSON env var).
"""
import os
import json
import base64
import logging
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger("openspace.gmail")

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
]

WORKSPACE_DOMAIN = "osagency.in"


def _load_sa_info() -> Optional[dict]:
    """Load service account credentials from GMAIL_SA_FILE or GMAIL_SA_JSON env."""
    path = (os.environ.get("GMAIL_SA_FILE") or "").strip()
    if path and os.path.exists(path):
        try:
            with open(path) as f:
                return json.load(f)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Failed to read GMAIL_SA_FILE: {e}")
    raw = (os.environ.get("GMAIL_SA_JSON") or "").strip()
    if raw:
        try:
            # Accept either plain JSON or base64-encoded JSON.
            if raw.startswith("{"):
                return json.loads(raw)
            return json.loads(base64.b64decode(raw).decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Failed to parse GMAIL_SA_JSON: {e}")
    return None


def is_configured() -> bool:
    return _load_sa_info() is not None


def can_sync_for(user_email: str) -> bool:
    """A user can sync only if SA is configured AND they're on the Workspace domain."""
    if not user_email or "@" not in user_email:
        return False
    domain = user_email.split("@", 1)[1].lower()
    return domain == WORKSPACE_DOMAIN and is_configured()


def _service(user_email: str):
    info = _load_sa_info()
    if not info:
        raise RuntimeError("Service account not configured.")
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    delegated = creds.with_subject(user_email)
    return build("gmail", "v1", credentials=delegated, cache_discovery=False)


def _decode_b64(data: str) -> str:
    try:
        return base64.urlsafe_b64decode(data.encode("utf-8")).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _extract_body(payload: dict) -> str:
    if not payload:
        return ""
    mime = payload.get("mimeType", "")
    body = payload.get("body", {}) or {}
    data = body.get("data")
    parts = payload.get("parts") or []
    if mime == "text/plain" and data:
        return _decode_b64(data)
    for p in parts:
        text = _extract_body(p)
        if text and p.get("mimeType") == "text/plain":
            return text
    for p in parts:
        text = _extract_body(p)
        if text:
            return text
    if mime == "text/html" and data:
        html = _decode_b64(data)
        return re.sub(r"<[^>]+>", " ", html)
    return ""


def _extract_email(from_header: str) -> tuple[str, str]:
    m = re.match(r"^\s*(.*?)\s*<([^>]+)>\s*$", from_header)
    if m:
        return m.group(1).strip('"').strip(), m.group(2).strip().lower()
    return from_header.split("@")[0].strip(), from_header.strip().lower()


def _header(headers: list[dict], name: str) -> str:
    n = name.lower()
    for h in headers or []:
        if (h.get("name") or "").lower() == n:
            return h.get("value") or ""
    return ""


def fetch_recent_messages(user_email: str, max_results: int = 25, query: str = "in:inbox -category:promotions -category:social") -> list[dict]:
    """Fetch & normalise recent inbox messages for a Workspace user."""
    if not can_sync_for(user_email):
        return []
    try:
        svc = _service(user_email)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Gmail auth failed for {user_email}: {e}")
        return []
    try:
        listing = svc.users().messages().list(userId="me", maxResults=max_results, q=query).execute()
    except HttpError as e:
        logger.warning(f"Gmail list failed for {user_email}: {e}")
        return []
    ids = [m["id"] for m in listing.get("messages", [])]
    out: list[dict] = []
    for mid in ids:
        try:
            msg = svc.users().messages().get(userId="me", id=mid, format="full").execute()
        except HttpError as e:
            logger.warning(f"Gmail get({mid}) failed for {user_email}: {e}")
            continue
        payload = msg.get("payload", {}) or {}
        headers = payload.get("headers", []) or []
        from_h = _header(headers, "From")
        sender_name, sender_email = _extract_email(from_h)
        subject = _header(headers, "Subject") or "(no subject)"
        date_h = _header(headers, "Date")
        try:
            dt = parsedate_to_datetime(date_h) if date_h else None
            if dt and dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            dt = None
        if not dt:
            ts_ms = int(msg.get("internalDate", 0))
            dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc) if ts_ms else datetime.now(timezone.utc)
        body_text = (_extract_body(payload) or msg.get("snippet", "")).strip()
        preview = (msg.get("snippet") or body_text[:180]).strip()
        labels = msg.get("labelIds", []) or []
        out.append({
            "messageId": mid,
            "threadId": msg.get("threadId"),
            "from": sender_email,
            "senderName": sender_name or sender_email,
            "subject": subject,
            "body": body_text,
            "preview": preview[:220],
            "time": dt.isoformat(),
            "read": "UNREAD" not in labels,
        })
    return out


def mark_as_read(user_email: str, message_id: str) -> bool:
    if not can_sync_for(user_email):
        return False
    try:
        svc = _service(user_email)
        svc.users().messages().modify(userId="me", id=message_id, body={"removeLabelIds": ["UNREAD"]}).execute()
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Gmail mark-read failed for {user_email}: {e}")
        return False


def match_client(sender_email: str, clients: list[dict]) -> Optional[str]:
    if not sender_email:
        return None
    sender_email = sender_email.lower()
    domain = sender_email.split("@", 1)[1] if "@" in sender_email else ""
    for c in clients:
        cem = (c.get("email") or "").lower()
        if cem and cem == sender_email:
            return c.get("id")
    if domain:
        for c in clients:
            cem = (c.get("email") or "").lower()
            if not cem:
                continue
            cdom = cem.split("@", 1)[1] if "@" in cem else ""
            if cdom and cdom == domain:
                return c.get("id")
    return None
