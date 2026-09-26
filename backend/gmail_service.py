"""Gmail API integration — pulls real messages using a pre-generated refresh token.

The user completes OAuth once via Google OAuth Playground and pastes the resulting
GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN into the backend .env.
This module then silently refreshes access tokens as needed and reads their inbox.
"""
import os
import base64
import logging
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger("openspace.gmail")

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
]

TOKEN_URI = "https://oauth2.googleapis.com/token"


def _env(name: str) -> Optional[str]:
    v = os.environ.get(name)
    return v.strip() if v else None


def is_configured() -> bool:
    return all([_env("GMAIL_CLIENT_ID"), _env("GMAIL_CLIENT_SECRET"), _env("GMAIL_REFRESH_TOKEN")])


def _build_creds() -> Credentials:
    creds = Credentials(
        token=None,
        refresh_token=_env("GMAIL_REFRESH_TOKEN"),
        token_uri=TOKEN_URI,
        client_id=_env("GMAIL_CLIENT_ID"),
        client_secret=_env("GMAIL_CLIENT_SECRET"),
        scopes=SCOPES,
    )
    # Force refresh to obtain a live access token.
    creds.refresh(GoogleRequest())
    return creds


def _service():
    creds = _build_creds()
    # cache_discovery=False avoids a noisy oauth2client warning under py3.11
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def _decode_b64(data: str) -> str:
    try:
        return base64.urlsafe_b64decode(data.encode("utf-8")).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _extract_body(payload: dict) -> str:
    """Walk MIME parts, prefer text/plain, fall back to stripped text/html."""
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
    """Turn 'Gaurav Sethi <gaurav@intercont.com>' into ('Gaurav Sethi','gaurav@intercont.com')."""
    m = re.match(r"^\s*(.*?)\s*<([^>]+)>\s*$", from_header)
    if m:
        return m.group(1).strip('"').strip(), m.group(2).strip().lower()
    # No display name — just an email.
    return from_header.split("@")[0].strip(), from_header.strip().lower()


def _header(headers: list[dict], name: str) -> str:
    n = name.lower()
    for h in headers or []:
        if (h.get("name") or "").lower() == n:
            return h.get("value") or ""
    return ""


def fetch_recent_messages(max_results: int = 25, query: str = "in:inbox -category:promotions -category:social") -> list[dict]:
    """Return a list of normalised email dicts. Never raises to the caller.

    Each dict shape:
      messageId, from, senderName, subject, body, preview, time (ISO), read
    """
    if not is_configured():
        return []

    try:
        svc = _service()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Gmail auth failed: {e}")
        return []

    try:
        listing = svc.users().messages().list(userId="me", maxResults=max_results, q=query).execute()
    except HttpError as e:
        logger.warning(f"Gmail list failed: {e}")
        return []

    ids = [m["id"] for m in listing.get("messages", [])]
    out: list[dict] = []
    for mid in ids:
        try:
            msg = svc.users().messages().get(userId="me", id=mid, format="full").execute()
        except HttpError as e:
            logger.warning(f"Gmail get({mid}) failed: {e}")
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

        body_text = _extract_body(payload) or msg.get("snippet", "")
        body_text = body_text.strip()
        preview = (msg.get("snippet") or body_text[:180]).strip()
        labels = msg.get("labelIds", []) or []
        unread = "UNREAD" in labels

        out.append({
            "messageId": mid,
            "threadId": msg.get("threadId"),
            "from": sender_email,
            "senderName": sender_name or sender_email,
            "subject": subject,
            "body": body_text,
            "preview": preview[:220],
            "time": dt.isoformat(),
            "read": not unread,
        })
    return out


def mark_as_read(message_id: str) -> bool:
    if not is_configured():
        return False
    try:
        svc = _service()
        svc.users().messages().modify(userId="me", id=message_id, body={"removeLabelIds": ["UNREAD"]}).execute()
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Gmail mark-read failed: {e}")
        return False


def match_client(sender_email: str, clients: list[dict]) -> Optional[str]:
    """Best-effort match from a sender email to a client id, using exact email or domain."""
    if not sender_email:
        return None
    sender_email = sender_email.lower()
    domain = sender_email.split("@", 1)[1] if "@" in sender_email else ""
    for c in clients:
        cem = (c.get("email") or "").lower()
        if not cem:
            continue
        if cem == sender_email:
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
