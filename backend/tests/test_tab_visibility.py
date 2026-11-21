# Tab visibility feature tests (/api/settings/tabs, /api/settings/tabs/me)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
RESTRICTED = {"time", "leads", "clients", "kpi", "leaves", "hr", "ai", "vibes"}


def login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(tok, view_as=None):
    h = {"Authorization": f"Bearer {tok}"}
    if view_as:
        h["X-View-As"] = view_as
    return h


@pytest.fixture(scope="module")
def yt():
    return login("yusuf@osagency.in", "manager123")


@pytest.fixture(scope="module")
def rt():
    return login("rupali@osagency.in", "team123")


@pytest.fixture(scope="module")
def bt():
    return login("bd@osagency.in", "team123")


@pytest.fixture(scope="module", autouse=True)
def reset(yt):
    # clear overrides for rupali before/after
    def clear():
        r = requests.get(f"{BASE_URL}/api/settings/tabs", headers=H(yt)).json()
        for u in r["users"]:
            if u["id"] in ("u_arjun",):
                requests.put(f"{BASE_URL}/api/settings/tabs", headers=H(yt), json={"user_id": u["id"], "visible": {}})
    clear()
    yield
    clear()


# --- /me defaults
def test_me_yusuf_all(yt):
    r = requests.get(f"{BASE_URL}/api/settings/tabs/me", headers=H(yt))
    assert r.status_code == 200 and r.json()["hidden"] == []


def test_me_bd_all(bt):
    r = requests.get(f"{BASE_URL}/api/settings/tabs/me", headers=H(bt))
    assert r.status_code == 200 and r.json()["hidden"] == []


def test_me_rupali_restricted(rt):
    r = requests.get(f"{BASE_URL}/api/settings/tabs/me", headers=H(rt))
    assert r.status_code == 200 and set(r.json()["hidden"]) == RESTRICTED


@pytest.mark.parametrize("email", ["kalpesh@osagency.in", "aayush@osagency.in", "digital@osagency.in"])
def test_me_other_members_restricted(email):
    t = login(email, "team123")
    r = requests.get(f"{BASE_URL}/api/settings/tabs/me", headers=H(t))
    assert set(r.json()["hidden"]) == RESTRICTED


def test_me_impersonation(yt):
    r = requests.get(f"{BASE_URL}/api/settings/tabs/me", headers=H(yt, "u_arjun"))
    assert set(r.json()["hidden"]) == RESTRICTED
    r = requests.get(f"{BASE_URL}/api/settings/tabs/me", headers=H(yt, "u_meera"))
    assert r.json()["hidden"] == []


def test_me_unauth():
    assert requests.get(f"{BASE_URL}/api/settings/tabs/me").status_code == 401


# --- owner only
def test_list_owner(yt):
    r = requests.get(f"{BASE_URL}/api/settings/tabs", headers=H(yt))
    assert r.status_code == 200
    d = r.json()
    assert len(d["tabs"]) == 15
    y = [u for u in d["users"] if u["email"] == "yusuf@osagency.in"][0]
    assert y["locked"] is True and all(y["visible"].values())
    assert all("_id" not in u for u in d["users"])


def test_list_forbidden(rt, bt, yt):
    for h in (H(rt), H(bt), H(yt, "u_arjun")):
        assert requests.get(f"{BASE_URL}/api/settings/tabs", headers=h).status_code == 403
        assert requests.put(f"{BASE_URL}/api/settings/tabs", headers=h,
                            json={"user_id": "u_arjun", "visible": {"time": True}}).status_code == 403


def test_put_self_400(yt):
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(yt)).json()
    uid = me.get("id") or me.get("user", {}).get("id")
    r = requests.put(f"{BASE_URL}/api/settings/tabs", headers=H(yt), json={"user_id": uid, "visible": {"time": False}})
    assert r.status_code == 400


def test_put_unknown_404(yt):
    r = requests.put(f"{BASE_URL}/api/settings/tabs", headers=H(yt), json={"user_id": "nope_xyz", "visible": {}})
    assert r.status_code == 404


def test_put_invalid_body_422(yt):
    r = requests.put(f"{BASE_URL}/api/settings/tabs", headers=H(yt), json={"visible": {}})
    assert r.status_code == 422


def test_put_override_persists(yt, rt):
    r = requests.put(f"{BASE_URL}/api/settings/tabs", headers=H(yt),
                     json={"user_id": "u_arjun", "visible": {"time": True, "sop": False, "bogus": True}})
    assert r.status_code == 200
    v = r.json()["visible"]
    assert v["time"] is True and v["sop"] is False and "bogus" not in v
    hidden = set(requests.get(f"{BASE_URL}/api/settings/tabs/me", headers=H(rt)).json()["hidden"])
    assert "time" not in hidden and "sop" in hidden and "leads" in hidden
    lst = requests.get(f"{BASE_URL}/api/settings/tabs", headers=H(yt)).json()
    row = [u for u in lst["users"] if u["id"] == "u_arjun"][0]
    assert row["visible"]["time"] is True and row["visible"]["sop"] is False


def test_put_override_bd_hide(yt, bt):
    r = requests.put(f"{BASE_URL}/api/settings/tabs", headers=H(yt), json={"user_id": "u_meera", "visible": {"vibes": False}})
    assert r.status_code == 200
    assert requests.get(f"{BASE_URL}/api/settings/tabs/me", headers=H(bt)).json()["hidden"] == ["vibes"]
    requests.put(f"{BASE_URL}/api/settings/tabs", headers=H(yt), json={"user_id": "u_meera", "visible": {}})
    assert requests.get(f"{BASE_URL}/api/settings/tabs/me", headers=H(bt)).json()["hidden"] == []


def test_hidden_tab_api_still_accessible(rt):
    # Informational: backend data endpoints are not gated by tab visibility
    r = requests.get(f"{BASE_URL}/api/leads", headers=H(rt))
    print("rupali GET /api/leads ->", r.status_code)
