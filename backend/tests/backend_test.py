"""Backend API tests for Openspace Agency OS — iteration 2.

Covers:
- Auth
- RBAC
- Seed counts (invoices removed)
- Jobs CRUD
- Invoice endpoints REMOVED (404 expected)
- Job attachments (upload / download / delete / role-scoping / validation)
- Content posts / timelogs / approvals
- Notifications
- AI features (Claude via emergentintegrations)
"""
import io
import os
import struct
import zlib
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
LONG_TIMEOUT = 90


# -------- helpers --------

def hdr(t):
    return {"Authorization": f"Bearer {t}"}


def tiny_png_bytes() -> bytes:
    """Return a valid 1x1 red PNG (~70 bytes)."""
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = b"\x00\xff\x00\x00"  # filter=0, one red pixel
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


# -------- fixtures --------

@pytest.fixture(scope="session")
def mgr_token():
    r = requests.post(f"{API}/auth/login", json={"email": "yusuf@osagency.in", "password": "manager123"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def team_token():
    r = requests.post(f"{API}/auth/login", json={"email": "arjun@osagency.in", "password": "team123"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# -------- Auth --------

class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": "yusuf@osagency.in", "password": "manager123"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["is_admin"] is True

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": "yusuf@osagency.in", "password": "wrong"}, timeout=20)
        assert r.status_code == 401

    def test_me(self, mgr_token):
        r = requests.get(f"{API}/auth/me", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["email"] == "yusuf@osagency.in"


# -------- RBAC --------

class TestRBAC:
    @pytest.mark.parametrize("path,method,payload", [
        ("/inbox", "get", None),
        ("/reports/insights", "post", {"period": "monthly"}),
        ("/kpi/team-review", "post", {}),
        ("/inbox/parse-brief", "post", {"emailId": "e-1"}),
    ])
    def test_team_forbidden(self, team_token, path, method, payload):
        fn = requests.get if method == "get" else requests.post
        kw = {"headers": hdr(team_token), "timeout": 20}
        if payload is not None:
            kw["json"] = payload
        r = fn(f"{API}{path}", **kw)
        assert r.status_code == 403, f"{path} expected 403 got {r.status_code}"

    def test_team_jobs_filtered(self, team_token):
        r = requests.get(f"{API}/jobs", headers=hdr(team_token), timeout=20)
        assert r.status_code == 200
        for j in r.json():
            assert "u_arjun" in j["assignees"]


# -------- Invoice removal regression --------

class TestInvoiceRemoved:
    def test_get_invoices_404(self, mgr_token):
        r = requests.get(f"{API}/invoices", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 404, f"expected 404 got {r.status_code}"

    def test_post_invoices_404(self, mgr_token):
        r = requests.post(f"{API}/invoices", headers=hdr(mgr_token),
                          json={"client": "galalite", "amount": 100, "desc": "x", "due": "2026-12-31"}, timeout=20)
        assert r.status_code == 404

    def test_post_invoice_paid_404(self, mgr_token):
        r = requests.post(f"{API}/invoices/INV-nope/paid", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 404


# -------- Seed counts --------

class TestSeed:
    def test_seed_counts(self, mgr_token):
        h = hdr(mgr_token)
        assert len(requests.get(f"{API}/users", headers=h, timeout=20).json()) == 6
        assert len(requests.get(f"{API}/clients", headers=h, timeout=20).json()) == 6
        assert len(requests.get(f"{API}/jobs", headers=h, timeout=20).json()) >= 12
        assert len(requests.get(f"{API}/kpi", headers=h, timeout=20).json()) == 5
        assert len(requests.get(f"{API}/sops", headers=h, timeout=20).json()) >= 5
        assert len(requests.get(f"{API}/inbox", headers=h, timeout=20).json()) == 5
        assert len(requests.get(f"{API}/approvals", headers=h, timeout=20).json()) == 5
        assert len(requests.get(f"{API}/timelogs", headers=h, timeout=20).json()) >= 6
        # notifications count may have changed since invoice notification was replaced
        n = requests.get(f"{API}/notifications", headers=h, timeout=20).json()
        assert isinstance(n, list) and len(n) > 0


# -------- Jobs --------

class TestJobs:
    def test_get_single(self, mgr_token):
        r = requests.get(f"{API}/jobs/OS-001", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["id"] == "OS-001"

    def test_patch_job(self, mgr_token):
        r = requests.patch(f"{API}/jobs/OS-001", headers=hdr(mgr_token), json={"progress": 70}, timeout=20)
        assert r.status_code == 200
        g = requests.get(f"{API}/jobs/OS-001", headers=hdr(mgr_token), timeout=20).json()
        assert g["progress"] == 70

    def test_add_comment(self, mgr_token):
        r = requests.post(f"{API}/jobs/OS-001/comments", headers=hdr(mgr_token), json={"text": "TEST_comment"}, timeout=20)
        assert r.status_code == 200


# -------- Job Attachments --------

class TestAttachments:
    @pytest.fixture(scope="class")
    def uploaded(self, mgr_token):
        """Upload once, reuse for get/download/delete."""
        png = tiny_png_bytes()
        files = {"file": ("test.png", png, "image/png")}
        r = requests.post(f"{API}/jobs/OS-002/attachments", headers=hdr(mgr_token), files=files, timeout=60)
        assert r.status_code in (200, 201), f"upload failed {r.status_code}: {r.text}"
        d = r.json()
        return {"att": d, "png": png, "token": mgr_token}

    def test_upload_response_shape(self, uploaded):
        d = uploaded["att"]
        for k in ["id", "storage_path", "filename", "content_type", "size", "uploaded_by", "uploaded_by_name", "uploaded_at", "is_deleted"]:
            assert k in d, f"missing {k} in attachment"
        assert d["is_deleted"] is False
        assert d["content_type"] == "image/png"
        assert d["size"] == len(uploaded["png"])
        assert d["filename"] == "test.png"

    def test_job_shows_attachment(self, uploaded, mgr_token):
        r = requests.get(f"{API}/jobs/OS-002", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        attachments = r.json().get("attachments", [])
        assert any(a["id"] == uploaded["att"]["id"] for a in attachments)

    def test_download_via_query_token(self, uploaded):
        att = uploaded["att"]
        url = f"{API}/jobs/OS-002/attachments/{att['id']}?auth={uploaded['token']}"
        r = requests.get(url, timeout=60)  # no Authorization header
        assert r.status_code == 200, r.text
        assert r.content == uploaded["png"]
        assert r.headers.get("content-type", "").startswith("image/png")

    def test_download_via_header(self, uploaded, mgr_token):
        att = uploaded["att"]
        r = requests.get(f"{API}/jobs/OS-002/attachments/{att['id']}", headers=hdr(mgr_token), timeout=60)
        assert r.status_code == 200
        assert r.content == uploaded["png"]

    def test_download_missing_auth(self, uploaded):
        r = requests.get(f"{API}/jobs/OS-002/attachments/{uploaded['att']['id']}", timeout=20)
        assert r.status_code == 401

    def test_unsupported_mime_415(self, mgr_token):
        files = {"file": ("bad.sh", b"#!/bin/sh\necho hi\n", "application/x-shellscript")}
        r = requests.post(f"{API}/jobs/OS-002/attachments", headers=hdr(mgr_token), files=files, timeout=30)
        assert r.status_code == 415, f"expected 415 got {r.status_code}: {r.text[:200]}"

    def test_oversize_413(self, mgr_token):
        # 26 MB of zeros — content_type png (still gets rejected before mime check? size check first)
        big = b"\x00" * (26 * 1024 * 1024)
        files = {"file": ("big.png", big, "image/png")}
        r = requests.post(f"{API}/jobs/OS-002/attachments", headers=hdr(mgr_token), files=files, timeout=120)
        assert r.status_code == 413, f"expected 413 got {r.status_code}"

    def test_team_can_upload_on_assigned_job(self, team_token):
        # arjun is assigned to OS-001
        files = {"file": ("arjun.txt", b"hello from arjun", "text/plain")}
        r = requests.post(f"{API}/jobs/OS-001/attachments", headers=hdr(team_token), files=files, timeout=60)
        assert r.status_code in (200, 201), r.text
        att_id = r.json()["id"]
        # download works
        d = requests.get(f"{API}/jobs/OS-001/attachments/{att_id}?auth={team_token}", timeout=30)
        assert d.status_code == 200
        assert d.content == b"hello from arjun"
        # delete works (soft)
        de = requests.delete(f"{API}/jobs/OS-001/attachments/{att_id}", headers=hdr(team_token), timeout=20)
        assert de.status_code == 200
        # subsequent GET job no longer shows it (frontend also filters; backend response may include soft-deleted)
        job = requests.get(f"{API}/jobs/OS-001", headers=hdr(team_token), timeout=20).json()
        matched = [a for a in job.get("attachments", []) if a["id"] == att_id]
        # if still present, must be marked deleted
        for a in matched:
            assert a.get("is_deleted") is True

    def test_team_cannot_upload_on_unassigned_job(self, team_token):
        # arjun is NOT assigned to OS-006
        files = {"file": ("nope.txt", b"nope", "text/plain")}
        r = requests.post(f"{API}/jobs/OS-006/attachments", headers=hdr(team_token), files=files, timeout=30)
        assert r.status_code == 404, f"expected 404 for role-scope got {r.status_code}"

    def test_delete_by_manager(self, uploaded, mgr_token):
        # delete the primary uploaded attachment last
        att = uploaded["att"]
        r = requests.delete(f"{API}/jobs/OS-002/attachments/{att['id']}", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        # download now 404
        r2 = requests.get(f"{API}/jobs/OS-002/attachments/{att['id']}?auth={mgr_token}", timeout=20)
        assert r2.status_code == 404


# -------- Content / timelogs / approvals --------

class TestOthers:
    def test_content_create(self, mgr_token):
        r = requests.post(f"{API}/content-posts", headers=hdr(mgr_token),
                          json={"client": "galalite", "platform": "LinkedIn", "date": "2026-06-01", "topic": "TEST_topic"}, timeout=20)
        assert r.status_code == 200

    def test_timelog_create(self, mgr_token):
        r = requests.post(f"{API}/timelogs", headers=hdr(mgr_token),
                          json={"jobId": "OS-001", "date": "2026-06-01", "hours": 1.5, "person": "u_arjun", "notes": "TEST"}, timeout=20)
        assert r.status_code == 200

    def test_approval_decide(self, mgr_token):
        r = requests.post(f"{API}/approvals/ap-1/decide", headers=hdr(mgr_token), json={"action": "approve"}, timeout=20)
        assert r.status_code == 200


# -------- Notifications --------

class TestNotifications:
    def test_list_and_mark_all(self, team_token):
        r = requests.get(f"{API}/notifications", headers=hdr(team_token), timeout=20)
        assert r.status_code == 200
        m = requests.post(f"{API}/notifications/mark-all-read", headers=hdr(team_token), timeout=20)
        assert m.status_code == 200


# -------- AI --------

class TestAI:
    def test_parse_brief(self, mgr_token):
        r = requests.post(f"{API}/inbox/parse-brief", headers=hdr(mgr_token), json={"emailId": "e-1"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["briefStatus", "briefSummary", "missingInfo", "internalDelegation", "gapQuestionEmail"]:
            assert k in d

    def test_assistant(self, team_token):
        r = requests.post(f"{API}/ai/assistant", headers=hdr(team_token), json={"prompt": "Say hi in 3 words"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200
        assert len(r.json()["reply"]) > 0

    def test_reports_insights_shape(self, mgr_token):
        r = requests.post(f"{API}/reports/insights", headers=hdr(mgr_token), json={"period": "monthly"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert "insights" in d and "stats" in d
        stats = d["stats"]
        # New shape — no collected/pending
        for k in ["jobsDone", "overdue", "topClient", "utilisation"]:
            assert k in stats, f"missing stats.{k}"
        assert "collected" not in stats
        assert "pending" not in stats
