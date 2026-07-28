"""Backend API tests for Openspace Agency OS."""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://brief-hub-20.preview.emergentagent.com"
API = f"{BASE}/api"
LONG_TIMEOUT = 90


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


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


# --- Auth ---
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": "yusuf@osagency.in", "password": "manager123"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and "user" in d
        assert d["user"]["email"] == "yusuf@osagency.in"
        assert d["user"]["is_admin"] is True

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": "yusuf@osagency.in", "password": "wrong"}, timeout=20)
        assert r.status_code == 401

    def test_me(self, mgr_token):
        r = requests.get(f"{API}/auth/me", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["email"] == "yusuf@osagency.in"

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 401


# --- Role-based access ---
class TestRBAC:
    @pytest.mark.parametrize("path,method,payload", [
        ("/inbox", "get", None),
        ("/invoices", "get", None),
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
        jobs = r.json()
        assert len(jobs) > 0
        for j in jobs:
            assert "u_arjun" in j["assignees"], f"Job {j['id']} not assigned to arjun"


# --- Seed data verification ---
class TestSeed:
    def test_seed_counts(self, mgr_token):
        h = hdr(mgr_token)
        assert len(requests.get(f"{API}/users", headers=h, timeout=20).json()) == 6
        assert len(requests.get(f"{API}/clients", headers=h, timeout=20).json()) == 6
        assert len(requests.get(f"{API}/jobs", headers=h, timeout=20).json()) >= 12
        assert len(requests.get(f"{API}/invoices", headers=h, timeout=20).json()) >= 6
        assert len(requests.get(f"{API}/kpi", headers=h, timeout=20).json()) == 5
        assert len(requests.get(f"{API}/sops", headers=h, timeout=20).json()) >= 5
        assert len(requests.get(f"{API}/content-posts", headers=h, timeout=20).json()) >= 10
        assert len(requests.get(f"{API}/inbox", headers=h, timeout=20).json()) == 5
        assert len(requests.get(f"{API}/approvals", headers=h, timeout=20).json()) == 5
        assert len(requests.get(f"{API}/timelogs", headers=h, timeout=20).json()) >= 6
        assert len(requests.get(f"{API}/notifications", headers=h, timeout=20).json()) == 6


# --- Jobs CRUD ---
class TestJobs:
    def test_get_single(self, mgr_token):
        r = requests.get(f"{API}/jobs/OS-001", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["id"] == "OS-001"

    def test_patch_job(self, mgr_token):
        r = requests.patch(f"{API}/jobs/OS-001", headers=hdr(mgr_token), json={"status": "active", "progress": 70}, timeout=20)
        assert r.status_code == 200
        # verify persistence
        g = requests.get(f"{API}/jobs/OS-001", headers=hdr(mgr_token), timeout=20).json()
        assert g["progress"] == 70

    def test_add_comment(self, mgr_token):
        r = requests.post(f"{API}/jobs/OS-001/comments", headers=hdr(mgr_token), json={"text": "TEST_comment"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["text"] == "TEST_comment"

    def test_assignee_filter(self, mgr_token):
        r = requests.get(f"{API}/jobs?assignee=priya", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200
        for j in r.json():
            assert "u_priya" in j["assignees"]


# --- Invoices ---
class TestInvoices:
    def test_list(self, mgr_token):
        r = requests.get(f"{API}/invoices", headers=hdr(mgr_token), timeout=20)
        assert r.status_code == 200

    def test_create_and_paid(self, mgr_token):
        r = requests.post(f"{API}/invoices", headers=hdr(mgr_token),
                          json={"client": "galalite", "amount": 10000, "desc": "TEST_inv", "due": "2026-12-31"}, timeout=20)
        assert r.status_code == 200
        inv_id = r.json()["id"]
        assert inv_id.startswith("INV-")
        p = requests.post(f"{API}/invoices/{inv_id}/paid", headers=hdr(mgr_token), timeout=20)
        assert p.status_code == 200
        assert p.json()["status"] == "paid"


# --- Content posts / timelogs / approvals ---
class TestOthers:
    def test_content_create(self, mgr_token):
        r = requests.post(f"{API}/content-posts", headers=hdr(mgr_token),
                          json={"client": "galalite", "platform": "LinkedIn", "date": "2026-06-01", "topic": "TEST_topic"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["topic"] == "TEST_topic"

    def test_timelog_create(self, mgr_token):
        r = requests.post(f"{API}/timelogs", headers=hdr(mgr_token),
                          json={"jobId": "OS-001", "date": "2026-06-01", "hours": 1.5, "person": "u_arjun", "notes": "TEST"}, timeout=20)
        assert r.status_code == 200

    def test_approval_decide(self, mgr_token):
        r = requests.post(f"{API}/approvals/ap-1/decide", headers=hdr(mgr_token), json={"action": "approve"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "approved"


# --- Notifications ---
class TestNotifications:
    def test_list_and_mark_all(self, team_token):
        r = requests.get(f"{API}/notifications", headers=hdr(team_token), timeout=20)
        assert r.status_code == 200
        m = requests.post(f"{API}/notifications/mark-all-read", headers=hdr(team_token), timeout=20)
        assert m.status_code == 200


# --- AI features ---
class TestAI:
    def test_parse_brief(self, mgr_token):
        r = requests.post(f"{API}/inbox/parse-brief", headers=hdr(mgr_token), json={"emailId": "e-1"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["briefStatus", "briefSummary", "missingInfo", "internalDelegation", "gapQuestionEmail"]:
            assert k in d, f"Missing key {k}"

    def test_draft_reply(self, mgr_token):
        r = requests.post(f"{API}/inbox/draft-reply", headers=hdr(mgr_token), json={"emailId": "e-2"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200, r.text
        assert isinstance(r.json()["reply"], str) and len(r.json()["reply"]) > 0

    def test_create_job_from_brief(self, mgr_token):
        payload = {
            "emailId": "e-3",
            "brief": {"jobTitle": "TEST_AI_Job", "client": "lumina", "priority": "medium", "deadline": "2026-12-31", "brief": "test"},
            "delegation": {"primaryOwner": "designer", "suggestedWorkflow": [{"assignee": "designer", "task": "carousel"}]},
        }
        r = requests.post(f"{API}/inbox/create-job", headers=hdr(mgr_token), json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["id"].startswith("OS-")

    def test_kpi_coaching(self, mgr_token):
        kpis = requests.get(f"{API}/kpi", headers=hdr(mgr_token), timeout=20).json()
        assert kpis
        r = requests.post(f"{API}/kpi/coaching", headers=hdr(mgr_token), json={"kpiId": kpis[0]["id"]}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200, r.text
        assert len(r.json()["advice"]) > 0

    def test_team_review(self, mgr_token):
        r = requests.post(f"{API}/kpi/team-review", headers=hdr(mgr_token), json={}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200
        assert len(r.json()["review"]) > 0

    def test_reports_insights(self, mgr_token):
        r = requests.post(f"{API}/reports/insights", headers=hdr(mgr_token), json={"period": "monthly"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert "insights" in d and "stats" in d

    def test_sop_generate(self, mgr_token):
        r = requests.post(f"{API}/sops/generate", headers=hdr(mgr_token), json={"topic": "Client onboarding"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200, r.text
        assert "id" in r.json()

    def test_assistant(self, team_token):
        r = requests.post(f"{API}/ai/assistant", headers=hdr(team_token), json={"prompt": "Say hi in 3 words"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200
        assert len(r.json()["reply"]) > 0

    def test_job_help(self, mgr_token):
        r = requests.post(f"{API}/ai/job-help", headers=hdr(mgr_token), json={"jobId": "OS-001", "kind": "next"}, timeout=LONG_TIMEOUT)
        assert r.status_code == 200
        assert len(r.json()["reply"]) > 0
