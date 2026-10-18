"""The professional node: people outside any college, matched by what they offer and what others need."""
import os
import sys
import time
from pathlib import Path

os.environ["SETU_NODE_NO_AUTOLOAD"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app as appmod  # noqa: E402
import match  # noqa: E402
import taxonomy  # noqa: E402
from seed import pro as pro_seed  # noqa: E402
from store import sign_viewer  # noqa: E402

HUB = {"Authorization": "Bearer hub-test"}
MCP_H = {"Authorization": "Bearer mcp-test", "Accept": "application/json, text/event-stream",
         "Content-Type": "application/json"}
VSECRET = "viewer-test"
FAR = int(time.time()) + 3600
NEED = "I am a doctor and I need a developer to build a patient follow-up app"


def make(college, tmp_path, **kw):
    cfg = appmod.Config.from_env(
        college_id=college, node_secret="node-test-secret", hub_token="hub-test", viewer_secret=VSECRET,
        mcp_token="mcp-test", admin_password="pw-test", hub_origin="https://hub.example",
        db_path=str(tmp_path / f"{college}.db"), **kw)
    return appmod.create_app(cfg)


@pytest.fixture()
def pro(tmp_path):
    with TestClient(make("pro", tmp_path)) as c:
        yield c


@pytest.fixture()
def ngit(tmp_path):
    with TestClient(make("ngit", tmp_path)) as c:
        yield c


def pid_of(client, key):
    return client.app.state.ctx.store.pid(pro_seed.local_id(key))


def viewer(pid):
    return {"X-Setu-Viewer": sign_viewer(VSECRET, pid, FAR)}


def prof_join(**over):
    b = {"name": "Dr. Test Person", "role": "professional", "domain": "healthcare", "title": "Physician",
         "company": "Lotus Clinic", "years_exp": 9, "offers": ["healthcare"], "needs": ["software"],
         "open_to": ["intros", "advice"], "city": "Pune", "about": "Needs a developer.", "open_to_intros": True,
         "on_leaderboard": True, "is_18_plus": True}
    b.update(over)
    return b


# ---------------------------------------------------------------- the query parser
def test_parser_looks_at_what_you_need_not_what_you_are():
    p = match.parse_need(NEED)
    assert p["primary"] == ["software"]
    assert "healthcare" in p["secondary"] or "healthcare" in p["context"]
    assert match.parse_need("need a startup lawyer")["primary"] == ["law", "entrepreneurship"]
    assert match.parse_need("mujhe ek designer chahiye")["primary"] == ["design"]
    assert match.parse_need("someone who knows machine learning")["primary"] == ["ai-ml"]
    assert match.parse_need("hello")["primary"] == []


def test_every_synonym_belongs_to_a_known_domain():
    assert set(taxonomy.SYNONYMS) == set(taxonomy.DOMAINS)
    assert set(taxonomy.DOMAIN_LABEL) == set(taxonomy.DOMAINS)


# ---------------------------------------------------------------- the dataset
def test_pro_seed_is_deterministic_and_sized():
    a, b = pro_seed.build(), pro_seed.build()
    assert a == b
    assert 40 <= len(a["people"]) <= 60
    assert {p["role"] for p in a["people"]} == {"professional"}
    assert len({p["name"] for p in a["people"]}) == len(a["people"])
    assert {p["story_key"] for p in a["people"] if p["story_key"]} == {"ananya", "rahul", "ishaan", "meenakshi", "zoya"}
    assert {d for pr in a["profiles"] for d in [pr["domain"]]} == set(taxonomy.DOMAINS)


def test_story_edges_exact_and_story_people_stay_weakly_connected_otherwise(tmp_path):
    ds = pro_seed.build()
    pairs = {frozenset((a, b)): p for a, b, p in ds["edges"]}
    assert pairs[frozenset(("pro-ananya", "pro-rahul"))] == 0.85
    assert pairs[frozenset(("pro-rahul", "pro-ishaan"))] == 0.70
    assert pairs[frozenset(("pro-ananya", "pro-ishaan"))] == 0.20
    story_ids = {f"pro-{k}" for k in ("ananya", "rahul", "ishaan", "meenakshi", "zoya")}
    story_pairs = {frozenset((f"pro-{a}", f"pro-{b}")) for a, b, _ in pro_seed.STORY_EDGES}
    for pair, p in pairs.items():
        if pair & story_ids and pair not in story_pairs:
            assert p <= 0.28, (pair, p)


def test_directory_shows_field_title_company_only(pro):
    d = pro.get("/directory", headers=HUB)
    assert d.status_code == 200 and d.headers["X-Setu-Identifying-Fields"] == "0"
    rows = {r["pid"]: r for r in d.json()}
    ananya = rows[pid_of(pro, "ananya")]
    assert ananya["role"] == "professional" and ananya["branch_code"] == "healthcare"
    assert ananya["public_title"] == "Cardiologist" and ananya["public_company"] == "Sunrise Heart Institute"
    assert "Ananya" not in str(d.json()) and "Rao" not in str(d.json())


# ---------------------------------------------------------------- matching
def _match(client, query, **kw):
    r = client.post("/match", headers=HUB, json={"query": query, "limit": kw.pop("limit", 6), **kw})
    assert r.status_code == 200
    assert r.headers["X-Setu-Identifying-Fields"] == "0"
    return r.json()


def test_a_doctor_needing_a_developer_finds_the_health_app_developer_first(pro):
    rows = _match(pro, NEED)
    assert rows[0]["pid"] == pid_of(pro, "ishaan")
    assert rows[0]["score"] >= 0.85
    assert any("Software" in r for r in rows[0]["reasons"])
    # other doctors do not appear as the answer to "I need a developer"
    assert all("software" in r["offers"] for r in rows)
    assert rows[1]["score"] < rows[0]["score"]


def test_other_needs_find_other_professions(pro):
    assert _match(pro, "I need a startup lawyer")[0]["pid"] == pid_of(pro, "meenakshi")
    designers = _match(pro, "looking for a UI designer for my app")
    assert designers[0]["domain"] in ("design", "software") and "design" in designers[0]["offers"]
    assert _match(pro, "hello there") == []


def test_matching_never_returns_names_or_free_text(pro):
    for r in _match(pro, NEED):
        assert set(r) == {"pid", "score", "domain", "title", "company", "years_exp", "grad_year", "role", "offers",
                          "open_to", "reasons"}
    assert "Ishaan" not in str(_match(pro, NEED)) and "patient-reminder" not in str(_match(pro, NEED))


def test_people_who_opted_out_of_intros_never_match(pro):
    store = pro.app.state.ctx.store
    hidden = [store.pid(p["local_id"]) for p in store.people() if not p["open_to_intros"]]
    assert hidden, "the seed should include someone who is not open to intros"
    shown = {r["pid"] for q in ("developer", "lawyer", "doctor", "designer", "founder") for r in _match(pro, f"need a {q}", limit=25)}
    assert not shown & set(hidden)


def test_college_nodes_match_their_alumni_too(ngit):
    rows = _match(ngit, "I need an ML engineer for a fintech product")
    assert rows and all(r["role"] == "alum" for r in rows)
    assert rows[0]["pid"] == ngit.app.state.ctx.store.pid("ngit-priya")


def test_match_needs_the_hub_token_and_respects_the_kill_switch(pro):
    assert pro.post("/match", json={"query": "developer"}).status_code == 401
    assert pro.post("/match", headers={"Authorization": "Bearer wrong"}, json={"query": "developer"}).status_code == 401
    assert pro.post("/admin/hub-access", headers={"X-Admin-Password": "pw-test"}, json={"on": False}).status_code == 200
    assert pro.post("/match", headers=HUB, json={"query": "developer"}).status_code == 503
    assert pro.get("/health").status_code == 200


# ---------------------------------------------------------------- joining as a professional
def test_a_professional_can_join_and_is_then_findable(pro):
    r = pro.post("/public/join", json=prof_join(name="Dr. Kavita Menon", domain="healthcare", title="Dermatologist",
                                                 offers=["healthcare", "research"], needs=["software", "design"]))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["pid"].startswith("pro_")
    assert body["public_card"]["role"] == "professional" and body["public_card"]["branch_code"] == "healthcare"
    assert body["public_card"]["public_title"] == "Dermatologist"
    assert "Kavita" not in str(body)
    found = _match(pro, "need a researcher who knows clinical work", limit=25)
    assert body["pid"] in {x["pid"] for x in found}


def test_me_returns_the_professionals_own_needs(pro):
    pid = pro.post("/public/join", json=prof_join()).json()["pid"]
    me = pro.get("/public/me", headers=viewer(pid)).json()
    assert me["role"] == "professional" and me["needs"] == ["software"] and me["domain"] == "healthcare"
    ananya = pid_of(pro, "ananya")
    story_me = pro.get("/public/me", headers=viewer(ananya)).json()
    assert story_me["needs"] == ["software", "ai-ml"] and "patient follow-up app" in story_me["about"]


def test_unknown_tags_are_dropped_and_domain_is_required(pro):
    ok = pro.post("/public/join", json=prof_join(offers=["healthcare", "wizardry"], open_to=["intros", "nonsense"]))
    assert ok.status_code == 200
    me = pro.get("/public/me", headers=viewer(ok.json()["pid"])).json()
    assert me["offers"] == ["healthcare"] and me["open_to"] == ["intros"]
    assert pro.post("/public/join", json=prof_join(domain="astrology")).status_code == 400
    assert pro.post("/public/join", json=prof_join(title="  ")).status_code == 400
    assert pro.post("/public/join", json=prof_join(is_18_plus=False)).status_code == 400


def test_masked_professional_card_shows_title_and_company_but_no_name(pro):
    pid = pid_of(pro, "ishaan")
    r = pro.get(f"/public/card/{pid}")
    assert r.status_code == 403
    assert r.json()["name"] is None and r.json()["title"] == "Full-stack & ML Developer"
    assert r.json()["company"] == "Pulse Digital"


def test_college_join_still_requires_branch_and_cgpa(ngit):
    base = {"name": "Test Person", "role": "student", "sem": 3, "internship": False, "projects": 1, "hackathons": 0,
            "skills": ["python"], "open_to_intros": True, "on_leaderboard": False, "is_18_plus": True}
    assert ngit.post("/public/join", json={**base, "cgpa": 7.9}).status_code == 400
    assert ngit.post("/public/join", json={**base, "branch": "CSE"}).status_code == 400
    assert ngit.post("/public/join", json={**base, "branch": "CSE", "cgpa": 7.9}).status_code == 200


# ---------------------------------------------------------------- MCP
def test_mcp_match_need_finds_the_developer_and_reports_zero_identifying_fields(pro):
    def rpc(method, params=None):
        return pro.post("/mcp", headers=MCP_H, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}})

    tools = {t["name"] for t in rpc("tools/list").json()["result"]["tools"]}
    assert "match_need" in tools
    res = rpc("tools/call", {"name": "match_need", "arguments": {"need": NEED, "limit": 3}}).json()["result"]
    assert not res.get("isError"), res
    data = res["structuredContent"]
    assert data["identifying_fields"] == 0
    assert data["people"][0]["pid"] == pid_of(pro, "ishaan")
    assert "Ishaan" not in str(data)
    empty = rpc("tools/call", {"name": "match_need", "arguments": {"need": "   "}}).json()["result"]
    assert empty["isError"] is True
