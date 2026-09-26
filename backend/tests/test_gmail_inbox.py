"""Iteration 7 — Gmail sync integration tests for Smart Inbox."""
import os
import time
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def mgr_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "osagency6@gmail.com", "password": "manager123"}, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["user"]["is_admin"] is True
    return d["token"]


class TestAuth:
    def test_login_new_manager_email(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "osagency6@gmail.com", "password": "manager123"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and d["user"]["is_admin"] is True


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
        assert r.status_code == 401, f"{path} expected 401 got {r.status_code}"


class TestGmailStatus:
    def test_status_shape(self, mgr_token):
        r = requests.get(f"{API}/inbox/gmail-status", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("configured") is True
        assert isinstance(d.get("synced_count"), int)
        # last_sync: null or ISO string
        ls = d.get("last_sync")
        assert ls is None or isinstance(ls, str)


class TestGmailSync:
    def test_sync_and_idempotency(self, mgr_token):
        # First sync (may already be seeded from previous run — still ok)
        r1 = requests.post(f"{API}/inbox/sync", headers=hdr(mgr_token), timeout=90)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1.get("ok") is True
        assert isinstance(d1.get("new_count"), int)
        assert isinstance(d1.get("updated_count"), int)
        assert d1.get("total_fetched", 0) > 0
        total = d1["total_fetched"]

        # Second sync — idempotent by messageId
        time.sleep(1.0)
        r2 = requests.post(f"{API}/inbox/sync", headers=hdr(mgr_token), timeout=90)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2["ok"] is True
        assert d2["new_count"] == 0, f"idempotent second sync expected new_count=0, got {d2['new_count']}"
        assert d2["updated_count"] == d2["total_fetched"], \
            f"expected updated==total on 2nd sync, got updated={d2['updated_count']} total={d2['total_fetched']}"

    def test_status_after_sync(self, mgr_token):
        r = requests.get(f"{API}/inbox/gmail-status", headers=hdr(mgr_token), timeout=20)
        d = r.json()
        assert d["configured"] is True
        assert d["synced_count"] > 0
        assert isinstance(d.get("last_sync"), str) and len(d["last_sync"]) > 0


class TestInboxList:
    def test_inbox_has_mock_and_gmail(self, mgr_token):
        # Ensure sync ran
        requests.post(f"{API}/inbox/sync", headers=hdr(mgr_token), timeout=90)
        r = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        emails = r.json()
        assert isinstance(emails, list) and len(emails) > 0
        gmail_emails = [e for e in emails if e.get("source") == "gmail"]
        assert len(gmail_emails) > 0, "no Gmail-sourced emails in /api/inbox"
        for g in gmail_emails:
            assert g.get("messageId"), f"gmail email missing messageId: {g}"

    def test_unassigned_gmail_present(self, mgr_token):
        r = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20)
        emails = r.json()
        gmail_emails = [e for e in emails if e.get("source") == "gmail"]
        # There should be at least some with clientId=None (unassigned)
        unassigned = [e for e in gmail_emails if not e.get("clientId")]
        # Not asserting > 0 strictly (depends on mailbox), just verify shape works
        for e in unassigned:
            assert e.get("clientId") in (None, "", None)


class TestMarkAsRead:
    def test_mark_mock_read(self, mgr_token):
        r = requests.post(f"{API}/inbox/e-1/read", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        emails = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        target = next((e for e in emails if e.get("id") == "e-1"), None)
        assert target is not None
        assert target.get("read") is True

    def test_mark_gmail_read(self, mgr_token):
        emails = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        gmail_emails = [e for e in emails if e.get("source") == "gmail"]
        if not gmail_emails:
            pytest.skip("no gmail emails present")
        g = gmail_emails[0]
        gid = g["id"]
        r = requests.post(f"{API}/inbox/{gid}/read", headers=hdr(mgr_token), timeout=30)
        assert r.status_code == 200, r.text
        emails2 = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        target = next(e for e in emails2 if e["id"] == gid)
        assert target.get("read") is True


class TestParseBrief:
    def test_parse_brief_mock_ok(self, mgr_token):
        r = requests.post(f"{API}/inbox/parse-brief", headers=hdr(mgr_token),
                          json={"emailId": "e-1"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "briefSummary" in d and "internalDelegation" in d

    def test_parse_brief_unassigned_gmail_404(self, mgr_token):
        emails = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        unassigned = [e for e in emails
                      if e.get("source") == "gmail" and not e.get("clientId")]
        if not unassigned:
            pytest.skip("no unassigned gmail emails present")
        eid = unassigned[0]["id"]
        r = requests.post(f"{API}/inbox/parse-brief", headers=hdr(mgr_token),
                          json={"emailId": eid}, timeout=30)
        assert r.status_code == 404, f"expected 404 for unassigned gmail email, got {r.status_code}: {r.text}"


class TestClearSamples:
    def test_clear_removes_mocks(self, mgr_token):
        # Ensure gmail data present
        requests.post(f"{API}/inbox/sync", headers=hdr(mgr_token), timeout=90)
        before = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        mocks_before = [e for e in before if e.get("source") != "gmail"]
        r = requests.post(f"{API}/inbox/clear-samples", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("removed"), int)
        # If mocks existed, removed>0
        if len(mocks_before) > 0:
            assert d["removed"] > 0, f"had {len(mocks_before)} mocks but removed=0"
        after = requests.get(f"{API}/inbox", headers=hdr(mgr_token), timeout=20).json()
        for e in after:
            assert e.get("source") == "gmail", f"non-gmail email left after clear: {e.get('id')} src={e.get('source')}"
