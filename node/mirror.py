"""Mirror engine: feature vectors, cosine matching, rarest shared trait.

Pure functions up top (used by the seed generator too); store-backed queries below.
Nothing here ever returns a name, email, phone or free text about a person.
"""
from __future__ import annotations

import math
import re
from collections import Counter

BRANCHES = ["CSE", "IT", "ECE", "ME", "AIML"]
SKILLS = ["python", "ml", "web", "dsa", "cloud", "design"]
SKILL_LABEL = {"python": "Python", "ml": "ML", "web": "web", "dsa": "DSA", "cloud": "cloud", "design": "design"}
DECISIONS = ["job", "gate", "higher_studies", "startup"]


# ---------------------------------------------------------------- vectors
def vec(branch, cgpa, internship, projects, hackathons, skills) -> list[float]:
    v = [1.0 if branch == b else 0.0 for b in BRANCHES]
    v.append(round(float(cgpa or 0) / 10.0, 4))
    v.append(1.0 if internship else 0.0)
    v.append(round(min((projects or 0) / 5.0, 1.0), 4))
    v.append(round(min((hackathons or 0) / 3.0, 1.0), 4))
    have = {str(s).lower() for s in (skills or [])}
    v.extend(1.0 if s in have else 0.0 for s in SKILLS)
    return v


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def goal_tag(text: str | None) -> str:
    t = (text or "").lower()
    if re.search(r"\bml\b|machine learning|data scien|\bai\b|deep learning", t):
        return "ml"
    if re.search(r"\bgate\b|m\.?tech", t):
        return "gate"
    if re.search(r"abroad|\bms\b|higher stud", t):
        return "abroad"
    if re.search(r"start my own|found(er|ing)|start.?up|own company", t):
        return "startup"
    if re.search(r"product manager|\bpm\b", t):
        return "product"
    if re.search(r"engineer|developer|software|backend|frontend|sde", t):
        return "swe"
    return "other"


def title_tag(title: str | None) -> str:
    t = (title or "").lower()
    if re.search(r"\bml\b|machine learning|data scien|data analyst|\bai\b", t):
        return "ml"
    if "product" in t:
        return "product"
    if re.search(r"founder|ceo", t):
        return "startup"
    if re.search(r"engineer|developer|lead|manager|architect", t):
        return "swe"
    return "other"


def outcome_tag(first_decision: str | None, title: str | None) -> str:
    if first_decision == "gate":
        return "gate"
    if first_decision == "higher_studies":
        return "abroad"
    if first_decision == "startup":
        return "startup"
    return title_tag(title)


def score_parts(cos: float, same_college: bool, same_branch: bool, goal_match: bool) -> float:
    s = cos * 0.80 + (0.06 if same_college else 0) + (0.04 if same_branch else 0) + (0.02 if goal_match else 0)
    return round(min(s, 0.99), 3)


def cgpa_band(cgpa: float) -> str:
    lo = math.floor(round(cgpa, 4) * 2) / 2
    return f"{lo:.1f}–{lo + 0.5:.1f}"


# ---------------------------------------------------------------- traits
def traits_of(branch, cgpa, internship, projects, hackathons, skills) -> list[tuple]:
    out = [
        ("internship", 1 if internship else 0),
        ("cgpa_band", cgpa_band(cgpa)),
        ("branch", branch),
        ("hackathons", min(int(hackathons or 0), 3)),
    ]
    have = {str(s).lower() for s in (skills or [])}
    out.extend(("skill", s) for s in SKILLS if s in have)
    return out


def traits_from_vector(v: list[float], branch: str | None = None) -> list[tuple]:
    b = branch
    if not b:
        idx = [i for i in range(5) if v[i] >= 0.5]
        b = BRANCHES[idx[0]] if idx else None
    cgpa = round(v[5] * 10, 2)
    skills = [s for i, s in enumerate(SKILLS) if v[9 + i] >= 0.5]
    return traits_of(b, cgpa, v[6] >= 0.5, round(v[7] * 5), round(v[8] * 3), skills)


def trait_text(trait: tuple, sem: int, pct: int) -> str:
    kind, val = trait
    if kind == "internship":
        what = "an internship" if val else "no internship"
        return f"You both had {what} by sem {sem} — only {pct}% of seniors did"
    if kind == "cgpa_band":
        return f"You both sat in the {val} CGPA band at sem {sem} — only {pct}% of seniors did"
    if kind == "branch":
        return f"You both are in {val} — only {pct}% of seniors were"
    if kind == "hackathons":
        n = "3 or more hackathons" if val >= 3 else ("no hackathons" if val == 0 else f"{val} hackathon" + ("s" if val > 1 else ""))
        return f"You both had {n} by sem {sem} — only {pct}% of seniors did"
    return f"You both knew {SKILL_LABEL.get(val, val)} by sem {sem} — only {pct}% of seniors did"


