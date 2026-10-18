"""Setu Node: one college's alumni records behind a pseudonymous HTTP contract.

Run:  COLLEGE_ID=ngit uvicorn app:app --port 8001
"""
from __future__ import annotations

import contextlib
import hmac
import html
import json
import os
import sys
import time
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Literal

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field
from starlette.datastructures import Headers, MutableHeaders

import match
import mirror
import taxonomy
from mcp_tools import build_mcp
from seed import generate, story
from seed import pro as pro_seed
from store import PUBLIC_ROLES, Store, grad_year_for_sem, utcnow, verify_viewer


def dataset_for(college_id: str) -> dict:
    """The seed data for this node: the professional node has its own, colleges use the generator."""
    return pro_seed.build() if college_id == "pro" else generate.build(college_id)

VERSION = "1.0.0"
HERE = Path(__file__).parent
IDENT_KEYS = {"name", "email", "phone", "cgpa", "headline", "text", "goal", "work_url"}


# ---------------------------------------------------------------- config
@dataclass
class Config:
    college_id: str
    college_name: str
    college_city: str
    node_secret: str
    hub_token: str
    viewer_secret: str
    mcp_token: str
    admin_password: str
    hub_origin: str
    public_url: str
    node_dev: bool
    db_path: str
    trust_proxy: bool

    @classmethod
    def from_env(cls, **over) -> "Config":
        env = os.environ
        cid = (over.get("college_id") or env.get("COLLEGE_ID") or "ngit").lower()
        if cid not in story.NODE_NAMES:
            raise SystemExit(f"COLLEGE_ID must be one of {sorted(story.NODE_NAMES)}, got {cid!r}")
        dname, dcity = story.NODE_NAMES[cid]
        dev_defaults = {
            "NODE_SECRET": f"dev-node-secret-{cid}",
            "HUB_TOKEN": "dev-hub-token",
            "VIEWER_SECRET": "dev-viewer-secret",
            "MCP_TOKEN": "dev-mcp-token",
            "ADMIN_PASSWORD": "admin",
            "HUB_ORIGIN": "http://localhost:3000",
        }
        missing = [k for k in dev_defaults if not env.get(k) and k.lower() not in over]
        if missing:
            print(f"[setu-node] WARNING: {', '.join(missing)} not set, using insecure dev defaults", file=sys.stderr)

        def pick(key, field=None):
            f = field or key.lower()
            return over[f] if f in over else (env.get(key) or dev_defaults.get(key, ""))

        return cls(
            college_id=cid,
            college_name=over.get("college_name") or env.get("COLLEGE_NAME") or dname,
            college_city=over.get("college_city") or env.get("COLLEGE_CITY") or dcity,
            node_secret=pick("NODE_SECRET"),
            hub_token=pick("HUB_TOKEN"),
            viewer_secret=pick("VIEWER_SECRET"),
            mcp_token=pick("MCP_TOKEN"),
            admin_password=pick("ADMIN_PASSWORD"),
            hub_origin=pick("HUB_ORIGIN"),
            public_url=over.get("public_url") or env.get("PUBLIC_URL") or "",
            node_dev=bool(over["node_dev"]) if "node_dev" in over else env.get("NODE_DEV") == "1",
            db_path=over.get("db_path") or env.get("DB_PATH") or "./setu.db",
            trust_proxy=bool(over["trust_proxy"]) if "trust_proxy" in over else env.get("TRUST_PROXY") == "1",
        )


# ---------------------------------------------------------------- helpers
class ApiError(Exception):
    def __init__(self, status: int, error: str, **extra):
        self.status, self.payload = status, {"error": error, **extra}


def count_identifying(obj) -> int:
    """Count name/email/phone/exact-cgpa/free-text fields actually present in a response body."""
    n = 0
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in IDENT_KEYS and v not in (None, "", False) and not isinstance(v, (dict, list)):
                n += 1
            else:
                n += count_identifying(v)
    elif isinstance(obj, list):
        for v in obj:
            n += count_identifying(v)
    return n


class RateLimiter:
    def __init__(self, limit: int = 10, window: float = 60.0):
        self.limit, self.window = limit, window
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self.lock:
            dq = self.hits[key]
            while dq and now - dq[0] > self.window:
                dq.popleft()
            if len(dq) >= self.limit:
                return False
            dq.append(now)
            return True

    def reset(self):
        with self.lock:
            self.hits.clear()


