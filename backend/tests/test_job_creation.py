# Manual job creation + "Can create jobs" permission (iteration 14)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
CREATED = []


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("access_token")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def yusuf():
    return login("yusuf@osagency.in", "manager123")


@pytest.fixture(scope="module")
def bd():
    return login("bd@osagency.in", "team123")


@pytest.fixture(scope="module")
def rupali():
    return login("rupali@osagency.in", "team123")


@pytest.fixture(scope="module")
def ved():
    return login("digital@osagency.in", "team123")


@pytest.fixture(scope="module", autouse=True)
def cleanup(yusuf):
    yield
    # reset Rupali's permission to off (default); delete created jobs by id via mongo in report step
    yusuf.put(f"{API}/settings/job-creators", json={"user_id": "u_arjun", "allowed": False})
    with open("/tmp/created_jobs.txt", "a") as f:
        for j in CREATED:
            f.write(j + "\n")


def _client_id(s):
    r = s.get(f"{API}/clients")
    assert r.status_code == 200
    return r.json()[0]["id"]


# --- settings endpoints ---
def test_me_includes_can_create_jobs(yusuf, bd, rupali):
    assert yusuf.get(f"{API}/settings/tabs/me").json()["can_create_jobs"] is True
    assert bd.get(f"{API}/settings/tabs/me").json()["can_create_jobs"] is True
    assert rupali.get(f"{API}/settings/tabs/me").json()["can_create_jobs"] is False


def test_tabs_list_includes_can_create_jobs(yusuf):
    users = {u["id"]: u for u in yusuf.get(f"{API}/settings/tabs").json()["users"]}
    assert users["u_yusuf"]["can_create_jobs"] is True and users["u_yusuf"]["locked"] is True
    assert users["u_meera"]["can_create_jobs"] is True
    assert users["u_arjun"]["can_create_jobs"] is False


def test_job_creators_put_forbidden_for_non_yusuf(bd, rupali):
    for s in (bd, rupali):
        r = s.put(f"{API}/settings/job-creators", json={"user_id": "u_arjun", "allowed": True})
        assert r.status_code == 403


def test_job_creators_put_400_for_yusuf_self(yusuf):
    r = yusuf.put(f"{API}/settings/job-creators", json={"user_id": "u_yusuf", "allowed": False})
    assert r.status_code == 400


def test_job_creators_put_404_unknown(yusuf):
    r = yusuf.put(f"{API}/settings/job-creators", json={"user_id": "u_nope", "allowed": True})
    assert r.status_code == 404


# --- create job ---
def test_yusuf_creates_job(yusuf):
    cid = _client_id(yusuf)
    r = yusuf.post(f"{API}/jobs", json={"title": "TEST_yusuf_job", "client": cid, "priority": "high",
                                        "assignees": ["u_rohan"], "desc": "d"})
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED.append(d["id"])
    assert d["id"].startswith("OS-") and d["title"] == "TEST_yusuf_job"
    assert d["assignees"] == ["u_rohan"] and d["priority"] == "high"
    assert "_id" not in d
    g = yusuf.get(f"{API}/jobs/{d['id']}")
    assert g.status_code == 200 and g.json()["title"] == "TEST_yusuf_job"


def test_missing_title_or_client_400(yusuf):
    cid = _client_id(yusuf)
    assert yusuf.post(f"{API}/jobs", json={"title": "  ", "client": cid}).status_code == 400
    assert yusuf.post(f"{API}/jobs", json={"title": "TEST_x", "client": ""}).status_code == 400


def test_bd_creates_job_and_is_added(bd):
    cid = _client_id(bd)
    r = bd.post(f"{API}/jobs", json={"title": "TEST_bd_job", "client": cid, "assignees": ["u_priya"]})
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED.append(d["id"])
    assert set(d["assignees"]) == {"u_priya", "u_meera"}


def test_rupali_403_by_default(rupali):
    r = rupali.post(f"{API}/jobs", json={"title": "TEST_rupali_denied", "client": "intercont"})
    assert r.status_code == 403


def test_rupali_toggle_on_create_then_off(yusuf, rupali, ved):
    r = yusuf.put(f"{API}/settings/job-creators", json={"user_id": "u_arjun", "allowed": True})
    assert r.status_code == 200 and r.json()["allowed"] is True
    assert rupali.get(f"{API}/settings/tabs/me").json()["can_create_jobs"] is True
    cid = _client_id(yusuf)
    r = rupali.post(f"{API}/jobs", json={"title": "TEST_rupali_job", "client": cid, "assignees": ["u_rohan"]})
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED.append(d["id"])
    assert set(d["assignees"]) == {"u_rohan", "u_arjun"}
    # appears in her scoped list and Ved's list
    assert d["id"] in [j["id"] for j in rupali.get(f"{API}/jobs").json()]
    assert d["id"] in [j["id"] for j in ved.get(f"{API}/jobs").json()]
    # off again
    r = yusuf.put(f"{API}/settings/job-creators", json={"user_id": "u_arjun", "allowed": False})
    assert r.status_code == 200
    assert rupali.get(f"{API}/settings/tabs/me").json()["can_create_jobs"] is False
    assert rupali.post(f"{API}/jobs", json={"title": "TEST_rupali_denied2", "client": cid}).status_code == 403


def test_bd_toggle_off_then_restore(yusuf, bd):
    r = yusuf.put(f"{API}/settings/job-creators", json={"user_id": "u_meera", "allowed": False})
    assert r.status_code == 200
    assert bd.post(f"{API}/jobs", json={"title": "TEST_bd_denied", "client": "intercont"}).status_code == 403
    r = yusuf.put(f"{API}/settings/job-creators", json={"user_id": "u_meera", "allowed": True})
    assert bd.get(f"{API}/settings/tabs/me").json()["can_create_jobs"] is True


# --- regression: scoping ---
def test_scoping_kalpesh_sees_only_assigned(yusuf):
    k = login("kalpesh@osagency.in", "team123")
    jobs = k.get(f"{API}/jobs").json()
    assert all("u_priya" in j.get("assignees", []) for j in jobs)
    assert k.post(f"{API}/jobs", json={"title": "TEST_kalpesh_denied", "client": "intercont"}).status_code == 403
