# Job visibility scoping: yusuf/bd full access, others only assigned jobs
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
CREDS = {
    "yusuf": ("yusuf@osagency.in", "manager123"),
    "bd": ("bd@osagency.in", "team123"),
    "rupali": ("rupali@osagency.in", "team123"),
    "kalpesh": ("kalpesh@osagency.in", "team123"),
    "aayush": ("aayush@osagency.in", "team123"),
    "digital": ("digital@osagency.in", "team123"),
}
_tokens = {}


def hdr(who, extra=None):
    if who not in _tokens:
        e, p = CREDS[who]
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": e, "password": p})
        if r.status_code != 200:
            pytest.skip(f"login failed for {who}: {r.status_code}")
        d = r.json()
        _tokens[who] = d.get("token") or d.get("access_token")
    h = {"Authorization": f"Bearer {_tokens[who]}"}
    if extra:
        h.update(extra)
    return h


def jobs(who, params=None, extra=None):
    r = requests.get(f"{BASE_URL}/api/jobs", headers=hdr(who, extra), params=params)
    assert r.status_code == 200, r.text
    return r.json()


# --- list scoping ---
def test_yusuf_sees_all_and_os018():
    data = jobs("yusuf")
    ids = [j["id"] for j in data]
    assert "OS-018" in ids
    assert all("_id" not in j for j in data)


def test_bd_sees_all_same_as_yusuf():
    assert sorted(j["id"] for j in jobs("bd")) == sorted(j["id"] for j in jobs("yusuf"))


def test_rupali_sees_only_own():
    data = jobs("rupali")
    assert "OS-018" in [j["id"] for j in data]
    assert all("u_arjun" in j["assignees"] for j in data)


@pytest.mark.parametrize("who,uid", [("kalpesh", "u_priya"), ("aayush", "u_kavya"), ("digital", "u_rohan")])
def test_others_only_own(who, uid):
    data = jobs(who)
    assert all(uid in j["assignees"] for j in data)
    assert "OS-018" not in [j["id"] for j in data]


# --- assignee filter ---
def test_assignee_filter_full_access():
    assert "OS-018" in [j["id"] for j in jobs("yusuf", {"assignee": "u_arjun"})]
    assert "OS-018" not in [j["id"] for j in jobs("yusuf", {"assignee": "u_priya"})]
    assert "OS-018" in [j["id"] for j in jobs("bd", {"assignee": "u_meera"})]


def test_assignee_param_ignored_for_member():
    # kalpesh cannot use ?assignee to peek into rupali's jobs
    data = jobs("kalpesh", {"assignee": "u_arjun"})
    assert all("u_priya" in j["assignees"] for j in data)


# --- detail / patch scoping ---
def test_non_assigned_get_patch_404():
    assert requests.get(f"{BASE_URL}/api/jobs/OS-018", headers=hdr("kalpesh")).status_code == 404
    r = requests.patch(f"{BASE_URL}/api/jobs/OS-018", headers=hdr("kalpesh"), json={"status": "done"})
    assert r.status_code == 404


def test_bd_can_patch_any_job_and_restore():
    orig = requests.get(f"{BASE_URL}/api/jobs/OS-018", headers=hdr("bd"))
    assert orig.status_code == 200
    o = orig.json()
    new_status = "review" if o["status"] != "review" else "active"
    r = requests.patch(f"{BASE_URL}/api/jobs/OS-018", headers=hdr("bd"), json={"status": new_status})
    assert r.status_code == 200 and r.json()["status"] == new_status
    g = requests.get(f"{BASE_URL}/api/jobs/OS-018", headers=hdr("yusuf")).json()
    assert g["status"] == new_status
    requests.patch(f"{BASE_URL}/api/jobs/OS-018", headers=hdr("yusuf"), json={"status": o["status"]})
    assert requests.get(f"{BASE_URL}/api/jobs/OS-018", headers=hdr("yusuf")).json()["status"] == o["status"]


# --- view-as ---
def test_view_as_rupali_and_kalpesh():
    assert "OS-018" in [j["id"] for j in jobs("yusuf", extra={"X-View-As": "u_arjun"})]
    d = jobs("yusuf", extra={"X-View-As": "u_priya"})
    assert all("u_priya" in j["assignees"] for j in d)


# --- create TEST_ job, verify filtering, delete ---
def test_create_test_job_filter_then_delete():
    r = requests.post(f"{BASE_URL}/api/jobs", headers=hdr("yusuf"), json={
        "title": "TEST_scope_job", "client": "", "priority": "low", "status": "todo",
        "team": ["designer"], "assignees": ["u_priya"], "recurring": "none", "desc": "t"})
    if r.status_code not in (200, 201):
        pytest.skip(f"create failed {r.status_code} {r.text}")
    jid = r.json()["id"]
    try:
        assert jid != "OS-018"
        assert jid in [j["id"] for j in jobs("kalpesh")]
        assert jid not in [j["id"] for j in jobs("rupali")]
        assert jid in [j["id"] for j in jobs("bd", {"assignee": "u_priya"})]
        assert jid not in [j["id"] for j in jobs("yusuf", {"assignee": "u_arjun"})]
    finally:
        # No DELETE /api/jobs endpoint exists -> clean up directly in Mongo
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")

        async def _rm():
            c = AsyncIOMotorClient(os.environ["MONGO_URL"])
            await c[os.environ["DB_NAME"]].jobs.delete_many({"id": jid, "title": {"$regex": "^TEST_"}})
            c.close()
        asyncio.run(_rm())
        # final OS-018 still there
        assert "OS-018" in [j["id"] for j in jobs("yusuf")]