def _eq(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def _bearer(headers) -> str:
    h = headers.get("authorization", "")
    return h[7:].strip() if h.lower().startswith("bearer ") else ""


class Ctx:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.store = Store(cfg.db_path, cfg.college_id, cfg.node_secret)
        self.store.ensure_seeded(lambda: dataset_for(cfg.college_id))
        self.limiter = RateLimiter(10, 60.0)


# ---------------------------------------------------------------- audit + header middleware
class AuditMiddleware:
    """Sets X-Setu-Identifying-Fields on every response and writes one audit row per request.

    Handlers record request.state.idf (count of identifying fields in the body) and optionally
    request.state.action. Also enforces the MCP bearer token.
    """

    def __init__(self, app, ctx: Ctx):
        self.app, self.ctx = app, ctx

    @staticmethod
    def caller_for(path: str, headers: Headers) -> str:
        if path.startswith("/public"):
            return "browser"
        if path.startswith("/admin"):
            return "admin"
        if path.startswith("/mcp"):
            return "mcp"
        if path == "/health":
            return "hub" if headers.get("authorization") else "browser"
        return "hub"

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] == "OPTIONS":
            return await self.app(scope, receive, send)
        state = scope.setdefault("state", {})
        path, method = scope["path"], scope["method"]
        headers = Headers(scope=scope)
        caller = self.caller_for(path, headers)
        quiet = path == "/admin" or path == "/admin/api/state"
        body = bytearray()

        async def recv():
            m = await receive()
            if caller == "mcp" and m["type"] == "http.request" and len(body) < 65536:
                body.extend(m.get("body", b""))
            return m

        async def snd(m):
            if m["type"] == "http.response.start":
                idf = int(state.get("idf", 0))
                MutableHeaders(scope=m)["X-Setu-Identifying-Fields"] = str(idf)
                if not quiet:
                    action = state.get("action") or f"{method} {path}"
                    if caller == "mcp" and body:
                        action = self._mcp_action(bytes(body)) or action
                    try:
                        self.ctx.store.audit(caller, action, idf, f"status {m['status']}")
                    except Exception as exc:  # never fail a request because of the audit log
                        print(f"[setu-node] audit write failed: {exc}", file=sys.stderr)
            await send(m)

        if caller == "mcp" and not _eq(_bearer(headers), self.ctx.cfg.mcp_token):
            resp = JSONResponse({"error": "unauthorized"}, status_code=401, headers={"WWW-Authenticate": "Bearer"})
            state["action"] = "mcp:unauthorized"
            return await resp(scope, recv, snd)
        await self.app(scope, recv, snd)

    @staticmethod
    def _mcp_action(raw: bytes) -> str | None:
        try:
            msg = json.loads(raw)
        except Exception:
            return None
        msgs = msg if isinstance(msg, list) else [msg]
        parts = []
        for m in msgs:
            if isinstance(m, dict) and m.get("method"):
                name = (m.get("params") or {}).get("name") if m["method"] == "tools/call" else None
                parts.append(f"mcp:{m['method']}" + (f" {name}" if name else ""))
        return ", ".join(parts) or None


# ---------------------------------------------------------------- request models
class JoinBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    role: Literal["student", "alum", "professional"]
    # students and alumni give a branch and CGPA; professionals give a field, offers and needs instead
    branch: Literal["CSE", "IT", "ECE", "ME", "AIML"] | None = None
    sem: int | None = Field(None, ge=1, le=8)
    grad_year: int | None = Field(None, ge=1990, le=2040)
    cgpa: float | None = Field(None, ge=0, le=10)
    domain: str | None = Field(None, max_length=30)
    specialty: str | None = Field(None, max_length=80)
    years_exp: int | None = Field(None, ge=0, le=60)
    offers: list[str] = Field(default_factory=list, max_length=8)
    needs: list[str] = Field(default_factory=list, max_length=8)
    open_to: list[str] = Field(default_factory=list, max_length=6)
    city: str | None = Field(None, max_length=60)
    about: str | None = Field(None, max_length=400)
    internship: bool = False
    projects: int = Field(0, ge=0, le=50)
    hackathons: int = Field(0, ge=0, le=50)
    skills: list[str] = Field(default_factory=list, max_length=12)
    goal: str | None = Field(None, max_length=200)
    company: str | None = Field(None, max_length=80)
    title: str | None = Field(None, max_length=80)
    open_to_intros: bool = False
    on_leaderboard: bool = False
    is_18_plus: bool


class CardsBody(BaseModel):
    pids: list[str] = Field(max_length=200)


