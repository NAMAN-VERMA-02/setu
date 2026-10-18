import os
import re
import sys
import time
from pathlib import Path

os.environ["SETU_NODE_NO_AUTOLOAD"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app as appmod  # noqa: E402
import mirror  # noqa: E402
from seed import story  # noqa: E402
from store import make_pid, sign_viewer, verify_viewer  # noqa: E402

HUB = {"Authorization": "Bearer hub-test"}
MCP_H = {"Authorization": "Bearer mcp-test", "Accept": "application/json, text/event-stream",
         "Content-Type": "application/json"}
VSECRET = "viewer-test"
FAR = int(time.time()) + 3600


def make(college, tmp_path, secret="node-test-secret", **kw):
    cfg = appmod.Config.from_env(
        college_id=college, node_secret=secret, hub_token="hub-test", viewer_secret=VSECRET, mcp_token="mcp-test",
        admin_password="pw-test", hub_origin="https://hub.example", db_path=str(tmp_path / f"{college}.db"), **kw)
    return appmod.create_app(cfg)


@pytest.fixture()
def ngit(tmp_path):
    with TestClient(make("ngit", tmp_path)) as c:
        yield c


@pytest.fixture()
def rce(tmp_path):
    with TestClient(make("rce", tmp_path)) as c:
        yield c


def pid_of(client, key):
    college = client.app.state.ctx.cfg.college_id
    return client.app.state.ctx.store.pid(story.local_id(college, key))


def viewer(pid, exp=FAR):
    return {"X-Setu-Viewer": sign_viewer(VSECRET, pid, exp)}


def join_body(**over):
    b = {"name": "Test Person", "role": "student", "branch": "CSE", "sem": 3, "cgpa": 7.9, "internship": False,
         "projects": 1, "hackathons": 0, "skills": ["python"], "goal": "Backend engineer", "open_to_intros": True,
         "on_leaderboard": False, "is_18_plus": True}
    b.update(over)
    return b


# ---------------------------------------------------------------- pseudonyms
def test_pid_format_and_stability_across_restarts(tmp_path):
    a = make("ngit", tmp_path)
    p1 = a.state.ctx.store.pid("ngit-aman")
    n1 = a.state.ctx.store.count_people()
    a.state.ctx.store.close()
    b = make("ngit", tmp_path)  # same db file, same secret: a restart
    p2 = b.state.ctx.store.pid("ngit-aman")
    assert p1 == p2 == make_pid("ngit", "node-test-secret", "ngit-aman")
    assert re.fullmatch(r"ngit_[0-9a-f]{12}", p1)
    assert b.state.ctx.store.count_people() == n1
    other = tmp_path / "other"
    other.mkdir()
    c = make("ngit", other, secret="different")
    assert c.state.ctx.store.pid("ngit-aman") != p1


def test_seed_is_deterministic_and_sized(ngit, rce):
    for c in (ngit, rce):
        store = c.app.state.ctx.store
        roles = {}
        for p in store.people():
            roles[p["role"]] = roles.get(p["role"], 0) + 1
        assert roles["alum"] == 26 and roles["student"] == 16 and roles["faculty"] == 1 and roles["placement"] == 1
    from seed import generate
    assert generate.build("ngit") == generate.build("ngit")


# ---------------------------------------------------------------- mirror
def _aman_matches(ngit, rce):
    v = ngit.post("/vector", json={"pid": pid_of(ngit, "aman")}, headers=HUB).json()
    assert len(v["vector"]) == 15 and v["sem"] == 5 and v["branch"] == "ECE" and v["goal_tag"] == "ml"
    q = {"vector": v["vector"], "sem": v["sem"], "requester_node": "ngit", "branch": v["branch"],
         "goal_tag": v["goal_tag"], "limit": 50}
    return ngit.post("/mirror", json=q, headers=HUB).json(), rce.post("/mirror", json=q, headers=HUB).json()


def test_aman_top_match_is_priya(ngit, rce):
    at_ngit, _ = _aman_matches(ngit, rce)
    assert at_ngit[0]["pid"] == pid_of(ngit, "priya")
    assert at_ngit[0]["score"] >= 0.90
    top = at_ngit[0]
    assert top["now_title"] == "ML Engineer" and top["now_company"] == "FinStack" and top["outcome"] == "job"
    assert re.search(r"only \d+% of seniors", top["shared_trait"]) and 0 < top["rarity_pct"] <= 100
    assert "name" not in top and "email" not in top


def test_aman_has_four_to_six_more_matches_from_both_colleges(ngit, rce):
    at_ngit, at_rce = _aman_matches(ngit, rce)
    priya = pid_of(ngit, "priya")
    others = [r for r in at_ngit + at_rce if r["pid"] != priya]
    assert max(r["score"] for r in others) <= 0.88  # nothing outranks the story
    band = [r for r in others if 0.70 <= r["score"] <= 0.88]
    assert 4 <= len(band) <= 6
    assert {r["pid"].split("_")[0] for r in band} == {"ngit", "rce"}
    assert all(r["pid"].startswith("rce_") for r in at_rce)  # rce node only answers with its own seniors
    assert any(r["pid"] == pid_of(rce, "vikram") for r in band)


def test_score_formula():
    v = mirror.vec("ECE", 7.2, 0, 2, 1, ["python", "ml"])
    assert mirror.cosine(v, v) == pytest.approx(1.0)
    assert mirror.score_parts(1.0, True, True, True) == 0.92
    assert mirror.score_parts(1.0, True, True, True) <= 0.99
    assert mirror.score_parts(0.5, False, False, False) == 0.4
    assert len(v) == 15


def test_reverse_mirror_and_timeline(ngit):
    r = ngit.post("/reverse-mirror", json={"pid": pid_of(ngit, "priya"), "sem": 5, "limit": 3}, headers=HUB)
    rows = r.json()
    assert r.status_code == 200 and 1 <= len(rows) <= 3
    assert rows[0]["pid"] == pid_of(ngit, "aman")
    t = ngit.get(f"/timeline/{pid_of(ngit, 'priya')}", headers=HUB).json()
    assert [x["sem_or_year"] for x in t] == [1, 3, 5, 7, 2022, 2024]
    assert t[2]["cgpa_band"] == "7.0–7.5" and t[2]["internship"] is False and t[3]["internship"] is True
    assert t[4]["decision"] == "job" and t[5]["org"] == "FinStack"
    assert all("cgpa" not in x for x in t)


# ---------------------------------------------------------------- edges
@pytest.mark.parametrize("college", ["ngit", "rce"])
def test_edges_constraints(college, tmp_path):
    with TestClient(make(college, tmp_path)) as c:
        edges = c.get("/edges", headers=HUB).json()
        pairs = [frozenset((e["a"], e["b"])) for e in edges]
        assert len(pairs) == len(set(pairs)), "duplicate pairs"
        assert all(0 < e["prior"] <= 1 for e in edges)
        story_pairs = {
            frozenset((pid_of(c, a), pid_of(c, b))): p for a, b, p in story.STORY[college]["edges"]
        }
        for pair, prior in story_pairs.items():
            e = next(x for x in edges if frozenset((x["a"], x["b"])) == pair)
            assert e["prior"] == prior
        for sp in story.STORY[college]["people"]:
            sid = pid_of(c, sp["key"])
            generated = [e for e in edges if sid in (e["a"], e["b"]) and frozenset((e["a"], e["b"])) not in story_pairs]
            assert len(generated) <= 2
            assert all(e["prior"] <= 0.3 for e in generated)
        story_ids = {pid_of(c, sp["key"]) for sp in story.STORY[college]["people"]}
        deg = {}
        for e in edges:
            for k in (e["a"], e["b"]):
                deg[k] = deg.get(k, 0) + 1
        others = [p for p in c.get("/directory", headers=HUB).json() if p["pid"] not in story_ids]
        assert all(3 <= deg.get(p["pid"], 0) <= 6 for p in others)


def test_story_edges_exact(ngit, rce):
    def get(c):
        return {frozenset((e["a"], e["b"])): e["prior"] for e in c.get("/edges", headers=HUB).json()}
    n, r = get(ngit), get(rce)
    assert n[frozenset((pid_of(ngit, "aman"), pid_of(ngit, "rohan")))] == 0.9
    assert n[frozenset((pid_of(ngit, "rohan"), pid_of(ngit, "priya")))] == 0.7
    assert r[frozenset((pid_of(rce, "karan"), pid_of(rce, "meera")))] == 0.4
    assert r[frozenset((pid_of(rce, "vikram"), pid_of(rce, "meera")))] == 0.55


# ---------------------------------------------------------------- reveal rules
def test_card_masked_without_grant_then_open_with_grant(ngit):
    priya, aman = pid_of(ngit, "priya"), pid_of(ngit, "aman")
    r = ngit.get(f"/public/card/{priya}", headers=viewer(aman))
    assert r.status_code == 403
    body = r.json()
    assert body["name"] is None and body["masked"] is True and body["pid"] == priya
    assert ngit.get(f"/public/card/{priya}").status_code == 403  # anonymous too
    g = ngit.post("/reveal", json={"pid": priya, "viewer_pids": [aman]}, headers=HUB)
    assert g.status_code == 200
    r = ngit.get(f"/public/card/{priya}", headers=viewer(aman))
    assert r.status_code == 200 and r.json()["name"] == "Priya Sharma"
    assert int(r.headers["X-Setu-Identifying-Fields"]) >= 1
    # the grant is one-way, and does not extend to other viewers
    assert ngit.get(f"/public/card/{aman}", headers=viewer(priya)).status_code == 403
    assert ngit.get(f"/public/card/{priya}", headers=viewer(pid_of(ngit, "rohan"))).status_code == 403
    # a person can always see their own card
    assert ngit.get(f"/public/card/{priya}", headers=viewer(priya)).status_code == 200
    # a forged token is just an anonymous viewer
    bad = {"X-Setu-Viewer": sign_viewer("wrong-secret", aman, FAR)}
    assert ngit.get(f"/public/card/{priya}", headers=bad).status_code == 403
    stats = ngit.get("/stats", headers=HUB).json()
    assert stats["names_released"] == 1


def test_cards_batch_masks_by_default(ngit):
    store = ngit.app.state.ctx.store
    people = [p for p in store.people() if p["role"] in ("alum", "student")]
    board = next(p for p in people if p["on_leaderboard"] and p["story_key"] is None)
    hidden = next(p for p in people if not p["on_leaderboard"] and p["story_key"] is None)
    me = pid_of(ngit, "aman")
    r = ngit.post("/public/cards", json={"pids": [store.pid(board["local_id"]), store.pid(hidden["local_id"]), me]},
                  headers=viewer(me))
    out = {c["pid"]: c for c in r.json()}
    assert out[store.pid(board["local_id"])]["name"] == board["name"]
    assert out[store.pid(hidden["local_id"])]["name"] is None
    assert out[store.pid(hidden["local_id"])]["masked"] is True
    assert out[me]["name"] == "Aman Khanna"
    assert ngit.post("/public/cards", json={"pids": [me]}).status_code == 401


def test_asks_and_notes_follow_consent(ngit):
    aman, priya, rohan = pid_of(ngit, "aman"), pid_of(ngit, "priya"), pid_of(ngit, "rohan")
    assert ngit.post("/public/asks", json={"intro_id": "i1", "text": "Could you review my fintech project?",
                                           "work_url": "https://example.com/p"}, headers=viewer(aman)).status_code == 200
    assert ngit.get("/public/asks/i1", headers=viewer(aman)).status_code == 200
    assert ngit.get("/public/asks/i1", headers=viewer(priya)).status_code == 403
    ngit.post("/reveal", json={"pid": aman, "viewer_pids": [priya]}, headers=HUB)  # Aman consents to Priya
    r = ngit.get("/public/asks/i1", headers=viewer(priya))
    assert r.status_code == 200 and r.json()["work_url"] == "https://example.com/p"
    assert ngit.post("/public/asks/i1/notes", json={"text": "Happy to look."}, headers=viewer(priya)).status_code == 200
    assert ngit.post("/public/asks/i1/notes", json={"text": "no"}, headers=viewer(rohan)).status_code == 403
    notes = ngit.get("/public/asks/i1", headers=viewer(aman)).json()["notes"]
    assert [n["author_pid"] for n in notes] == [priya]
    assert ngit.post("/public/asks", json={"intro_id": "i1", "text": "hijack"}, headers=viewer(rohan)).status_code == 409


def test_me_endpoint(ngit):
    aman = pid_of(ngit, "aman")
    r = ngit.get("/public/me", headers=viewer(aman)).json()
    assert r == {"pid": aman, "skills": ["python", "ml"], "goal": "ML engineer at a fintech", "sem": 5, "branch": "ECE"}
    assert ngit.get("/public/me").status_code == 401


# ---------------------------------------------------------------- hub access switch
HUB_CALLS = [
    ("get", "/directory", None), ("get", "/edges", None), ("get", "/stats", None),
    ("post", "/vector", {"pid": "x"}), ("get", "/timeline/x", None),
    ("post", "/mirror", {"vector": [0] * 15, "sem": 5, "requester_node": "ngit"}),
    ("post", "/reveal", {"pid": "x", "viewer_pids": []}), ("post", "/reverse-mirror", {"pid": "x", "sem": 5}),
]


def _call(c, method, path, body, headers):
    return c.get(path, headers=headers) if method == "get" else c.post(path, json=body, headers=headers)


def test_hub_endpoints_require_token(ngit):
    for m, p, b in HUB_CALLS:
        assert _call(ngit, m, p, b, {}).status_code == 401
        assert _call(ngit, m, p, b, {"Authorization": "Bearer nope"}).status_code == 401


def test_hub_access_off_blocks_hub_and_mcp_but_not_health(ngit):
    assert ngit.post("/admin/hub-access", json={"on": False}, headers={"X-Admin-Password": "pw-test"}).status_code == 200
    for m, p, b in HUB_CALLS:
        r = _call(ngit, m, p, b, HUB)
        assert r.status_code == 503 and r.json() == {"error": "hub_access_revoked"}, p
    h = ngit.get("/health")
    assert h.status_code == 200 and h.json()["hub_access"] is False
    r = ngit.post("/mcp", headers=MCP_H, json={"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                                               "params": {"name": "college_stats", "arguments": {}}})
    res = r.json()["result"]
    assert res["isError"] is True and "This college has disconnected from Setu" in res["content"][0]["text"]
    ngit.post("/admin/hub-access", json={"on": True}, headers={"X-Admin-Password": "pw-test"})
    assert ngit.get("/directory", headers=HUB).status_code == 200


# ---------------------------------------------------------------- join + rate limit
def test_join_rejects_under_18(ngit):
    r = ngit.post("/public/join", json=join_body(is_18_plus=False))
    assert r.status_code == 400 and r.json()["error"] == "must_be_18_plus"
    assert ngit.post("/public/join", json=join_body(sem=None)).status_code == 400
    assert ngit.post("/public/join", json=join_body(branch="XYZ")).status_code == 400


def test_join_creates_person_and_snapshot(ngit):
    before = ngit.get("/health").json()["people"]
    r = ngit.post("/public/join", json=join_body(name="Zed Newcomer", sem=4, cgpa=8.3))
    assert r.status_code == 200
    out = r.json()
    assert out["pid"].startswith("ngit_") and out["public_card"]["pid"] == out["pid"]
    assert "name" not in out["public_card"]
    assert ngit.get("/health").json()["people"] == before + 1
    v = ngit.post("/vector", json={"pid": out["pid"]}, headers=HUB).json()
    assert v["sem"] == 4 and v["branch"] == "CSE" and v["vector"][5] == 0.83
    assert ngit.get(f"/public/card/{out['pid']}", headers=viewer(out["pid"])).json()["name"] == "Zed Newcomer"


def test_rate_limit_on_join(ngit):
    codes = [ngit.post("/public/join", json=join_body(name=f"P{i}")).status_code for i in range(12)]
    assert codes[:10] == [200] * 10
    assert codes[10:] == [429, 429]
    assert ngit.get("/health").status_code == 200  # reads are not limited


# ---------------------------------------------------------------- viewer token
def test_viewer_token_verify_and_expiry():
    pid = "ngit_abc123abc123"
    t = sign_viewer(VSECRET, pid, 2_000_000_000)
    assert "=" not in t and t.count(".") == 1
    assert verify_viewer(VSECRET, t, now=1_000_000_000) == pid
    assert verify_viewer(VSECRET, t, now=2_000_000_001) is None  # expired
    assert verify_viewer("other", t, now=1_000_000_000) is None  # wrong secret
    payload, sig = t.split(".")
    assert verify_viewer(VSECRET, payload + "." + sig[:-2] + "AA", now=1) is None  # tampered signature
    forged = sign_viewer(VSECRET, "ngit_other0000000", 2_000_000_000).split(".")[0] + "." + sig
    assert verify_viewer(VSECRET, forged, now=1) is None  # payload swapped
    assert verify_viewer(VSECRET, "", now=1) is None and verify_viewer(VSECRET, None, now=1) is None
    assert verify_viewer(VSECRET, "garbage", now=1) is None


def test_expired_token_rejected_over_http(ngit):
    aman = pid_of(ngit, "aman")
    assert ngit.get("/public/me", headers=viewer(aman, exp=int(time.time()) - 5)).status_code == 401


# ---------------------------------------------------------------- identifying-fields header
def test_identifying_fields_header_zero_on_hub_endpoints(ngit):
    aman = pid_of(ngit, "aman")
    v = ngit.post("/vector", json={"pid": aman}, headers=HUB)
    calls = [
        ngit.get("/directory", headers=HUB), ngit.get("/edges", headers=HUB),
        ngit.post("/mirror", json={"vector": v.json()["vector"], "sem": 5, "requester_node": "ngit"}, headers=HUB),
        ngit.get(f"/timeline/{aman}", headers=HUB), ngit.get("/stats", headers=HUB), v,
        ngit.post("/reverse-mirror", json={"pid": pid_of(ngit, "priya"), "sem": 5}, headers=HUB),
    ]
    for r in calls:
        assert r.status_code == 200
        assert r.headers["X-Setu-Identifying-Fields"] == "0", r.url
    # and the audit counter agrees
    state = ngit.get("/admin/api/state", headers={"X-Admin-Password": "pw-test"}).json()
    assert state["counters"]["identifying_fields_to_hub"] == 0 and state["counters"]["hub_calls"] >= len(calls)
    # the header is present on everything else too, and non-zero where a name is released
    assert ngit.get("/health").headers["X-Setu-Identifying-Fields"] == "0"
    assert ngit.get("/public/me", headers=viewer(aman)).headers["X-Setu-Identifying-Fields"] == "1"  # goal text


def test_directory_has_no_personal_fields(ngit):
    rows = ngit.get("/directory", headers=HUB).json()
    assert len(rows) == 44
    assert set(rows[0]) == {"pid", "story_key", "role", "branch_code", "grad_year", "public_title", "public_company",
                            "open_to_intros", "on_leaderboard"}
    assert {r["story_key"] for r in rows if r["story_key"]} == {sp["key"] for sp in story.NGIT_PEOPLE}
    assert ngit.get(f"/directory?pid={pid_of(ngit, 'aman')}", headers=HUB).json()[0]["story_key"] == "aman"
    blob = str(rows)
    assert "@seed.invalid" not in blob and "Aman" not in blob


def test_stats_only_reports_groups_of_two_or_more(rce):
    s = rce.get("/stats", headers=HUB).json()
    assert s["roles"]["alum"] == 26
    assert all(c["count"] >= 2 for c in s["top_companies"])
    assert {"company": "FinStack", "count": 3} in [c for c in s["top_companies"] if c["count"] >= 3] or any(
        c["company"] == "FinStack" for c in s["top_companies"])
    assert set(s) == {"roles", "outcomes", "top_companies", "students_per_year", "names_released"}


# ---------------------------------------------------------------- admin
def test_admin_console(ngit):
    page = ngit.get("/admin")
    assert page.status_code == 200 and "Northgate Institute of Technology" in page.text and "Setu" not in page.text
    assert ngit.get("/admin/api/state").status_code == 401
    ok = {"X-Admin-Password": "pw-test"}
    ngit.get("/directory", headers=HUB)
    s = ngit.get("/admin/api/state", headers=ok).json()
    assert s["people"] == 44 and s["hub_access"] is True and len(s["audit"]) <= 30
    assert any(a["caller"] == "hub" and a["action"] == "GET /directory" for a in s["audit"])
    assert ngit.post("/admin/reset").status_code == 401
    ngit.post("/public/join", json=join_body())
    assert ngit.get("/health").json()["people"] == 45
    assert ngit.post("/admin/reset", headers=ok).status_code == 200
    assert ngit.get("/health").json()["people"] == 44
    ngit.post("/public/join", json=join_body())
    assert ngit.post("/admin/reset", headers=HUB).status_code == 200  # hub token may also reset
    assert ngit.get("/health").json()["people"] == 44


def test_cors_allows_only_hub_origin(tmp_path):
    with TestClient(make("ngit", tmp_path)) as c:
        r = c.get("/health", headers={"Origin": "https://hub.example"})
        assert r.headers["access-control-allow-origin"] == "https://hub.example"
        assert "X-Setu-Identifying-Fields" in r.headers["access-control-expose-headers"]
        assert "access-control-allow-origin" not in c.get("/health", headers={"Origin": "https://evil.example"}).headers
        assert "access-control-allow-origin" not in c.get("/health", headers={"Origin": "http://localhost:3000"}).headers
    with TestClient(make("ngit", tmp_path, node_dev=True)) as c:
        assert c.get("/health", headers={"Origin": "http://localhost:3001"}).headers["access-control-allow-origin"] == "http://localhost:3001"


# ---------------------------------------------------------------- MCP
def rpc(c, method, params=None, id=1):
    return c.post("/mcp", headers=MCP_H, json={"jsonrpc": "2.0", "id": id, "method": method, "params": params or {}})


def test_mcp_requires_bearer(ngit):
    r = ngit.post("/mcp", headers={"Accept": "application/json, text/event-stream", "Content-Type": "application/json"},
                  json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    assert r.status_code == 401
    bad = dict(MCP_H, Authorization="Bearer wrong")
    assert ngit.post("/mcp", headers=bad, json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}).status_code == 401


def test_mcp_tools_list_and_calls(ngit):
    r = rpc(ngit, "tools/list")
    assert r.status_code == 200
    tools = {t["name"]: t for t in r.json()["result"]["tools"]}
    assert set(tools) == {"college_stats", "find_helpers", "match_need", "mirror_search", "get_timeline"}
    assert all("[tool-spec v1]" in t["description"] for t in tools.values())
    assert r.headers["X-Setu-Identifying-Fields"] == "0"

    def call(name, args):
        res = rpc(ngit, "tools/call", {"name": name, "arguments": args}).json()["result"]
        assert not res.get("isError"), res
        assert res["structuredContent"]["identifying_fields"] == 0
        return res["structuredContent"]

    stats = call("college_stats", {})
    assert stats["stats"]["roles"]["alum"] == 26
    helpers = call("find_helpers", {"company": "FinStack", "limit": 5})["helpers"]
    assert any(h["pid"] == pid_of(ngit, "priya") for h in helpers)
    assert all(set(h) == {"pid", "branch", "grad_year", "title", "company", "outcome", "outcome_tag"} for h in helpers)
    m = call("mirror_search", {"branch": "ECE", "sem": 5, "cgpa": 7.2, "internship": False, "projects": 2,
                               "hackathons": 1, "skills": ["python", "ml"], "goal": "ML engineer at a fintech"})["matches"]
    assert m[0]["pid"] == pid_of(ngit, "priya") and m[0]["score"] >= 0.9
    tl = call("get_timeline", {"pid": pid_of(ngit, "priya")})["timeline"]
    assert tl[-1]["org"] == "FinStack"
    assert "Aman" not in str(m) and "Priya" not in str(tl)
    bad = rpc(ngit, "tools/call", {"name": "get_timeline", "arguments": {"pid": "nope"}}).json()["result"]
    assert bad["isError"] is True
    # MCP calls land in the audit log under caller=mcp
    audit = ngit.get("/admin/api/state", headers={"X-Admin-Password": "pw-test"}).json()["audit"]
    assert any(a["caller"] == "mcp" and a["action"].startswith("mcp:tools/call") for a in audit)
