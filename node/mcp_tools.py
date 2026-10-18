"""Read-only MCP tools for a college node. Pseudonymous results only."""
from __future__ import annotations

import json

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import CallToolResult, TextContent

import match
import mirror

TOOL_SPEC_VERSION = "v1"
DISCONNECTED = "This college has disconnected from Setu"

# Fixed, versioned descriptions. Change the version suffix if you change behaviour.
TOOL_DESCRIPTIONS = {
    "college_stats": (
        "[tool-spec v1] Read-only. Aggregate counts for this college: people by role, outcomes by decision, "
        "companies with at least 2 alumni, students per graduation year. No personal data."
    ),
    "find_helpers": (
        "[tool-spec v1] Read-only. Find alumni of this college who are open to intros, filtered by optional company, "
        "field (branch code such as ECE, or a job-title word) and goal (for example 'ML engineer'). Returns pseudonymous "
        "ids and public job cards only, never names or contact details."
    ),
    "mirror_search": (
        "[tool-spec v1] Read-only. Given a student's branch, semester, cgpa, internship flag, project and hackathon counts, "
        "skills and goal, return the alumni who looked most like them at the same semester, with a score, the rarest trait "
        "they share, and where those alumni are now. Pseudonymous ids only."
    ),
    "match_need": (
        "[tool-spec v1] Read-only. Describe in plain words who you need (for example 'a developer who has built health "
        "apps' or 'a startup lawyer') and get the people on this server who offer that, ranked, with the reasons. Works "
        "across professions: a doctor can find a developer. Pseudonymous ids and public job cards only, never names."
    ),
    "get_timeline": (
        "[tool-spec v1] Read-only. Semester-by-semester and post-graduation timeline for one pseudonymous id: label, "
        "cgpa band, internship flag, decision and organisation. No names."
    ),
}


def _ok(data: dict) -> CallToolResult:
    data = dict(data, identifying_fields=0)
    return CallToolResult(content=[TextContent(type="text", text=json.dumps(data))], structuredContent=data)


def _err(msg: str) -> CallToolResult:
    return CallToolResult(content=[TextContent(type="text", text=msg)], isError=True)


def build_mcp(ctx) -> FastMCP:
    store = ctx.store
    mcp = FastMCP(
        f"setu-node-{ctx.cfg.college_id}",
        instructions=(
            f"Read-only, pseudonymous access to the alumni records of {ctx.cfg.college_name}. "
            "Every result reports identifying_fields: 0."
        ),
        stateless_http=True,
        json_response=True,
        streamable_http_path="/mcp",
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )

    def gate():
        return None if store.hub_access else _err(DISCONNECTED)

    @mcp.tool(name="college_stats", description=TOOL_DESCRIPTIONS["college_stats"])
    def college_stats() -> CallToolResult:
        if (e := gate()) is not None:
            return e
        return _ok({"college": ctx.cfg.college_id, "stats": store.stats()})

    @mcp.tool(name="find_helpers", description=TOOL_DESCRIPTIONS["find_helpers"])
    def find_helpers(company: str | None = None, field: str | None = None, goal: str | None = None, limit: int = 5) -> CallToolResult:
        if (e := gate()) is not None:
            return e
        want_goal = mirror.goal_tag(goal) if goal else None
        rows = []
        for p in store.people():
            if p["role"] != "alum" or not p["open_to_intros"]:
                continue
            if company and company.lower() not in (p["company"] or "").lower():
                continue
            if field:
                f = field.strip()
                if f.upper() in mirror.BRANCHES:
                    if p["branch"] != f.upper():
                        continue
                elif f.lower() not in (p["title"] or "").lower():
                    continue
            first, tag = store.outcome_of(p)
            if want_goal and want_goal != "other" and tag != want_goal:
                continue
            rows.append(
                {"pid": store.pid(p["local_id"]), "branch": p["branch"], "grad_year": p["grad_year"],
                 "title": p["title"], "company": p["company"], "outcome": first, "outcome_tag": tag}
            )
        rows.sort(key=lambda r: (-(r["grad_year"] or 0), r["pid"]))
        return _ok({"college": ctx.cfg.college_id, "helpers": rows[: max(1, min(int(limit), 25))]})

    @mcp.tool(name="match_need", description=TOOL_DESCRIPTIONS["match_need"])
    def match_need(need: str, limit: int = 5) -> CallToolResult:
        if (e := gate()) is not None:
            return e
        if not need.strip():
            return _err("Say who you need, in a few words")
        rows = match.rank(store, need[:300], None, max(1, min(int(limit), 15)))
        return _ok({"college": ctx.cfg.college_id, "people": rows})

    @mcp.tool(name="mirror_search", description=TOOL_DESCRIPTIONS["mirror_search"])
    def mirror_search(
        branch: str, sem: int, cgpa: float, internship: bool, projects: int, hackathons: int,
        skills: list[str] | str, goal: str, limit: int = 5,
    ) -> CallToolResult:
        if (e := gate()) is not None:
            return e
        if isinstance(skills, str):
            skills = [s.strip() for s in skills.split(",") if s.strip()]
        b = branch.strip().upper()
        if b not in mirror.BRANCHES:
            return _err(f"branch must be one of {', '.join(mirror.BRANCHES)}")
        if not 1 <= int(sem) <= 8:
            return _err("sem must be between 1 and 8")
        v = mirror.vec(b, cgpa, internship, projects, hackathons, skills)
        rows = mirror.mirror_query(store, v, int(sem), ctx.cfg.college_id, b, mirror.goal_tag(goal), min(int(limit), 25))
        return _ok({"college": ctx.cfg.college_id, "matches": rows})

    @mcp.tool(name="get_timeline", description=TOOL_DESCRIPTIONS["get_timeline"])
    def get_timeline(pid: str) -> CallToolResult:
        if (e := gate()) is not None:
            return e
        p = store.person_by_pid(pid)
        if not p:
            return _err("Unknown pid")
        return _ok({"pid": pid, "timeline": store.timeline(p["local_id"])})

    return mcp
