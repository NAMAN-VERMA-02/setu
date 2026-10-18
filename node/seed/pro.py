"""Seed data for the professional node ("Setu Professionals"): people who are not tied to one college.

Story people (tests and the demo depend on these):
  Dr. Ananya Rao      cardiologist who needs a developer for a patient follow-up app (the demo persona)
  Rahul Desai         CTO of a health-IT company; knows both worlds (the best introducer)
  Ishaan Kapoor       full-stack and ML developer who has built health apps (the person she needs)
  Adv. Meenakshi Iyer startup lawyer;  Zoya Khan  product designer
Everyone else is generated, deterministically.
"""
from __future__ import annotations

import random

import taxonomy
from seed.generate import FIRST, LAST

NAME = ("Setu Professionals", "Pan-India")

STORY_PEOPLE = [
    {"key": "ananya", "name": "Dr. Ananya Rao", "domain": "healthcare", "title": "Cardiologist",
     "company": "Sunrise Heart Institute", "years": 12, "city": "Pune",
     "offers": ["healthcare", "research"], "needs": ["software", "ai-ml"], "open_to": ["intros", "collaboration", "advice"],
     "about": "I run a cardiac clinic. I want a patient follow-up app that flags missed medicines and sends my team an alert. I need a developer who has built health apps."},
    {"key": "rahul", "name": "Rahul Desai", "domain": "software", "title": "CTO", "company": "MediSync Health",
     "years": 15, "city": "Bengaluru", "offers": ["software", "healthcare", "entrepreneurship"], "needs": ["healthcare"],
     "open_to": ["intros", "mentoring", "advice"],
     "about": "I build hospital software. I know clinicians who want tools and developers who care about health. Happy to introduce them."},
    {"key": "ishaan", "name": "Ishaan Kapoor", "domain": "software", "title": "Full-stack & ML Developer",
     "company": "Pulse Digital", "years": 8, "city": "Hyderabad", "offers": ["software", "ai-ml", "healthcare"],
     "needs": ["healthcare", "design"], "open_to": ["intros", "collaboration"],
     "about": "Built a patient-reminder app used by three clinics. Open to freelance and equity projects in health."},
    {"key": "meenakshi", "name": "Adv. Meenakshi Iyer", "domain": "law", "title": "Startup & IP Lawyer",
     "company": "Nyaya Legal Partners", "years": 14, "city": "Chennai", "offers": ["law", "entrepreneurship"],
     "needs": ["software"], "open_to": ["intros", "advice", "speaking"],
     "about": "Contracts, patents and company formation for early-stage teams."},
    {"key": "zoya", "name": "Zoya Khan", "domain": "design", "title": "Product Designer", "company": "Studio Kora",
     "years": 7, "city": "Mumbai", "offers": ["design", "software"], "needs": ["marketing"],
     "open_to": ["intros", "collaboration", "mentoring"], "about": "Mobile product design, mostly health and finance apps."},
]

STORY_EDGES = [
    ("ananya", "rahul", 0.85),    # she trusts him
    ("rahul", "ishaan", 0.70),    # he has worked with Ishaan
    ("ananya", "ishaan", 0.20),   # a cold message to Ishaan directly
    ("ananya", "zoya", 0.40),
    ("zoya", "ishaan", 0.50),
    ("meenakshi", "rahul", 0.55),
]

