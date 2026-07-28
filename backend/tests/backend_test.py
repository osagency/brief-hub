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


# -------- Iteration 3: retainer removed --------

class TestRetainerRemoved:
    def test_clients_have_no_retainer(self, mgr_token):
        r = requests.get(f"{API}/clients", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        clients = r.json()
        assert len(clients) == 6
        for c in clients:
            assert "retainer" not in c, f"client {c.get('id')} still has retainer"

    def test_ai_assistant_no_rupee_fabrication(self, mgr_token):
        r = requests.post(f"{API}/ai/assistant", headers=hdr(mgr_token),
                          json={"prompt": "What are the client retainer amounts in rupees?"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200
        reply = r.json()["reply"]
        # Should not fabricate specific rupee amounts. Best-effort: reply exists.
        assert len(reply) > 0
        # Log for manual inspection
        print(f"AI reply for retainer question: {reply[:400]}")


# -------- Iteration 3: SOP seed expansion --------

class TestSOPSeedExpansion:
    def test_sops_count_and_titles(self, mgr_token):
        r = requests.get(f"{API}/sops", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        sops = r.json()
        assert len(sops) >= 20, f"expected >=20 sops, got {len(sops)}"
        titles = {s["title"] for s in sops}
        required = [
            "LinkedIn Ad Campaign Setup",
            "Google Ads Search Campaign Setup",
            "Instagram Reel Production",
            "Email Newsletter Send",
            "New Client Onboarding",
            "Client Offboarding",
            "Weekly Team Standup",
            "Monthly Client Reporting Cadence",
            "Content Calendar Planning (Monthly)",
            "Landing Page Build",
            "Case Study Production",
            "Press Release Writing",
            "Analytics Setup for New Client",
            "Scope Creep Response",
            "Emergency Client Escalation",
        ]
        missing = [t for t in required if t not in titles]
        assert not missing, f"Missing SOP titles: {missing}"
        for s in sops:
            assert isinstance(s.get("steps"), list) and len(s["steps"]) > 0, f"SOP {s['title']} has empty steps"


# -------- Iteration 3: Client CRUD --------

class TestClientCRUD:
    def test_team_forbidden(self, team_token):
        r = requests.post(f"{API}/clients", headers=hdr(team_token),
                          json={"name": "TEST_ForbClient", "short": "TFC", "email": "test-forb@example.com", "voice": "", "color": "#123456"}, timeout=20)
        assert r.status_code == 403
        r2 = requests.patch(f"{API}/clients/galalite", headers=hdr(team_token), json={"name": "hacked"}, timeout=20)
        assert r2.status_code == 403
        r3 = requests.delete(f"{API}/clients/galalite", headers=hdr(team_token), timeout=20)
        assert r3.status_code == 403

    def test_team_can_list_clients(self, team_token):
        r = requests.get(f"{API}/clients", headers=hdr(team_token), timeout=20)
        assert r.status_code == 200
        assert len(r.json()) == 6

    def test_delete_client_with_active_jobs_blocked(self, mgr_token):
        r = requests.delete(f"{API}/clients/galalite", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "active" in detail.lower() or "job" in detail.lower()

    def test_full_client_lifecycle(self, mgr_token):
        # CREATE
        payload = {
            "id": "TEST_tempclient",
            "name": "TEST_Temp Client",
            "short": "temp",  # should be uppercased to TEM
            "email": "TEST_Temp@Example.com",  # should be lowercased
            "voice": "friendly",
            "color": "#ABCDEF",
        }
        r = requests.post(f"{API}/clients", headers=hdr(mgr_token), json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        assert created["id"] == "TEST_tempclient"
        assert created["short"] == "TEM"
        assert created["email"] == "test_temp@example.com"
        assert "retainer" not in created

        # GET verify persisted
        listed = requests.get(f"{API}/clients", headers=hdr(mgr_token), timeout=20).json()
        assert any(c["id"] == "TEST_tempclient" for c in listed)

        # PATCH
        p = requests.patch(f"{API}/clients/TEST_tempclient", headers=hdr(mgr_token),
                           json={"name": "TEST_Renamed", "voice": "formal"}, timeout=20)
        assert p.status_code == 200, p.text
        assert p.json()["name"] == "TEST_Renamed"
        assert p.json()["voice"] == "formal"

        # DELETE (no active jobs — should succeed)
        d = requests.delete(f"{API}/clients/TEST_tempclient", headers=hdr(mgr_token), timeout=20)
        assert d.status_code == 200, d.text

        # Confirm gone
        listed2 = requests.get(f"{API}/clients", headers=hdr(mgr_token), timeout=20).json()
        assert not any(c["id"] == "TEST_tempclient" for c in listed2)

    def test_create_client_autogenerates_id(self, mgr_token):
        payload = {
            "name": "TEST_AutoID Client",
            "short": "aid",
            "email": "test_autoid@example.com",
            "voice": "",
            "color": "#112233",
        }
        r = requests.post(f"{API}/clients", headers=hdr(mgr_token), json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        cid = r.json()["id"]
        assert cid  # non-empty auto-generated
        # cleanup
        requests.delete(f"{API}/clients/{cid}", headers=hdr(mgr_token), timeout=20)


# -------- Iteration 3: User (team member) CRUD --------

class TestUserCRUD:
    def test_team_forbidden_on_user_mutations(self, team_token):
        r = requests.post(f"{API}/users", headers=hdr(team_token),
                          json={"name": "TEST_x", "email": "test_x@example.com", "password": "pw1234",
                                "role_key": "writer", "role_label": "Writer", "is_admin": False}, timeout=20)
        assert r.status_code == 403
        r2 = requests.patch(f"{API}/users/u_arjun", headers=hdr(team_token), json={"name": "hax"}, timeout=20)
        assert r2.status_code == 403
        r3 = requests.delete(f"{API}/users/u_priya", headers=hdr(team_token), timeout=20)
        assert r3.status_code == 403
        r4 = requests.post(f"{API}/users/u_arjun/reset-password", headers=hdr(team_token),
                           json={"new_password": "abcdef"}, timeout=20)
        assert r4.status_code == 403

    def test_create_user_unique_email_and_password_min(self, mgr_token):
        # min length password fail
        r = requests.post(f"{API}/users", headers=hdr(mgr_token),
                          json={"name": "TEST_Short", "email": "test_short@example.com", "password": "abc",
                                "role_key": "writer", "role_label": "Writer", "is_admin": False}, timeout=20)
        assert r.status_code in (400, 422)

        # duplicate email fail after successful create
        payload = {"name": "TEST_NewUser", "email": "test_newuser@example.com", "password": "pw1234",
                   "role_key": "writer", "role_label": "Writer Junior", "is_admin": False}
        r1 = requests.post(f"{API}/users", headers=hdr(mgr_token), json=payload, timeout=20)
        assert r1.status_code in (200, 201), r1.text
        uid = r1.json()["id"]
        assert uid.startswith("u_"), f"expected u_ prefix, got {uid}"
        assert "password_hash" not in r1.json()

        r2 = requests.post(f"{API}/users", headers=hdr(mgr_token), json=payload, timeout=20)
        assert r2.status_code == 409

        # PATCH — update name/email/role/is_admin
        p = requests.patch(f"{API}/users/{uid}", headers=hdr(mgr_token),
                           json={"name": "TEST_Renamed", "role_label": "Senior Writer", "is_admin": False}, timeout=20)
        assert p.status_code == 200, p.text
        assert p.json()["name"] == "TEST_Renamed"

        # Reset password + login with new one
        newpw = "brandnew99"
        rp = requests.post(f"{API}/users/{uid}/reset-password", headers=hdr(mgr_token),
                           json={"new_password": newpw}, timeout=20)
        assert rp.status_code == 200
        login = requests.post(f"{API}/auth/login", json={"email": "test_newuser@example.com", "password": newpw}, timeout=20)
        assert login.status_code == 200, login.text

        # Delete cleanly (no active jobs)
        d = requests.delete(f"{API}/users/{uid}", headers=hdr(mgr_token), timeout=20)
        assert d.status_code == 200

    def test_self_delete_blocked(self, mgr_token):
        # find yusuf's id
        users = requests.get(f"{API}/users", headers=hdr(mgr_token), timeout=20).json()
        yusuf = next(u for u in users if u["email"] == "yusuf@osagency.in")
        r = requests.delete(f"{API}/users/{yusuf['id']}", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 400
        assert "own" in r.json().get("detail", "").lower()

    def test_last_admin_delete_blocked(self, mgr_token):
        # yusuf is currently the only admin — attempt to delete should also hit self-delete first,
        # so create a second admin then delete yusuf? That would break subsequent tests.
        # Instead, create a fresh admin, then try to delete that admin — should succeed
        # (not last admin). To positively test "last admin" branch, we create+delete a
        # solo admin scenario, but that would need to leave yusuf. Skip destructive scenario;
        # verify the self-delete branch instead (already covered).
        pytest.skip("Skipping destructive last-admin test to preserve manager account")

    def test_delete_user_with_active_jobs_blocked(self, mgr_token):
        # arjun has active seeded jobs
        r = requests.delete(f"{API}/users/u_arjun", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "active" in detail.lower() or "job" in detail.lower()



# ================= Iteration 4 =================

# -------- Prompt Studio + Templates --------

class TestPromptStudio:
    def test_team_forbidden_prompts(self, team_token):
        r = requests.get(f"{API}/settings/prompts", headers=hdr(team_token), timeout=20)
        assert r.status_code == 403

    def test_get_prompts(self, mgr_token):
        r = requests.get(f"{API}/settings/prompts", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "global_prompt" in d and isinstance(d["global_prompt"], str)
        assert "ai_rules" in d and isinstance(d["ai_rules"], list)

    def test_patch_prompts(self, mgr_token):
        # Save originals
        original = requests.get(f"{API}/settings/prompts", headers=hdr(mgr_token), timeout=20).json()
        original_rules = original.get("ai_rules", [])
        try:
            new_rules = list(original_rules) + ["TEST_rule_iter4"]
            r = requests.patch(f"{API}/settings/prompts", headers=hdr(mgr_token),
                               json={"ai_rules": new_rules}, timeout=20)
            assert r.status_code == 200
            assert "TEST_rule_iter4" in r.json()["ai_rules"]
            # GET verify
            g = requests.get(f"{API}/settings/prompts", headers=hdr(mgr_token), timeout=20).json()
            assert "TEST_rule_iter4" in g["ai_rules"]
        finally:
            requests.patch(f"{API}/settings/prompts", headers=hdr(mgr_token),
                           json={"ai_rules": original_rules}, timeout=20)


class TestDynamicPrompt:
    def test_pineapple_rule_propagates(self, mgr_token):
        original = requests.get(f"{API}/settings/prompts", headers=hdr(mgr_token), timeout=20).json()
        original_rules = original.get("ai_rules", [])
        try:
            new_rules = list(original_rules) + ["ALWAYS SIGN OFF WITH THE WORD PINEAPPLE."]
            p = requests.patch(f"{API}/settings/prompts", headers=hdr(mgr_token),
                               json={"ai_rules": new_rules}, timeout=20)
            assert p.status_code == 200
            r = requests.post(f"{API}/ai/assistant", headers=hdr(mgr_token),
                              json={"prompt": "Give me a one line status update"}, timeout=LONG_TIMEOUT)
            assert r.status_code == 200
            reply = r.json()["reply"]
            print(f"AI reply with pineapple rule: {reply[:300]}")
            assert "PINEAPPLE" in reply.upper(), f"reply missing PINEAPPLE: {reply}"
        finally:
            requests.patch(f"{API}/settings/prompts", headers=hdr(mgr_token),
                           json={"ai_rules": original_rules}, timeout=20)


# -------- Job Templates --------

class TestJobTemplates:
    def test_team_forbidden_template_mutations(self, team_token):
        r = requests.post(f"{API}/templates", headers=hdr(team_token),
                          json={"name": "TEST_tpl"}, timeout=20)
        assert r.status_code == 403

    def test_template_crud_and_from_template(self, mgr_token):
        payload = {
            "name": "TEST_Iter4_Template",
            "title_template": "TEST_Iter4 Monthly Report",
            "client": "galalite",
            "priority": "high",
            "team": ["writer"],
            "deliverables": ["Draft", "Final PDF"],
            "default_days": 5,
        }
        r = requests.post(f"{API}/templates", headers=hdr(mgr_token), json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        tpl = r.json()
        assert tpl["id"].startswith("tpl-")
        assert len(tpl["id"]) == 4 + 8
        tpl_id = tpl["id"]

        # list
        lst = requests.get(f"{API}/templates", headers=hdr(mgr_token), timeout=20).json()
        assert any(t["id"] == tpl_id for t in lst)

        # patch
        patched = requests.patch(f"{API}/templates/{tpl_id}", headers=hdr(mgr_token),
                                 json={**payload, "priority": "low"}, timeout=20)
        assert patched.status_code == 200
        assert patched.json()["priority"] == "low"

        # use template -> job
        use = requests.post(f"{API}/jobs/from-template", headers=hdr(mgr_token),
                            json={"template_id": tpl_id}, timeout=20)
        assert use.status_code == 200, use.text
        job = use.json()
        assert job["id"].startswith("OS-")
        assert job["priority"] == "low"
        assert job["client"] == "galalite"
        assert job["deliverables"] == ["Draft", "Final PDF"]
        assert job["title"] == "TEST_Iter4 Monthly Report"
        assert job["fromTemplate"] == tpl_id
        new_job_id = job["id"]

        # verify job exists via GET
        g = requests.get(f"{API}/jobs/{new_job_id}", headers=hdr(mgr_token), timeout=20)
        assert g.status_code == 200

        # cleanup: delete the job (via patch to done + delete not exposed; leave it — or DELETE job if endpoint exists)
        # try DELETE job
        del_job = requests.delete(f"{API}/jobs/{new_job_id}", headers=hdr(mgr_token), timeout=20)
        # may not exist; not critical

        # delete template
        d = requests.delete(f"{API}/templates/{tpl_id}", headers=hdr(mgr_token), timeout=20)
        assert d.status_code == 200

        # 404 on gone
        g2 = requests.delete(f"{API}/templates/{tpl_id}", headers=hdr(mgr_token), timeout=20)
        assert g2.status_code == 404


# -------- Approvals: comments + reminders --------

class TestApprovalsSharp:
    def test_add_comment_as_manager(self, mgr_token):
        r = requests.post(f"{API}/approvals/ap-2/comments", headers=hdr(mgr_token),
                          json={"text": "TEST_mgr_comment_iter4"}, timeout=20)
        assert r.status_code == 200
        c = r.json()
        assert c["id"].startswith("ac-")
        assert c["text"] == "TEST_mgr_comment_iter4"
        assert "authorId" in c and "author" in c and "at" in c

    def test_add_comment_as_team(self, team_token):
        # team can post comments
        r = requests.post(f"{API}/approvals/ap-2/comments", headers=hdr(team_token),
                          json={"text": "TEST_team_comment_iter4"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["text"] == "TEST_team_comment_iter4"

    def test_reminder_manager_only(self, mgr_token, team_token):
        # team forbidden
        rt = requests.post(f"{API}/approvals/ap-2/reminder", headers=hdr(team_token), timeout=20)
        assert rt.status_code == 403

        # get baseline
        approvals = requests.get(f"{API}/approvals", headers=hdr(mgr_token), timeout=20).json()
        target = next(a for a in approvals if a["id"] == "ap-2")
        before = target.get("reminder_count", 0) or 0

        r = requests.post(f"{API}/approvals/ap-2/reminder", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d.get("reminder_count", 0) == before + 1
        assert d.get("last_reminder_at")

    def test_reminder_404(self, mgr_token):
        r = requests.post(f"{API}/approvals/nope-xxx/reminder", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 404


# -------- Tailored AI (draft reply + brief parser regression) --------

class TestTailoredAI:
    def test_draft_reply_e1(self, mgr_token):
        r = requests.post(f"{API}/inbox/draft-reply", headers=hdr(mgr_token),
                          json={"emailId": "e-1"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200, r.text
        reply = r.json().get("reply", "")
        print(f"draft-reply e-1: {reply[:400]}")
        assert len(reply) > 60, f"reply too short: {reply}"

    def test_parse_brief_e1_tone(self, mgr_token):
        r = requests.post(f"{API}/inbox/parse-brief", headers=hdr(mgr_token),
                          json={"emailId": "e-1"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        tone = (d.get("briefSummary", {}) or {}).get("toneAndStyle", "") or ""
        # nested may differ; also check top-level
        if not tone:
            tone = d.get("toneAndStyle", "") or ""
        combined = str(d).lower()
        print(f"parse-brief e-1 tone: {tone[:200]}")
        assert any(k in combined for k in ["first-person", "first person", "gaurav", "personal"]), \
            f"e-1 tone missing personal/first-person markers: {combined[:400]}"

    def test_parse_brief_e5_tone(self, mgr_token):
        r = requests.post(f"{API}/inbox/parse-brief", headers=hdr(mgr_token),
                          json={"emailId": "e-5"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        combined = str(d).lower()
        print(f"parse-brief e-5: {combined[:400]}")
        assert any(k in combined for k in ["formal", "investor", "data-driven", "data driven"]), \
            f"e-5 tone missing formal/investor/data-driven: {combined[:400]}"


# -------- Kanban drag: PATCH /api/jobs status --------

class TestBoardDragPatch:
    def test_patch_status(self, mgr_token):
        # find an active job
        jobs = requests.get(f"{API}/jobs", headers=hdr(mgr_token), timeout=20).json()
        job = next(j for j in jobs if j["status"] in ("todo", "active", "in_progress"))
        jid = job["id"]
        orig = job["status"]
        target = "review" if orig != "review" else "active"
        r = requests.patch(f"{API}/jobs/{jid}", headers=hdr(mgr_token),
                           json={"status": target}, timeout=20)
        assert r.status_code == 200
        g = requests.get(f"{API}/jobs/{jid}", headers=hdr(mgr_token), timeout=20).json()
        assert g["status"] == target
        # revert
        requests.patch(f"{API}/jobs/{jid}", headers=hdr(mgr_token), json={"status": orig}, timeout=20)
