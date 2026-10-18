"""Deterministic seed data for a college node (fixed RNG seed per college).

build(college_id) -> {"people": [...], "snapshots": [...], "edges": [(a_local, b_local, prior), ...]}
Same college id, same data, every boot.
"""
from __future__ import annotations

import random

import mirror
from seed import story

REF_YEAR = 2026
BRANCHES = mirror.BRANCHES
COMPANIES = [
    "FinStack", "Nimbus Labs", "KoshaPay", "Tarang Systems", "Vayu Robotics", "Indus Health AI", "BharatGrid",
    "Quanta Retail", "Lumen Analytics", "Sarthi Mobility",
]
STARTUPS = ["Pragati Works", "Kiran Labs", "Mitra Mobility", "Dhara Analytics", "Setubandh Tools", "Anvay Robotics"]
FIRST = [
    "Aarav", "Vivaan", "Aditya", "Ishaan", "Kabir", "Rahul", "Siddharth", "Nikhil", "Harsh", "Yash", "Tanmay", "Devansh",
    "Ananya", "Diya", "Ishita", "Nandini", "Pooja", "Riya", "Shreya", "Tanvi", "Neha", "Divya", "Meghna", "Aisha",
    "Manish", "Gaurav", "Sanjay", "Pranav", "Varun", "Mohit", "Swati", "Anjali", "Rhea", "Kritika", "Zoya", "Farhan",
]
LAST = [
    "Verma", "Gupta", "Singh", "Kapoor", "Bansal", "Chopra", "Desai", "Menon", "Pillai", "Banerjee", "Chatterjee", "Das",
    "Ghosh", "Joshi", "Kulkarni", "Patil", "Rao", "Shetty", "Thakur", "Tiwari", "Yadav", "Agarwal", "Bhatt", "Saxena",
    "Mishra", "Pandey", "Sinha", "Khan", "Ahmed", "Dutta", "Sethi", "Arora",
]
LADDER = {
    "CSE": ["Software Engineer", "Senior Software Engineer", "Engineering Manager"],
    "IT": ["Backend Engineer", "Senior Engineer", "Tech Lead"],
    "ECE": ["Embedded Engineer", "Hardware Design Engineer", "Senior Systems Engineer"],
    "ME": ["Design Engineer", "Mechanical Engineer", "Senior Design Engineer"],
    "AIML": ["Data Analyst", "ML Engineer", "Senior ML Engineer"],
}
SKILL_ORDER = {
    "CSE": ["python", "web", "dsa", "cloud", "ml", "design"],
    "IT": ["python", "web", "dsa", "cloud", "design", "ml"],
    "ECE": ["python", "ml", "dsa", "cloud", "web", "design"],
    "ME": ["design", "python", "dsa", "web", "cloud", "ml"],
    "AIML": ["python", "ml", "dsa", "cloud", "web", "design"],
}
GOALS = [
    "ML engineer at a fintech", "Backend engineer at a product company", "Crack GATE and do M.Tech",
    "MS abroad in robotics", "Start my own company", "Product manager at a startup", "Software engineer at a big tech firm",
    "Data scientist in healthcare", "Embedded engineer in robotics",
]

# Alumni deliberately built to look like Aman at sem 5 (ECE, ~7.0-7.5, no internship). Story depends on them.
PLANTS = {
    "ngit": [
        {"year": 2021, "cgpa": 7.4, "projects": 1, "hackathons": 1, "skills": ["python", "ml", "dsa"]},
    ],
    "rce": [
        {"year": 2019, "cgpa": 7.0, "projects": 2, "hackathons": 1, "skills": ["python", "ml"]},
        {"year": 2022, "cgpa": 7.5, "projects": 1, "hackathons": 1, "skills": ["python", "ml", "dsa"]},
        {"year": 2016, "cgpa": 7.3, "projects": 2, "hackathons": 0, "skills": ["python", "ml", "web"]},
    ],
}
GUARD_MAX = 0.66  # non-planted alumni must score below this against Aman at sem 5


