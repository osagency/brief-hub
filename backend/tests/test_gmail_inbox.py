"""Iteration 10 — Per-user Gmail sync (Workspace DWD) tests."""
import os
import time
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def mgr_token():
    return _login("yusuf@osagency.in", "manager123")


@pytest.fixture(scope="module")
def rupali_token():
    return _login("rupali@osagency.in", "team123")


@pytest.fixture(scope="module")
def digital_token():
    return _login("digital@osagency.in", "team123")


# ---------- Auth / seed ----------
class TestAuth:
    def test_manager_login(self):
        d = requests.post(f"{API}/auth/login",
                          json={"email": "yusuf@osagency.in", "password": "manager123"}, timeout=20).json()
        assert d["user"]["is_admin"] is True
        assert d["user"]["email"] == "yusuf@osagency.in"


# ---------- Guards ----------
class TestGmailGuards:
    @pytest.mark.parametrize("path,method", [
        ("/inbox", "get"),
        ("/inbox/gmail-status", "get"),
        ("/inbox/sync", "post"),
        ("/inbox/clear-samples", "post"),
    ])
    def test_no_auth_401(self, path, method):
        fn = requests.get if method == "get" else requests.post
        r = fn(f"{API}{path}", timeout=20)
        assert r.status_code == 401


# ---------- Gmail status per user ----------
class TestGmailStatus:
    def test_status_shape_manager(self, mgr_token):
        d = requests.get(f"{API}/inbox/gmail-status", headers=hdr(mgr_token), timeout=20).json()
        assert d["configured"] is True
        assert d["domain_ok"] is True
        assert d["user_email"] == "yusuf@osagency.in"
        assert isinstance(d["synced_count"], int)

    def test_status_shape_team_member(self, rupali_token):
        d = requests.get(f"{API}/inbox/gmail-status", headers=hdr(rupali_token), timeout=20).json()
        assert d["configured"] is True
        assert d["domain_ok"] is True
        assert d["user_email"] == "rupali@osagency.in"


# ---------- Per-user sync ----------
class TestGmailSyncPerUser:
    def test_manager_sync_and_idempotent(self, mgr_token):
        r1 = requests.post(f"{API}/inbox/sync", headers=hdr(mgr_token), timeout=90)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["ok"] is True
        assert d1["total_fetched"] > 0

        time.sleep(1.0)
        r2 = requests.post(f"{API}/inbox/sync", headers=hdr(mgr_token), timeout=90)
        d2 = r2.json()
        assert d2["new_count"] == 0, f"non-idempotent: {d2}"
        assert d2["updated_count"] == d2["total_fetched"]

    def test_rupali_sync_isolated(self, rupali_token, mgr_token):
        r = requests.post(f"{API}/inbox/sync", headers=hdr(rupali_token), timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        # Rupali's inbox is scoped to her own
        inb = requests.get(f"{API}/inbox", headers=hdr(rupali_token), timeout=20).json()
        mgr_inb = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        # Scoping: every email returned to rupali is her own (no cross-leak check via messageId uniqueness per user)
        assert isinstance(inb, list)
        assert isinstance(mgr_inb, list)
        # Mock seed emails are owned by yusuf — rupali should NOT see them
        rupali_mock = [e for e in inb if e.get("source") != "gmail"]
        assert len(rupali_mock) == 0, f"rupali leaked mock emails: {rupali_mock}"


# ---------- Inbox listing scoping ----------
class TestInboxScoping:
    def test_manager_has_mocks_and_gmail(self, mgr_token):
        emails = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        assert isinstance(emails, list) and len(emails) > 0
        gmail = [e for e in emails if e.get("source") == "gmail"]
        assert len(gmail) > 0
        for g in gmail:
            assert g.get("messageId")

    def test_team_cannot_see_manager_mocks(self, digital_token):
        emails = requests.get(f"{API}/inbox", headers=hdr(digital_token), timeout=20).json()
        mocks = [e for e in emails if e.get("source") != "gmail"]
        assert len(mocks) == 0


# ---------- Mark as read per-user ----------
class TestMarkAsRead:
    def test_mark_gmail_read_manager(self, mgr_token):
        # Use a gmail-sourced email (always available after sync, survives clear-samples)
        requests.post(f"{API}/inbox/sync", headers=hdr(mgr_token), timeout=90)
        emails = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        gmail = [e for e in emails if e.get("source") == "gmail"]
        assert gmail, "no gmail emails to test mark-read"
        gid = gmail[0]["id"]
        r = requests.post(f"{API}/inbox/{gid}/read", headers=hdr(mgr_token), timeout=30)
        assert r.status_code == 200
        emails2 = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        tgt = next(e for e in emails2 if e["id"] == gid)
        assert tgt["read"] is True

    def test_mark_mock_read_other_user_404(self, rupali_token):
        # Rupali does not own e-1 (owned by yusuf) — should 404
        r = requests.post(f"{API}/inbox/e-1/read", headers=hdr(rupali_token), timeout=20)
        assert r.status_code == 404


# ---------- Parse brief ----------
class TestParseBrief:
    def test_parse_brief_mock_ok(self, mgr_token):
        emails = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        if not any(e["id"] == "e-1" for e in emails):
            pytest.skip("mock e-1 cleared by prior test run; parse-brief validated separately")
        r = requests.post(f"{API}/inbox/parse-brief", headers=hdr(mgr_token),
                          json={"emailId": "e-1"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "briefSummary" in d and "internalDelegation" in d

    def test_parse_brief_wrong_owner_404(self, rupali_token):
        r = requests.post(f"{API}/inbox/parse-brief", headers=hdr(rupali_token),
                          json={"emailId": "e-1"}, timeout=20)
        assert r.status_code == 404


# ---------- Draft reply ----------
class TestDraftReply:
    def test_draft_reply_mock(self, mgr_token):
        emails = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        if not any(e["id"] == "e-1" for e in emails):
            pytest.skip("mock e-1 cleared by prior test run")
        r = requests.post(f"{API}/inbox/draft-reply", headers=hdr(mgr_token),
                          json={"emailId": "e-1"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        # Expect some kind of draft text
        assert isinstance(d, dict) and len(d) > 0


# ---------- Clear samples per-user ----------
class TestClearSamples:
    def test_clear_removes_only_own_mocks(self, mgr_token):
        requests.post(f"{API}/inbox/sync", headers=hdr(mgr_token), timeout=90)
        before = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        mocks_before = [e for e in before if e.get("source") != "gmail"]
        r = requests.post(f"{API}/inbox/clear-samples", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        if mocks_before:
            assert d["removed"] > 0
        after = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        for e in after:
            assert e.get("source") == "gmail"