ROLES = {
    "software": [("Backend Engineer", "Kiran Systems"), ("Mobile Developer", "Appsmith India"), ("Frontend Engineer", "Pixel Forge"),
                 ("Cloud Architect", "Nimbus Works"), ("QA Lead", "TestBridge")],
    "ai-ml": [("ML Engineer", "Neural Nest"), ("NLP Engineer", "Vaak Labs"), ("Computer Vision Engineer", "Drishti AI")],
    "data": [("Data Analyst", "Insight Mills"), ("Analytics Manager", "Gyan Analytics")],
    "healthcare": [("Physician", "Lotus Clinic"), ("Surgeon", "Care Point Hospital"), ("Pharmacist", "Wellspring Pharmacy"),
                   ("Radiologist", "ScanWell Diagnostics"), ("Dentist", "Bright Smile Dental"), ("Paediatrician", "Little Steps Clinic")],
    "law": [("Corporate Counsel", "Veritas Law"), ("Advocate", "Nyaya Chambers"), ("Compliance Officer", "Rule Right")],
    "finance": [("Chartered Accountant", "Lekha & Partners"), ("Investment Analyst", "Dhan Capital"), ("Finance Controller", "Arth Group")],
    "design": [("UX Designer", "Rangoli Studio"), ("Brand Designer", "Chitra Labs"), ("Design Lead", "Pixel & Paint")],
    "marketing": [("Growth Marketer", "Reach Rocket"), ("Content Strategist", "Kahani Media"), ("Brand Manager", "Noor Brands")],
    "education": [("Teacher", "Gurukul School"), ("Curriculum Lead", "Vidya Labs"), ("Professor", "Aryabhata Institute")],
    "research": [("Research Scientist", "Anveshan Labs"), ("Clinical Researcher", "Trial Path")],
    "hardware": [("Embedded Engineer", "Chip Garage"), ("Robotics Engineer", "Yantra Robotics"), ("IoT Architect", "Sensorly")],
    "operations": [("Operations Manager", "Supply Setu"), ("Logistics Lead", "Rapid Route")],
    "entrepreneurship": [("Founder", "Early Seed Studio"), ("Co-founder", "Launchpad Labs")],
    "media": [("Journalist", "Samachar Daily"), ("Video Producer", "Frame Stories")],
}
CITIES = ["Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad", "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Kochi"]
# a distractor: someone with AI and healthcare overlap who ranks below Ishaan for the demo request
DISTRACTORS = [
    {"name": "Neha Verma", "domain": "ai-ml", "title": "ML Engineer", "company": "Medha Health AI", "years": 5, "city": "Gurugram",
     "offers": ["ai-ml", "healthcare"], "needs": ["design"], "open_to": ["intros", "advice"]},
]


def local_id(key: str) -> str:
    return f"pro-{key}"