class AskBody(BaseModel):
    intro_id: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=2000)
    work_url: str | None = Field(None, max_length=500)


class NoteBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class PidBody(BaseModel):
    pid: str


class MirrorBody(BaseModel):
    vector: list[float] = Field(min_length=15, max_length=15)
    sem: int = Field(ge=1, le=8)
    requester_node: str = ""
    branch: str | None = None
    goal_tag: str | None = None
    limit: int = Field(5, ge=1, le=50)


class RevealBody(BaseModel):
    pid: str
    viewer_pids: list[str] = Field(max_length=500)


class MatchBody(BaseModel):
    query: str = Field("", max_length=300)
    tags: list[str] = Field(default_factory=list, max_length=8)
    limit: int = Field(6, ge=1, le=25)
    exclude_pid: str | None = None


class ReverseBody(BaseModel):
    pid: str
    sem: int = Field(ge=1, le=8)
    limit: int = Field(3, ge=1, le=20)


class HubAccessBody(BaseModel):
    on: bool


# ---------------------------------------------------------------- app factory
def create_app(cfg: Config | None = None, **overrides) -> FastAPI:
    cfg = cfg or Config.from_env(**overrides)
    ctx = Ctx(cfg)
    store = ctx.store
    mcp = build_mcp(ctx)
    mcp_app = mcp.streamable_http_app()

    @contextlib.asynccontextmanager
    async def lifespan(_app):
        async with mcp.session_manager.run():
            yield

    app = FastAPI(title=f"Setu Node ({cfg.college_id})", version=VERSION, lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)
    app.state.ctx = ctx

    # ---- errors
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError):
        request.state.idf = 0
        return JSONResponse(exc.payload, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        request.state.idf = 0
        errs = [{"loc": [str(x) for x in e["loc"]], "msg": e["msg"]} for e in exc.errors()]
        return JSONResponse({"error": "invalid_request", "detail": errs}, status_code=400)

    def respond(request: Request, data, status: int = 200, idf: int | None = None, action: str | None = None):
        request.state.idf = count_identifying(data) if idf is None else idf
        if action:
            request.state.action = action
        return JSONResponse(data, status_code=status)

    # ---- guards
    def client_ip(request: Request) -> str:
        if cfg.trust_proxy:
            xff = request.headers.get("x-forwarded-for")
            if xff:
                return xff.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def write_limit(request: Request):
        if not ctx.limiter.allow(client_ip(request)):
            raise ApiError(429, "rate_limited")

    def hub_guard(request: Request):
        if not _eq(_bearer(request.headers), cfg.hub_token):
            raise ApiError(401, "unauthorized")
        if not store.hub_access:
            raise ApiError(503, "hub_access_revoked")

    def viewer_of(request: Request) -> str | None:
        return verify_viewer(cfg.viewer_secret, request.headers.get("x-setu-viewer"))

    def need_viewer(request: Request) -> str:
        v = viewer_of(request)
        if not v:
            raise ApiError(401, "invalid_viewer_token")
        return v

    def admin_ok(request: Request) -> bool:
        return _eq(request.headers.get("x-admin-password", ""), cfg.admin_password)

    def need_admin(request: Request):
        if not admin_ok(request):
            raise ApiError(401, "bad_admin_password")

    # ================================================================ health
    @app.get("/health")
    def health(request: Request):
        return respond(request, {
            "node": cfg.college_id, "name": cfg.college_name, "city": cfg.college_city,
            "people": store.count_people(), "hub_access": store.hub_access, "version": VERSION, "time": utcnow(),
        }, idf=0)

    # ================================================================ public (browser -> node)
    @app.post("/public/join")
    def join(request: Request, body: JoinBody, _=Depends(write_limit)):
        if not body.is_18_plus:
            raise ApiError(400, "must_be_18_plus")
        if body.role == "professional":
            return join_professional(request, body)
        if body.branch is None:
            raise ApiError(400, "branch_required")
        if body.cgpa is None:
            raise ApiError(400, "cgpa_required")
        if body.role == "student" and body.sem is None:
            raise ApiError(400, "sem_required")
        if body.role == "alum" and body.grad_year is None:
            raise ApiError(400, "grad_year_required")
        skills = [s.lower() for s in dict.fromkeys(body.skills) if s.lower() in mirror.SKILLS]
        lid = "join-" + uuid.uuid4().hex[:12]
        if body.role == "student":
            sem, grad = body.sem, grad_year_for_sem(body.sem)
            snaps = [{"local_id": lid, "sem": sem, "year": grad - 4 + sem // 2, "cgpa": body.cgpa,
                      "internship": int(body.internship), "projects": body.projects, "hackathons": body.hackathons,
                      "skills": skills, "label": f"Sem {sem}: joined Setu"}]
            title = company = None
            headline = f"{body.branch} student, sem {sem}"
            current_sem = sem
        else:
            grad, current_sem = body.grad_year, None
            snaps = [{"local_id": lid, "sem": 8, "year": grad, "cgpa": body.cgpa, "internship": int(body.internship),
                      "projects": body.projects, "hackathons": body.hackathons, "skills": skills,
                      "label": f"Sem 8: {body.projects} projects, {body.hackathons} hackathons"}]
            title, company = body.title, body.company
            if title or company:
                snaps.append({"local_id": lid, "sem": max(grad, 2000), "year": grad, "cgpa": None, "internship": 0,
                              "projects": 0, "hackathons": 0, "skills": [],
                              "label": f"{title or 'Role'} at {company}" if company else (title or ""),
                              "decision": "job", "org": company})
            tail = f"{title} at {company}" if title and company else (title or company or "Alum")
            headline = f"{tail} · {body.branch} '{str(grad)[2:]}"
        store.add_person({
            "local_id": lid, "name": body.name.strip(), "role": body.role, "branch": body.branch, "grad_year": grad,
            "current_sem": current_sem, "cgpa": body.cgpa, "skills": skills, "goal": body.goal, "company": company,
            "title": title, "headline": headline, "open_to_intros": body.open_to_intros,
            "on_leaderboard": body.on_leaderboard,
        }, snaps)
        pid = store.pid(lid)
        return respond(request, {"pid": pid, "public_card": store.directory(pid)[0]}, idf=0, action="join")

    def join_professional(request: Request, body: JoinBody):
        """A professional joins this node directly: no college, no CGPA. Offers and needs use the shared tags."""
        domain = (body.domain or "").lower()
        if domain not in taxonomy.DOMAINS:
            raise ApiError(400, "domain_required")
        if not (body.title or "").strip():
            raise ApiError(400, "title_required")
        offers = [t for t in dict.fromkeys(o.lower() for o in body.offers) if t in taxonomy.DOMAINS]
        needs = [t for t in dict.fromkeys(n.lower() for n in body.needs) if t in taxonomy.DOMAINS]
        open_to = [t for t in dict.fromkeys(o.lower() for o in body.open_to) if t in taxonomy.OPEN_TO]
        if not offers:
            offers = [domain]
        title, company = body.title.strip(), (body.company or "").strip() or None
        years = body.years_exp if body.years_exp is not None else 0
        lid = "join-" + uuid.uuid4().hex[:12]
        headline = f"{title} at {company} · {taxonomy.DOMAIN_LABEL[domain]}" if company else f"{title} · {taxonomy.DOMAIN_LABEL[domain]}"
        start = max(2026 - years, 1970)
        snaps = [
            {"local_id": lid, "sem": start, "year": start, "cgpa": None, "internship": 0, "projects": 0, "hackathons": 0,
             "skills": [], "label": f"Started in {taxonomy.DOMAIN_LABEL[domain].lower()}"},
            {"local_id": lid, "sem": 2025, "year": 2025, "cgpa": None, "internship": 0, "projects": 0, "hackathons": 0,
             "skills": [], "decision": "job", "org": company, "label": f"{title}" + (f" at {company}" if company else "")},
        ]
        store.add_person({
            "local_id": lid, "name": body.name.strip(), "role": "professional", "branch": None, "grad_year": None,
            "current_sem": None, "cgpa": None, "skills": [], "goal": None, "company": company, "title": title,
            "headline": headline, "open_to_intros": body.open_to_intros, "on_leaderboard": body.on_leaderboard,
        }, snaps)
        store.add_profile(lid, {"domain": domain, "specialty": (body.specialty or title)[:80], "years_exp": years,
                                "offers": offers, "needs": needs, "open_to": open_to, "city": body.city, "about": body.about})
        pid = store.pid(lid)
        return respond(request, {"pid": pid, "public_card": store.directory(pid)[0]}, idf=0, action="join:professional")

    def masked_card(p: dict) -> dict:
        public = p["role"] in PUBLIC_ROLES
        return {"pid": store.pid(p["local_id"]), "name": None, "headline": None,
                "title": p["title"] if public else None, "company": p["company"] if public else None,
                "branch": p["branch"], "grad_year": p["grad_year"], "masked": True}

    def full_card(p: dict) -> dict:
        return {"pid": store.pid(p["local_id"]), "name": p["name"], "headline": p["headline"],
                "title": p["title"], "company": p["company"], "branch": p["branch"], "grad_year": p["grad_year"],
                "masked": False}

    @app.get("/public/card/{pid}")
    def card(pid: str, request: Request):
        p = store.person_by_pid(pid)
        if not p:
            raise ApiError(404, "not_found")
        viewer = viewer_of(request)
        if viewer and (viewer == pid or store.has_reveal(pid, viewer)):
            data = full_card(p)
            if viewer != pid:
                store.record_release(pid, viewer)
                return respond(request, data, action="release:card")
            return respond(request, data, action="card:self")
        return respond(request, masked_card(p), status=403, action="card:masked")

    @app.post("/public/cards")
    def cards(request: Request, body: CardsBody):
        viewer = need_viewer(request)
        out, released = [], 0
        for pid in dict.fromkeys(body.pids):
            p = store.person_by_pid(pid)
            if not p:
                out.append({"pid": pid, "name": None, "masked": True})
                continue
            show = viewer == pid or bool(p["on_leaderboard"]) or store.has_reveal(pid, viewer)
            out.append({"pid": pid, "name": p["name"] if show else None, "masked": not show})
            if show and viewer != pid:
                store.record_release(pid, viewer)
                released += 1
        return respond(request, out, action="release:cards" if released else "cards:masked")

    @app.get("/public/me")
    def me(request: Request):
        viewer = need_viewer(request)
        p = store.person_by_pid(viewer)
        if not p:
            raise ApiError(404, "not_found")
        data = {"pid": viewer, "skills": p["skills"], "goal": p["goal"], "sem": p["current_sem"], "branch": p["branch"]}
        if p["role"] == "professional":
            # your own words about what you offer and need: read on your own device, to prefill your search
            prof = store.profile(p["local_id"]) or {}
            data["role"] = "professional"
            data.update({k: prof.get(k) for k in ("domain", "offers", "needs", "open_to", "city", "about", "years_exp")})
        return respond(request, data, action="me")

    @app.post("/public/asks")
    def post_ask(request: Request, body: AskBody, _=Depends(write_limit)):
        viewer = need_viewer(request)
        if body.work_url and not body.work_url.lower().startswith(("http://", "https://")):
            raise ApiError(400, "work_url_must_be_http")
        if not store.upsert_ask(body.intro_id, viewer, body.text, body.work_url):
            raise ApiError(409, "intro_id_taken")
        return respond(request, {"ok": True, "intro_id": body.intro_id}, idf=0, action="ask:write")

    def ask_access(intro_id: str, viewer: str) -> dict:
        ask = store.get_ask(intro_id)
        if not ask:
            raise ApiError(404, "not_found")
        if viewer != ask["requester_pid"] and not store.has_reveal(ask["requester_pid"], viewer):
            raise ApiError(403, "not_permitted")
        return ask

    @app.get("/public/asks/{intro_id}")
    def get_ask(intro_id: str, request: Request):
        viewer = need_viewer(request)
        ask = ask_access(intro_id, viewer)
        data = {"intro_id": intro_id, "requester_pid": ask["requester_pid"], "text": ask["text"],
                "work_url": ask["work_url"], "notes": store.notes(intro_id)}
        return respond(request, data, action="ask:read" if viewer == ask["requester_pid"] else "release:ask")

    @app.post("/public/asks/{intro_id}/notes")
    def post_note(intro_id: str, request: Request, body: NoteBody, _=Depends(write_limit)):
        viewer = need_viewer(request)
        ask_access(intro_id, viewer)
        store.add_note(intro_id, viewer, body.text)
        return respond(request, {"ok": True}, idf=0, action="ask:note")

    # ================================================================ hub -> node
    @app.get("/directory")
    def directory(request: Request, pid: str | None = None, _=Depends(hub_guard)):
        return respond(request, store.directory(pid))

    @app.get("/edges")
    def edges(request: Request, _=Depends(hub_guard)):
        return respond(request, store.edges())

    @app.post("/vector")
    def vector(request: Request, body: PidBody, _=Depends(hub_guard)):
        p = store.person_by_pid(body.pid)
        if not p:
            raise ApiError(404, "not_found")
        got = mirror.student_vector(store, p) if p["role"] == "student" else None
        if not got:
            raise ApiError(404, "no_current_snapshot")
        return respond(request, {"vector": got[0], "sem": p["current_sem"], "branch": p["branch"],
                                 "goal_tag": mirror.goal_tag(p["goal"])})

    @app.post("/mirror")
    def mirror_ep(request: Request, body: MirrorBody, _=Depends(hub_guard)):
        rows = mirror.mirror_query(store, body.vector, body.sem, body.requester_node, body.branch,
                                   body.goal_tag, body.limit)
        return respond(request, rows)

    @app.post("/match")
    def match_ep(request: Request, body: MatchBody, _=Depends(hub_guard)):
        """Who here can help with this need? Public fields only: field, title, company, offer tags, reasons."""
        return respond(request, match.rank(store, body.query, body.tags, body.limit, body.exclude_pid))

    @app.get("/timeline/{pid}")
    def timeline(pid: str, request: Request, _=Depends(hub_guard)):
        p = store.person_by_pid(pid)
        if not p:
            raise ApiError(404, "not_found")
        return respond(request, store.timeline(p["local_id"]))

    @app.post("/reveal")
    def reveal(request: Request, body: RevealBody, _=Depends(hub_guard)):
        if not store.person_by_pid(body.pid):
            raise ApiError(404, "not_found")
        store.add_reveals(body.pid, list(dict.fromkeys(body.viewer_pids)))
        return respond(request, {"ok": True, "granted": len(set(body.viewer_pids))}, idf=0)

    @app.post("/reverse-mirror")
    def reverse(request: Request, body: ReverseBody, _=Depends(hub_guard)):
        rows = mirror.reverse_mirror_query(store, body.pid, body.sem, body.limit)
        if rows is None:
            raise ApiError(404, "not_found")
        return respond(request, rows)

    @app.get("/stats")
    def stats(request: Request, _=Depends(hub_guard)):
        return respond(request, store.stats())

    # ================================================================ admin console
    def do_reset():
        store.reseed(lambda: dataset_for(cfg.college_id))
        ctx.limiter.reset()

    @app.post("/admin/reset")
    @app.post("/admin/api/reset")
    def admin_reset(request: Request):
        if not (admin_ok(request) or _eq(_bearer(request.headers), cfg.hub_token)):
            raise ApiError(401, "unauthorized")
        do_reset()
        return respond(request, {"ok": True, "people": store.count_people()}, idf=0, action="admin:reset")

    @app.get("/admin", response_class=HTMLResponse)
    def admin_page(request: Request):
        request.state.idf = 0
        page = (HERE / "admin.html").read_text(encoding="utf-8")
        for k, v in {"__COLLEGE_NAME__": cfg.college_name, "__COLLEGE_CITY__": cfg.college_city,
                     "__COLLEGE_ID__": cfg.college_id}.items():
            page = page.replace(k, html.escape(v))
        return HTMLResponse(page, headers={"Cache-Control": "no-store"})

    @app.get("/admin/api/state")
    def admin_state(request: Request):
        need_admin(request)
        url = cfg.public_url or str(request.base_url).rstrip("/")
        return respond(request, {
            "college": {"id": cfg.college_id, "name": cfg.college_name, "city": cfg.college_city},
            "url": url, "people": store.count_people(), "hub_access": store.hub_access,
            "counters": store.counters(), "audit": store.audit_tail(30), "time": utcnow(),
        }, idf=0)

    @app.post("/admin/hub-access")
    @app.post("/admin/api/hub-access")
    def admin_hub_access(request: Request, body: HubAccessBody):
        need_admin(request)
        store.set_hub_access(body.on)
        return respond(request, {"ok": True, "hub_access": store.hub_access}, idf=0,
                       action="admin:hub_access_" + ("on" if body.on else "off"))

    # ================================================================ MCP (mounted last: catch-all)
    app.mount("/", mcp_app)

    # ================================================================ middleware (last added = outermost)
    app.add_middleware(AuditMiddleware, ctx=ctx)
    origins = [cfg.hub_origin] if cfg.hub_origin else []
    if cfg.node_dev:
        origins += ["http://localhost:3000", "http://localhost:3001"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(dict.fromkeys(origins)),
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Setu-Viewer", "X-Admin-Password"],
        expose_headers=["X-Setu-Identifying-Fields"],
    )
    return app


# `uvicorn app:app` builds the app from the environment at import time.
app = create_app() if os.environ.get("SETU_NODE_NO_AUTOLOAD") != "1" else None