def rarest_shared(query_traits: list[tuple], senior_traits: list[tuple], all_senior_traits: list[list[tuple]], sem: int):
    """Among traits both share, the one the fewest of this node's seniors at `sem` have."""
    n = len(all_senior_traits)
    if not n:
        return None, None
    counts: Counter = Counter()
    for ts in all_senior_traits:
        counts.update(set(ts))
    sset = set(senior_traits)
    best = None
    for t in query_traits:
        if t in sset:
            pct = round(100 * counts[t] / n)
            if best is None or pct < best[1]:
                best = (t, pct)
    if best is None:
        return None, None
    return trait_text(best[0], sem, best[1]), best[1]


# ---------------------------------------------------------------- store-backed queries
def _senior_bundle(store, sem: int):
    """[(person, snapshot, vector, traits, first_decision, outcome_tag)] for alumni with a snapshot at sem."""
    out = []
    for p, s in store.seniors_at(sem):
        skills = s["skills"]
        v = vec(p["branch"], s["cgpa"], s["internship"], s["projects"], s["hackathons"], skills)
        t = traits_of(p["branch"], s["cgpa"], s["internship"], s["projects"], s["hackathons"], skills)
        fd, tag = store.outcome_of(p)
        out.append((p, s, v, t, fd, tag))
    return out


def mirror_query(store, vector, sem, requester_node, branch, goal, limit=5):
    bundle = _senior_bundle(store, int(sem))
    if len(vector) != 15:
        raise ValueError("vector must have 15 dimensions")
    qtraits = traits_from_vector(vector, branch)
    all_t = [b[3] for b in bundle]
    rows = []
    for p, s, v, t, fd, tag in bundle:
        cos = cosine(vector, v)
        score = score_parts(
            cos,
            store.college_id == requester_node,
            bool(branch) and p["branch"] == branch,
            bool(goal) and goal != "other" and tag == goal,
        )
        text, pct = rarest_shared(qtraits, t, all_t, int(sem))
        rows.append(
            {
                "pid": store.pid(p["local_id"]),
                "score": score,
                "shared_trait": text,
                "rarity_pct": pct,
                "then_label": s["label"],
                "now_title": p["title"],
                "now_company": p["company"],
                "outcome": fd,
            }
        )
    rows.sort(key=lambda r: (-r["score"], r["pid"]))
    return rows[: max(1, int(limit))]


def student_vector(store, person):
    s = store.snapshot_at(person["local_id"], person["current_sem"])
    if not s:
        return None
    return vec(person["branch"], s["cgpa"], s["internship"], s["projects"], s["hackathons"], s["skills"]), s


def reverse_mirror_query(store, pid, sem, limit=3):
    """Current students who look most like this senior did at `sem`."""
    p = store.person_by_pid(pid)
    if not p or p["role"] != "alum":
        return None
    snap = store.snapshot_at(p["local_id"], int(sem))
    if not snap:
        return []
    sv = vec(p["branch"], snap["cgpa"], snap["internship"], snap["projects"], snap["hackathons"], snap["skills"])
    st = traits_of(p["branch"], snap["cgpa"], snap["internship"], snap["projects"], snap["hackathons"], snap["skills"])
    bundle = _senior_bundle(store, int(sem))
    all_t = [b[3] for b in bundle]
    fd, tag = store.outcome_of(p)
    rows = []
    for stu in store.students_at(int(sem)):
        got = student_vector(store, stu)
        if not got:
            continue
        v, s = got
        cos = cosine(sv, v)
        score = score_parts(cos, True, stu["branch"] == p["branch"], goal_tag(stu["goal"]) == tag and tag != "other")
        stt = traits_of(stu["branch"], s["cgpa"], s["internship"], s["projects"], s["hackathons"], s["skills"])
        text, pct = rarest_shared(stt, st, all_t, int(sem))
        rows.append(
            {
                "pid": store.pid(stu["local_id"]),
                "score": score,
                "shared_trait": text,
                "rarity_pct": pct,
                "sem": int(sem),
                "branch": stu["branch"],
            }
        )
    rows.sort(key=lambda r: (-r["score"], r["pid"]))
    return rows[: max(1, int(limit))]