def build() -> dict:
    rng = random.Random("setu-seed-pro")
    people, profiles, snaps, used = [], [], [], set()
    counter = [0]

    def contact(first: str, last: str):
        counter[0] += 1
        return f"{first}.{last}{counter[0]}".lower().replace(" ", "") + "@seed.invalid", f"+91-90000-{3000 + counter[0]:05d}"

    def add(lid, key, name, title, company, prof, email, phone, open_intros=1, board=1):
        domain = prof["domain"]
        people.append({
            "local_id": lid, "story_key": key, "name": name, "role": "professional", "branch": None, "grad_year": None,
            "current_sem": None, "cgpa": None, "skills": [], "goal": None, "company": company, "title": title,
            "headline": f"{title} at {company} · {taxonomy.DOMAIN_LABEL[domain]}", "email": email, "phone": phone,
            "open_to_intros": open_intros, "on_leaderboard": board,
        })
        profiles.append({"local_id": lid, **prof})
        start = 2026 - prof["years_exp"]
        for i, (yr, label) in enumerate([(start, f"Started in {taxonomy.DOMAIN_LABEL[domain].lower()}"),
                                         (start + prof["years_exp"] // 2, "Grew into a senior role"),
                                         (2026 - 1, f"{title} at {company}")]):
            snaps.append({"local_id": lid, "sem": yr, "year": yr, "cgpa": None, "internship": 0, "projects": 0,
                          "hackathons": 0, "skills": [], "decision": "job" if i == 2 else None,
                          "org": company if i == 2 else None, "label": label})

    for sp in STORY_PEOPLE:
        used.add(sp["name"])
        email, phone = f"{sp['key']}@seed.invalid", f"+91-90000-{3900 + len(people):05d}"
        add(local_id(sp["key"]), sp["key"], sp["name"], sp["title"], sp["company"],
            {"domain": sp["domain"], "specialty": sp["title"], "years_exp": sp["years"], "offers": sp["offers"],
             "needs": sp["needs"], "open_to": sp["open_to"], "city": sp["city"], "about": sp["about"]}, email, phone)

    def fresh_name():
        while True:
            f, l = rng.choice(FIRST), rng.choice(LAST)
            if f"{f} {l}" not in used:
                used.add(f"{f} {l}")
                return f, l

    gen_ids = []
    for d in DISTRACTORS:
        used.add(d["name"])
        lid = f"pro-g{len(gen_ids) + 1:03d}"
        gen_ids.append(lid)
        first, last = d["name"].split()
        email, phone = contact(first, last)
        add(lid, None, d["name"], d["title"], d["company"],
            {"domain": d["domain"], "specialty": d["title"], "years_exp": d["years"], "offers": d["offers"], "needs": d["needs"],
             "open_to": d["open_to"], "city": d["city"], "about": "Applying ML to clinical data."}, email, phone)

    # three to four people per field; nobody generated mixes software with healthcare (so the story stays clear)
    order = [d for d in taxonomy.DOMAINS for _ in range(3)]
    rng.shuffle(order)
    for domain in order:
        title, company = rng.choice(ROLES[domain])
        first, last = fresh_name()
        lid = f"pro-g{len(gen_ids) + 1:03d}"
        gen_ids.append(lid)
        email, phone = contact(first, last)
        extra = [rng.choice([d for d in taxonomy.DOMAINS if d not in (domain, "healthcare", "software", "ai-ml")])] if rng.random() < 0.4 else []
        if domain == "healthcare":
            extra = [e for e in extra if e not in ("software", "ai-ml")]
        needs = rng.sample([d for d in taxonomy.DOMAINS if d != domain], rng.randint(1, 2))
        open_to = ["intros"] + rng.sample([o for o in taxonomy.OPEN_TO if o != "intros"], rng.randint(0, 2))
        years = rng.randint(3, 24)
        add(lid, None, f"{'Dr. ' if domain == 'healthcare' and title in ('Physician', 'Surgeon', 'Radiologist', 'Dentist', 'Paediatrician') else ''}{first} {last}",
            title, company,
            {"domain": domain, "specialty": title, "years_exp": years, "offers": [domain, *extra], "needs": needs,
             "open_to": open_to, "city": rng.choice(CITIES), "about": f"{years} years in {taxonomy.DOMAIN_LABEL[domain].lower()}."},
            email, phone, open_intros=0 if rng.random() < 0.08 else 1, board=1 if rng.random() < 0.7 else 0)

    # edges among generated people, and at most two weak ones for each story person
    pairs: dict[tuple, float] = {}
    deg = {g: 0 for g in gen_ids}

    def key(a, b):
        return (a, b) if a < b else (b, a)

    for g in gen_ids:
        target = rng.randint(3, 5)
        tries = 0
        while deg[g] < target and tries < 60:
            tries += 1
            o = rng.choice(gen_ids)
            if o == g or deg[o] >= 6 or key(g, o) in pairs:
                continue
            pairs[key(g, o)] = round(rng.uniform(0.35, 0.80), 2)
            deg[g] += 1
            deg[o] += 1
    story_pairs = {key(local_id(a), local_id(b)): p for a, b, p in STORY_EDGES}
    for sp in STORY_PEOPLE:
        sid = local_id(sp["key"])
        for _ in range(rng.randint(1, 2)):
            for _try in range(40):
                o = rng.choice(gen_ids)
                if deg[o] < 6 and key(sid, o) not in pairs:
                    pairs[key(sid, o)] = round(rng.uniform(0.15, 0.28), 2)
                    deg[o] += 1
                    break
    pairs.update(story_pairs)
    return {"people": people, "snapshots": snaps, "edges": [(a, b, p) for (a, b), p in pairs.items()], "profiles": profiles}