def _grad_year_for_sem(sem: int) -> int:
    return REF_YEAR + -(-(8 - sem) // 2)


def _year_of(grad_year, sem):
    if sem > 8:
        return sem
    return grad_year - 4 + sem // 2 if grad_year else None


def _clamp(x, lo=5.5, hi=9.8):
    return round(max(lo, min(hi, x)), 1)


def _label(sem, internship, projects, hackathons):
    bits = []
    bits.append("an internship" if internship else "no internship")
    bits.append(f"{projects} project" + ("" if projects == 1 else "s"))
    bits.append(f"{hackathons} hackathon" + ("" if hackathons == 1 else "s"))
    return f"Sem {sem}: " + ", ".join(bits)


def _job(year, title, org):
    return {"sem": year, "cgpa": None, "internship": 0, "projects": 0, "hackathons": 0, "skills": [],
            "label": f"{title} at {org}", "decision": "job", "org": org}


def _career(rng, branch, grad_year):
    ladder = LADDER[branch]
    decision = rng.choices(mirror.DECISIONS, [62, 12, 14, 12])[0]
    rows = []
    if decision == "job":
        org = rng.choice(COMPANIES)
        rows.append(_job(grad_year, ladder[0], org))
        if grad_year <= 2024 and rng.random() < 0.8:
            y = grad_year + rng.randint(2, min(5, REF_YEAR - grad_year))
            org2 = org if rng.random() < 0.5 else rng.choice(COMPANIES)
            rows.append(_job(y, ladder[rng.randint(1, 2)], org2))
    elif decision in ("gate", "higher_studies"):
        label, org = ("M.Tech, IIT (GATE)", "IIT (GATE)") if decision == "gate" else ("MS abroad", "Abroad (MS)")
        rows.append({"sem": grad_year, "cgpa": None, "internship": 0, "projects": 0, "hackathons": 0, "skills": [],
                     "label": label, "decision": decision, "org": org})
        if grad_year <= 2024:
            rows.append(_job(grad_year + 2, ladder[1], rng.choice(COMPANIES)))
    else:
        rows.append({"sem": grad_year, "cgpa": None, "internship": 0, "projects": 0, "hackathons": 0, "skills": [],
                     "label": "Founder", "decision": "startup", "org": rng.choice(STARTUPS)})
    last = rows[-1]
    if last["decision"] == "job":
        return rows, last["org"], last["label"].split(" at ")[0]
    if last["decision"] == "startup":
        return rows, last["org"], "Founder"
    return rows, None, last["label"]


def _raw_snaps(rng, branch, final_cgpa):
    """Four plausible semester snapshots (1,3,5,7), non-decreasing in activity."""
    offs = {1: -0.5, 3: -0.3, 5: -0.15, 7: 0.0}
    order = SKILL_ORDER[branch][:]
    i, j = rng.randrange(6), rng.randrange(6)
    order[i], order[j] = order[j], order[i]
    out, have = {}, []
    p = h = 0
    i5 = rng.random() < 0.3
    i7 = i5 or rng.random() < 0.6
    interns = {1: 0, 3: 0, 5: int(i5), 7: int(i7)}
    for sem in (1, 3, 5, 7):
        p += rng.randint(0, 1) if sem == 1 else rng.randint(0, 2)
        h += rng.randint(0, 1) if sem < 7 else rng.randint(0, 2)
        for _ in range(rng.randint(0, 2) if sem > 1 else rng.randint(0, 1)):
            nxt = [s for s in order if s not in have]
            if nxt:
                have.append(nxt[0])
        out[sem] = {"sem": sem, "cgpa": _clamp(final_cgpa + offs[sem] + rng.uniform(-0.15, 0.15)),
                    "internship": interns[sem], "projects": p, "hackathons": h, "skills": list(have)}
    return out


def _apply_fixed5(raw, fixed):
    s5 = {"sem": 5, "cgpa": fixed["cgpa"], "internship": 0, "projects": fixed["projects"],
          "hackathons": fixed["hackathons"], "skills": list(fixed["skills"])}
    for sem in (1, 3):
        r = raw[sem]
        r["internship"] = 0
        r["projects"] = min(r["projects"], s5["projects"])
        r["hackathons"] = min(r["hackathons"], s5["hackathons"])
        r["skills"] = [s for s in r["skills"] if s in s5["skills"]]
        r["cgpa"] = min(r["cgpa"], s5["cgpa"])
    r7 = raw[7]
    r7["projects"] = max(r7["projects"], s5["projects"])
    r7["hackathons"] = max(r7["hackathons"], s5["hackathons"])
    r7["skills"] = list(dict.fromkeys(s5["skills"] + r7["skills"]))
    r7["cgpa"] = max(r7["cgpa"], s5["cgpa"])
    raw[5] = s5


def _aman_score(college_id, branch, snap5, tag):
    a = story.AMAN
    av = mirror.vec(a["branch"], a["cgpa"], a["internship"], a["projects"], a["hackathons"], a["skills"])
    v = mirror.vec(branch, snap5["cgpa"], snap5["internship"], snap5["projects"], snap5["hackathons"], snap5["skills"])
    return mirror.score_parts(mirror.cosine(av, v), college_id == "ngit", branch == a["branch"],
                              tag == mirror.goal_tag(a["goal"]))


def _guarded_snaps(rng, college_id, branch, final_cgpa, tag):
    for _ in range(80):
        raw = _raw_snaps(rng, branch, final_cgpa)
        if _aman_score(college_id, branch, raw[5], tag) < GUARD_MAX:
            return raw
    raw[5].update(internship=1, projects=max(raw[5]["projects"], 4), hackathons=max(raw[5]["hackathons"], 3))
    raw[7].update(internship=1, projects=max(raw[7]["projects"], 4), hackathons=max(raw[7]["hackathons"], 3))
    return raw


def build(college_id: str) -> dict:
    rng = random.Random(f"setu-seed-{college_id}")
    base_phone = 1000 if college_id == "ngit" else 2000
    people, snaps = [], []
    used = set()

    def add_person(rec):
        people.append(rec)

    def add_snap(lid, grad_year, s):
        snaps.append({
            "local_id": lid, "sem": s["sem"], "year": _year_of(grad_year, s["sem"]), "cgpa": s.get("cgpa"),
            "internship": s.get("internship", 0), "projects": s.get("projects", 0), "hackathons": s.get("hackathons", 0),
            "skills": s.get("skills", []), "decision": s.get("decision"), "org": s.get("org"), "label": s.get("label"),
        })

    # ---- story people
    story_ids = []
    for sp in story.STORY[college_id]["people"]:
        lid = story.local_id(college_id, sp["key"])
        story_ids.append(lid)
        used.add(sp["name"])
        add_person({
            "local_id": lid, "story_key": sp["key"], "name": sp["name"], "role": sp["role"], "branch": sp["branch"],
            "grad_year": sp["grad_year"], "current_sem": sp["current_sem"], "cgpa": sp["cgpa"], "skills": sp["skills"],
            "goal": sp["goal"], "company": sp["company"], "title": sp["title"], "headline": sp["headline"],
            "email": sp["email"], "phone": sp["phone"], "open_to_intros": sp["open_to_intros"],
            "on_leaderboard": sp["on_leaderboard"],
        })
        for s in sp["snapshots"]:
            add_snap(lid, sp["grad_year"], s)
    n_story_alum = sum(1 for p in story.STORY[college_id]["people"] if p["role"] == "alum")
    n_story_stu = sum(1 for p in story.STORY[college_id]["people"] if p["role"] == "student")

    counter = [0]

    def fresh_name():
        while True:
            f, l = rng.choice(FIRST), rng.choice(LAST)
            if f"{f} {l}" not in used:
                used.add(f"{f} {l}")
                return f, l

    def contact(f, l):
        counter[0] += 1
        return f"{f}.{l}{counter[0]}".lower() + "@seed.invalid", f"+91-90000-{base_phone + counter[0]:05d}"

    gen_ids = []

    # ---- alumni (26 total including story alumni)
    n_alum = 26 - n_story_alum
    years = [2012 + (i * 14) // n_alum for i in range(n_alum)]
    rng.shuffle(years)
    branches = [BRANCHES[i % 5] for i in range(n_alum)]
    rng.shuffle(branches)
    plants = PLANTS.get(college_id, [])
    for i in range(n_alum):
        plant = plants[i] if i < len(plants) else None
        branch = "ECE" if plant else branches[i]
        grad = plant["year"] if plant else years[i]
        f, l = fresh_name()
        lid = f"{college_id}-g{len(gen_ids) + 1:03d}"
        gen_ids.append(lid)
        rows, company, title = _career(rng, branch, grad)
        fd = next((r["decision"] for r in rows if r["decision"]), None)
        tag = mirror.outcome_tag(fd, title)
        final = round(rng.uniform(6.2, 9.2), 1)
        if plant:
            raw = _raw_snaps(rng, branch, final)
            _apply_fixed5(raw, plant)
        else:
            raw = _guarded_snaps(rng, college_id, branch, final, tag)
        for sem in (1, 3, 5, 7):
            r = dict(raw[sem])
            r["label"] = _label(sem, r["internship"], r["projects"], r["hackathons"])
            add_snap(lid, grad, r)
        for r in rows:
            add_snap(lid, grad, r)
        email, phone = contact(f, l)
        tail = f"{title} at {company}" if company and title != "Founder" else (f"Founder, {company}" if company else title)
        add_person({
            "local_id": lid, "story_key": None, "name": f"{f} {l}", "role": "alum", "branch": branch, "grad_year": grad,
            "current_sem": None, "cgpa": raw[7]["cgpa"], "skills": raw[7]["skills"], "goal": None, "company": company,
            "title": title, "headline": f"{tail} · {branch} '{str(grad)[2:]}", "email": email, "phone": phone,
            "open_to_intros": 1 if rng.random() < 0.8 else 0, "on_leaderboard": 1 if rng.random() < 0.6 else 0,
        })

    # ---- students (16 total including story students)
    n_stu = 16 - n_story_stu
    sems = [1, 1, 2, 3, 3, 4, 5, 5, 6, 7, 7, 8, 8, 2, 4, 6][:n_stu]
    rng.shuffle(sems)
    for i, sem in enumerate(sems):
        branch = BRANCHES[(i + 2) % 5]
        f, l = fresh_name()
        lid = f"{college_id}-g{len(gen_ids) + 1:03d}"
        gen_ids.append(lid)
        grad = _grad_year_for_sem(sem)
        final = round(rng.uniform(6.2, 9.2), 1)
        raw = _raw_snaps(rng, branch, final)
        keep = [s for s in (1, 3, 5, 7) if s <= sem]
        cur = raw[keep[-1]]
        for s in keep:
            r = dict(raw[s])
            r["label"] = _label(s, r["internship"], r["projects"], r["hackathons"])
            add_snap(lid, grad, r)
        if sem not in keep:
            r = dict(cur, sem=sem, cgpa=_clamp(cur["cgpa"] + rng.uniform(-0.1, 0.2)))
            r["label"] = _label(sem, r["internship"], r["projects"], r["hackathons"])
            add_snap(lid, grad, r)
            cur = r
        email, phone = contact(f, l)
        add_person({
            "local_id": lid, "story_key": None, "name": f"{f} {l}", "role": "student", "branch": branch, "grad_year": grad,
            "current_sem": sem, "cgpa": cur["cgpa"], "skills": cur["skills"], "goal": rng.choice(GOALS), "company": None,
            "title": None, "headline": f"{branch} student, sem {sem}", "email": email, "phone": phone,
            "open_to_intros": 1 if rng.random() < 0.85 else 0, "on_leaderboard": 1 if rng.random() < 0.7 else 0,
        })

    # ---- faculty
    f, l = fresh_name()
    lid = f"{college_id}-g{len(gen_ids) + 1:03d}"
    gen_ids.append(lid)
    email, phone = contact(f, l)
    add_person({
        "local_id": lid, "story_key": None, "name": f"Dr. {f} {l}", "role": "faculty", "branch": rng.choice(BRANCHES),
        "grad_year": None, "current_sem": None, "cgpa": None, "skills": [], "goal": None, "company": None, "title": "Professor",
        "headline": "Faculty mentor", "email": email, "phone": phone, "open_to_intros": 1, "on_leaderboard": 0,
    })

    # ---- intra-college edges
    pairs: dict[tuple, float] = {}
    deg = {g: 0 for g in gen_ids}

    def key(a, b):
        return (a, b) if a < b else (b, a)

    for g in gen_ids:
        target = rng.randint(3, 6)
        tries = 0
        while deg[g] < target and tries < 60:
            tries += 1
            o = rng.choice(gen_ids)
            if o == g or deg[o] >= 6 or key(g, o) in pairs:
                continue
            pairs[key(g, o)] = round(rng.uniform(0.35, 0.85), 2)
            deg[g] += 1
            deg[o] += 1
    story_edges = {key(story.local_id(college_id, a), story.local_id(college_id, b)): p
                   for a, b, p in story.STORY[college_id]["edges"]}
    for sp in story.STORY[college_id]["people"]:
        if sp["role"] == "placement":
            continue
        sid = story.local_id(college_id, sp["key"])
        for _ in range(rng.randint(1, 2)):
            for _try in range(40):
                o = rng.choice(gen_ids)
                if deg[o] < 6 and key(sid, o) not in pairs:
                    pairs[key(sid, o)] = round(rng.uniform(0.15, 0.30), 2)
                    deg[o] += 1
                    break
    pairs.update(story_edges)
    edges = [(a, b, p) for (a, b), p in pairs.items()]
    return {"people": people, "snapshots": snaps, "edges": edges}
