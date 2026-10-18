"""SQLite persistence for one college node (stdlib sqlite3 only)."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import hmac
import json
import math
import sqlite3
import threading
import time

import mirror

REF_YEAR = 2026

SCHEMA = """
CREATE TABLE IF NOT EXISTS people(
  local_id TEXT PRIMARY KEY, story_key TEXT, name TEXT NOT NULL, role TEXT NOT NULL, branch TEXT,
  grad_year INTEGER, current_sem INTEGER, cgpa REAL, skills TEXT NOT NULL DEFAULT '[]', goal TEXT,
  company TEXT, title TEXT, headline TEXT, email TEXT, phone TEXT,
  open_to_intros INTEGER NOT NULL DEFAULT 0, on_leaderboard INTEGER NOT NULL DEFAULT 0,
  is_18_plus INTEGER NOT NULL DEFAULT 1, created_via TEXT NOT NULL DEFAULT 'seed', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS snapshots(
  local_id TEXT NOT NULL, sem INTEGER NOT NULL, year INTEGER, cgpa REAL, internship INTEGER NOT NULL DEFAULT 0,
  projects INTEGER NOT NULL DEFAULT 0, hackathons INTEGER NOT NULL DEFAULT 0, skills TEXT NOT NULL DEFAULT '[]',
  decision TEXT, org TEXT, label TEXT, PRIMARY KEY(local_id, sem));
CREATE TABLE IF NOT EXISTS edges(a_local TEXT NOT NULL, b_local TEXT NOT NULL, prior REAL NOT NULL, PRIMARY KEY(a_local, b_local));
CREATE TABLE IF NOT EXISTS reveals(
  pid TEXT NOT NULL, viewer_pid TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL, UNIQUE(pid, viewer_pid));
CREATE TABLE IF NOT EXISTS asks(
  intro_id TEXT PRIMARY KEY, requester_pid TEXT NOT NULL, text TEXT, work_url TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notes(
  id INTEGER PRIMARY KEY AUTOINCREMENT, intro_id TEXT NOT NULL, author_pid TEXT NOT NULL, text TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, caller TEXT NOT NULL, action TEXT NOT NULL,
  identifying_fields INTEGER NOT NULL DEFAULT 0, detail TEXT);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS releases(id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, pid TEXT NOT NULL, viewer_pid TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profiles(
  local_id TEXT PRIMARY KEY, domain TEXT, specialty TEXT, years_exp INTEGER, offers TEXT NOT NULL DEFAULT '[]',
  needs TEXT NOT NULL DEFAULT '[]', open_to TEXT NOT NULL DEFAULT '[]', city TEXT, about TEXT);
"""

ALL_TABLES = ["people", "snapshots", "edges", "reveals", "asks", "notes", "audit", "settings", "releases", "profiles"]
PUBLIC_ROLES = ("alum", "professional")  # roles whose job title and company are shown on their public card


def utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def make_pid(college_id: str, secret: str, local_id: str) -> str:
    mac = hmac.new(secret.encode(), local_id.encode(), hashlib.sha256).hexdigest()
    return f"{college_id}_{mac[:12]}"


def b64u(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def b64u_dec(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def sign_viewer(secret: str, pid: str, exp: int) -> str:
    payload = b64u(json.dumps({"pid": pid, "exp": int(exp)}, separators=(",", ":")).encode())
    sig = b64u(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_viewer(secret: str, token: str | None, now: float | None = None) -> str | None:
    """Return the viewer pid, or None if the token is missing, forged or expired."""
    if not token or token.count(".") != 1:
        return None
    payload, sig = token.split(".")
    want = b64u(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(want, sig):
        return None
    try:
        data = json.loads(b64u_dec(payload))
        pid, exp = data["pid"], float(data["exp"])
    except Exception:
        return None
    if not isinstance(pid, str) or exp < (now if now is not None else time.time()):
        return None
    return pid


class Store:
    def __init__(self, path: str, college_id: str, node_secret: str):
        self.path = path
        self.college_id = college_id
        self.secret = node_secret
        self.lock = threading.RLock()
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        with self.lock:
            self.db.executescript(SCHEMA)
            self.db.commit()
        self._pid_cache: dict[str, str] = {}

    # ------------------------------------------------------------ plumbing
    def q(self, sql: str, args: tuple = ()) -> list[dict]:
        with self.lock:
            return [dict(r) for r in self.db.execute(sql, args).fetchall()]

    def one(self, sql: str, args: tuple = ()) -> dict | None:
        rows = self.q(sql, args)
        return rows[0] if rows else None

    def x(self, sql: str, args: tuple = ()):
        with self.lock:
            cur = self.db.execute(sql, args)
            self.db.commit()
            return cur

    def close(self):
        with self.lock:
            self.db.close()

    def pid(self, local_id: str) -> str:
        p = self._pid_cache.get(local_id)
        if p is None:
            p = make_pid(self.college_id, self.secret, local_id)
            self._pid_cache[local_id] = p
        return p

    def person_by_pid(self, pid: str) -> dict | None:
        if not isinstance(pid, str) or not pid.startswith(self.college_id + "_"):
            return None
        for r in self._people_rows():
            if self.pid(r["local_id"]) == pid:
                return self._person(r["local_id"])
        return None

    def _people_rows(self):
        return self.q("SELECT local_id FROM people")

    def _person(self, local_id: str) -> dict | None:
        r = self.one("SELECT * FROM people WHERE local_id=?", (local_id,))
        return self._decode_person(r) if r else None

    @staticmethod
    def _decode_person(r: dict) -> dict:
        r["skills"] = json.loads(r.get("skills") or "[]")
        return r

    @staticmethod
    def _decode_snap(r: dict) -> dict:
        r["skills"] = json.loads(r.get("skills") or "[]")
        return r

    # ------------------------------------------------------------ seeding
    def count_people(self) -> int:
        return self.one("SELECT COUNT(*) c FROM people")["c"]

    def wipe(self):
        with self.lock:
            for t in ALL_TABLES:
                self.db.execute(f"DELETE FROM {t}")
            self.db.commit()
        self._pid_cache.clear()

    def load_dataset(self, ds: dict):
        now = utcnow()
        with self.lock:
            for p in ds["people"]:
                self.db.execute(
                    "INSERT INTO people(local_id,story_key,name,role,branch,grad_year,current_sem,cgpa,skills,goal,company,title,"
                    "headline,email,phone,open_to_intros,on_leaderboard,is_18_plus,created_via,created_at)"
                    " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        p["local_id"], p.get("story_key"), p["name"], p["role"], p.get("branch"), p.get("grad_year"),
                        p.get("current_sem"), p.get("cgpa"), json.dumps(p.get("skills", [])), p.get("goal"),
                        p.get("company"), p.get("title"), p.get("headline"), p.get("email"), p.get("phone"),
                        int(p.get("open_to_intros", 0)), int(p.get("on_leaderboard", 0)), 1, "seed", now,
                    ),
                )
            for s in ds["snapshots"]:
                self.db.execute(
                    "INSERT INTO snapshots(local_id,sem,year,cgpa,internship,projects,hackathons,skills,decision,org,label)"
                    " VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        s["local_id"], s["sem"], s.get("year"), s.get("cgpa"), int(s.get("internship", 0)),
                        s.get("projects", 0), s.get("hackathons", 0), json.dumps(s.get("skills", [])),
                        s.get("decision"), s.get("org"), s.get("label"),
                    ),
                )
            for a, b, prior in ds["edges"]:
                self.db.execute("INSERT INTO edges(a_local,b_local,prior) VALUES(?,?,?)", (a, b, prior))
            for pr in ds.get("profiles", []):
                self._insert_profile(pr["local_id"], pr)
            self.db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('hub_access','on')")
            self.db.commit()

    # ------------------------------------------------------------ professional profiles
    def _insert_profile(self, local_id: str, pr: dict):
        self.db.execute(
            "INSERT OR REPLACE INTO profiles(local_id,domain,specialty,years_exp,offers,needs,open_to,city,about)"
            " VALUES(?,?,?,?,?,?,?,?,?)",
            (local_id, pr.get("domain"), pr.get("specialty"), pr.get("years_exp"), json.dumps(pr.get("offers", [])),
             json.dumps(pr.get("needs", [])), json.dumps(pr.get("open_to", [])), pr.get("city"), pr.get("about")),
        )

    def add_profile(self, local_id: str, pr: dict):
        with self.lock:
            self._insert_profile(local_id, pr)
            self.db.commit()

    def profile(self, local_id: str) -> dict | None:
        r = self.one("SELECT * FROM profiles WHERE local_id=?", (local_id,))
        if not r:
            return None
        for k in ("offers", "needs", "open_to"):
            r[k] = json.loads(r.get(k) or "[]")
        return r

    def ensure_seeded(self, dataset_factory):
        if self.count_people() == 0:
            self.load_dataset(dataset_factory())
        if self.one("SELECT value FROM settings WHERE key='hub_access'") is None:
            self.x("INSERT OR REPLACE INTO settings(key,value) VALUES('hub_access','on')")

    def reseed(self, dataset_factory):
        self.wipe()
        self.load_dataset(dataset_factory())

    # ------------------------------------------------------------ settings
    @property
    def hub_access(self) -> bool:
        r = self.one("SELECT value FROM settings WHERE key='hub_access'")
        return (r["value"] if r else "on") == "on"

    def set_hub_access(self, on: bool):
        self.x("INSERT OR REPLACE INTO settings(key,value) VALUES('hub_access',?)", ("on" if on else "off",))

    # ------------------------------------------------------------ people / snapshots
    def people(self) -> list[dict]:
        return [self._decode_person(r) for r in self.q("SELECT * FROM people ORDER BY rowid")]

    def snapshots(self, local_id: str) -> list[dict]:
        return [self._decode_snap(r) for r in self.q("SELECT * FROM snapshots WHERE local_id=? ORDER BY sem", (local_id,))]

    def snapshot_at(self, local_id: str, sem: int) -> dict | None:
        r = self.one("SELECT * FROM snapshots WHERE local_id=? AND sem=?", (local_id, sem))
        return self._decode_snap(r) if r else None

    def seniors_at(self, sem: int):
        rows = self.q(
            "SELECT p.local_id AS _lid, s.sem AS _sem FROM people p JOIN snapshots s ON s.local_id=p.local_id "
            "WHERE p.role='alum' AND s.sem=? ORDER BY p.rowid",
            (sem,),
        )
        return [(self._person(r["_lid"]), self.snapshot_at(r["_lid"], sem)) for r in rows]

    def students_at(self, sem: int) -> list[dict]:
        return [self._decode_person(r) for r in self.q("SELECT * FROM people WHERE role='student' AND current_sem=? ORDER BY rowid", (sem,))]

    def postgrad(self, local_id: str) -> list[dict]:
        return [self._decode_snap(r) for r in self.q("SELECT * FROM snapshots WHERE local_id=? AND sem>8 ORDER BY sem", (local_id,))]

    def outcome_of(self, person: dict):
        """(first decision code, outcome tag) for an alum."""
        pg = self.postgrad(person["local_id"])
        first = next((s["decision"] for s in pg if s["decision"]), None)
        return first, mirror.outcome_tag(first, person.get("title"))

    def add_person(self, p: dict, snaps: list[dict]):
        now = utcnow()
        with self.lock:
            self.db.execute(
                "INSERT INTO people(local_id,story_key,name,role,branch,grad_year,current_sem,cgpa,skills,goal,company,title,"
                "headline,email,phone,open_to_intros,on_leaderboard,is_18_plus,created_via,created_at)"
                " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    p["local_id"], None, p["name"], p["role"], p["branch"], p.get("grad_year"), p.get("current_sem"),
                    p.get("cgpa"), json.dumps(p.get("skills", [])), p.get("goal"), p.get("company"), p.get("title"),
                    p.get("headline"), None, None, int(p["open_to_intros"]), int(p["on_leaderboard"]), 1, "join", now,
                ),
            )
            for s in snaps:
                self.db.execute(
                    "INSERT INTO snapshots(local_id,sem,year,cgpa,internship,projects,hackathons,skills,decision,org,label)"
                    " VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        s["local_id"], s["sem"], s.get("year"), s.get("cgpa"), int(s.get("internship", 0)),
                        s.get("projects", 0), s.get("hackathons", 0), json.dumps(s.get("skills", [])),
                        s.get("decision"), s.get("org"), s.get("label"),
                    ),
                )
            self.db.commit()

    # ------------------------------------------------------------ edges
    def edges(self) -> list[dict]:
        out, seen = [], set()
        for r in self.q("SELECT * FROM edges ORDER BY rowid"):
            a, b = self.pid(r["a_local"]), self.pid(r["b_local"])
            key = frozenset((a, b))
            if key in seen or a == b:
                continue
            seen.add(key)
            out.append({"a": a, "b": b, "prior": r["prior"]})
        return out

    # ------------------------------------------------------------ reveals / asks / notes
    def add_reveals(self, pid: str, viewers: list[str], reason: str = "consent"):
        now = utcnow()
        with self.lock:
            for v in viewers:
                self.db.execute(
                    "INSERT OR IGNORE INTO reveals(pid,viewer_pid,reason,created_at) VALUES(?,?,?,?)", (pid, v, reason, now)
                )
            self.db.commit()

    def has_reveal(self, pid: str, viewer_pid: str) -> bool:
        return self.one("SELECT 1 x FROM reveals WHERE pid=? AND viewer_pid=?", (pid, viewer_pid)) is not None

    def upsert_ask(self, intro_id: str, requester_pid: str, text: str, work_url: str | None):
        cur = self.one("SELECT requester_pid FROM asks WHERE intro_id=?", (intro_id,))
        if cur and cur["requester_pid"] != requester_pid:
            return False
        self.x(
            "INSERT INTO asks(intro_id,requester_pid,text,work_url,created_at) VALUES(?,?,?,?,?) "
            "ON CONFLICT(intro_id) DO UPDATE SET text=excluded.text, work_url=excluded.work_url",
            (intro_id, requester_pid, text, work_url, utcnow()),
        )
        return True

    def get_ask(self, intro_id: str) -> dict | None:
        return self.one("SELECT * FROM asks WHERE intro_id=?", (intro_id,))

    def notes(self, intro_id: str) -> list[dict]:
        return self.q("SELECT author_pid, text, created_at FROM notes WHERE intro_id=? ORDER BY id", (intro_id,))

    def add_note(self, intro_id: str, author_pid: str, text: str):
        self.x("INSERT INTO notes(intro_id,author_pid,text,created_at) VALUES(?,?,?,?)", (intro_id, author_pid, text, utcnow()))

    def record_release(self, pid: str, viewer_pid: str):
        self.x("INSERT INTO releases(ts,pid,viewer_pid) VALUES(?,?,?)", (utcnow(), pid, viewer_pid))

    # ------------------------------------------------------------ audit
    def audit(self, caller: str, action: str, identifying_fields: int = 0, detail: str = ""):
        self.x(
            "INSERT INTO audit(ts,caller,action,identifying_fields,detail) VALUES(?,?,?,?,?)",
            (utcnow(), caller, action, int(identifying_fields), detail[:300]),
        )

    def audit_tail(self, n: int = 30) -> list[dict]:
        return self.q("SELECT ts,caller,action,identifying_fields,detail FROM audit ORDER BY id DESC LIMIT ?", (n,))

    def counters(self) -> dict:
        hub = self.one("SELECT COUNT(*) c, COALESCE(SUM(identifying_fields),0) f FROM audit WHERE caller='hub'")
        rel = self.one("SELECT COUNT(*) n FROM releases")
        return {
            "hub_calls": hub["c"],
            "identifying_fields_to_hub": hub["f"],
            "names_released": rel["n"],
        }

    # ------------------------------------------------------------ derived views
    def directory(self, pid: str | None = None) -> list[dict]:
        out = []
        for p in self.people():
            this = self.pid(p["local_id"])
            if pid and this != pid:
                continue
            is_public = p["role"] in PUBLIC_ROLES
            # for a professional the "branch" slot carries the field they work in (for example "healthcare")
            code = p["branch"]
            if p["role"] == "professional":
                prof = self.profile(p["local_id"])
                code = prof["domain"] if prof else None
            out.append(
                {
                    "pid": this,
                    "story_key": p["story_key"],
                    "role": p["role"],
                    "branch_code": code,
                    "grad_year": p["grad_year"],
                    "public_title": p["title"] if is_public else None,
                    "public_company": p["company"] if is_public else None,
                    "open_to_intros": bool(p["open_to_intros"]),
                    "on_leaderboard": bool(p["on_leaderboard"]),
                }
            )
        return out

    def timeline(self, local_id: str) -> list[dict]:
        out = []
        for s in self.snapshots(local_id):
            out.append(
                {
                    "sem_or_year": s["sem"],
                    "label": s["label"],
                    "cgpa_band": mirror.cgpa_band(s["cgpa"]) if s["cgpa"] is not None else None,
                    "internship": bool(s["internship"]) if s["sem"] <= 8 else None,
                    "decision": s["decision"],
                    "org": s["org"],
                }
            )
        return out

    def stats(self) -> dict:
        roles = {r["role"]: r["c"] for r in self.q("SELECT role, COUNT(*) c FROM people GROUP BY role")}
        outcomes: dict[str, int] = {}
        for p in self.q("SELECT local_id FROM people WHERE role='alum'"):
            first = next((s["decision"] for s in self.postgrad(p["local_id"]) if s["decision"]), None)
            if first:
                outcomes[first] = outcomes.get(first, 0) + 1
        companies = self.q(
            "SELECT company, COUNT(*) c FROM people WHERE role IN ('alum','professional') AND company IS NOT NULL AND company<>'' "
            "GROUP BY company HAVING COUNT(*)>=2 ORDER BY c DESC, company"
        )
        per_year = {
            str(r["grad_year"]): r["c"]
            for r in self.q("SELECT grad_year, COUNT(*) c FROM people WHERE role='student' GROUP BY grad_year ORDER BY grad_year")
        }
        return {
            "roles": roles,
            "outcomes": outcomes,
            "top_companies": [{"company": r["company"], "count": r["c"]} for r in companies],
            "students_per_year": per_year,
            "names_released": self.counters()["names_released"],
        }


def grad_year_for_sem(sem: int) -> int:
    return REF_YEAR + math.ceil((8 - sem) / 2)
