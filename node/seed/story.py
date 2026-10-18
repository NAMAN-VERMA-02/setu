"""The hand-written story people. Tests and the demo depend on these exact values.

Snapshot `sem` 1-8 is a semester; a value > 8 is a post-graduation year.
"""

NODE_NAMES = {
    "ngit": ("Northgate Institute of Technology", "Delhi"),
    "rce": ("Riverbend College of Engineering", "Noida"),
    "pro": ("Setu Professionals", "Pan-India"),
}


def _s(sem, cgpa=None, internship=0, projects=0, hackathons=0, skills=(), label="", decision=None, org=None):
    return {
        "sem": sem, "cgpa": cgpa, "internship": internship, "projects": projects, "hackathons": hackathons,
        "skills": list(skills), "label": label, "decision": decision, "org": org,
    }


def _job(year, title, org):
    return _s(year, label=f"{title} at {org}", decision="job", org=org)


def _p(key, name, role, branch, grad_year=None, sem=None, cgpa=None, skills=(), goal=None, company=None, title=None,
       headline=None, phone="", snaps=(), open_to_intros=1, on_leaderboard=1):
    return {
        "key": key, "name": name, "role": role, "branch": branch, "grad_year": grad_year, "current_sem": sem,
        "cgpa": cgpa, "skills": list(skills), "goal": goal, "company": company, "title": title, "headline": headline,
        "email": f"{key.replace('_', '.')}@seed.invalid", "phone": phone, "snapshots": list(snaps),
        "open_to_intros": open_to_intros, "on_leaderboard": on_leaderboard,
    }


NGIT_PEOPLE = [
    _p("aman", "Aman Khanna", "student", "ECE", grad_year=2028, sem=5, cgpa=7.2, skills=["python", "ml"],
       goal="ML engineer at a fintech", headline="ECE student, sem 5", phone="+91-90000-00001",
       snaps=[
           _s(1, 6.7, 0, 0, 0, [], "Sem 1: first year, finding his feet"),
           _s(3, 7.0, 0, 1, 0, ["python"], "Sem 3: learned Python, first mini project"),
           _s(5, 7.2, 0, 2, 1, ["python", "ml"], "Sem 5: two projects, one hackathon, no internship yet"),
       ]),
    _p("rohan", "Rohan Mehta", "student", "CSE", grad_year=2027, sem=7, cgpa=8.1, skills=["python", "ml", "dsa", "web"],
       goal="Backend engineer at a product company", headline="CSE student, sem 7", phone="+91-90000-00002",
       snaps=[
           _s(1, 7.6, 0, 0, 0, ["python"], "Sem 1: coding club from week one"),
           _s(3, 7.9, 0, 2, 1, ["python", "dsa"], "Sem 3: DSA grind, first hackathon"),
           _s(5, 8.0, 1, 3, 2, ["python", "dsa", "web"], "Sem 5: summer internship"),
           _s(7, 8.1, 1, 4, 3, ["python", "ml", "dsa", "web"], "Sem 7: three hackathons, preparing for placements"),
       ]),
    _p("priya", "Priya Sharma", "alum", "ECE", grad_year=2022, cgpa=7.4, skills=["python", "ml", "cloud"],
       goal=None, company="FinStack", title="ML Engineer", headline="ML Engineer at FinStack · ECE '22",
       phone="+91-90000-00003",
       snaps=[
           _s(1, 6.9, 0, 0, 0, ["python"], "Sem 1: rough start, picked up Python on the side"),
           _s(3, 7.0, 0, 1, 0, ["python"], "Sem 3: first project, still no hackathons"),
           _s(5, 7.2, 0, 2, 1, ["python", "ml"], "Sem 5: two projects, one hackathon, no internship"),
           _s(7, 7.4, 1, 3, 2, ["python", "ml", "cloud"], "Sem 7: internship at Lumen Analytics"),
           _job(2022, "Data Analyst", "Lumen Analytics"),
           _job(2024, "ML Engineer", "FinStack"),
       ]),
    _p("arjun", "Arjun Malhotra", "alum", "CSE", grad_year=2019, cgpa=8.8, skills=["python", "dsa", "cloud", "web"],
       company="Nimbus Labs", title="Staff Engineer", headline="Staff Engineer at Nimbus Labs · CSE '19",
       phone="+91-90000-00004",
       snaps=[
           _s(1, 8.2, 0, 1, 0, ["python"], "Sem 1: topper of the batch"),
           _s(3, 8.5, 0, 2, 1, ["python", "dsa"], "Sem 3: competitive programming"),
           _s(5, 8.7, 1, 3, 2, ["python", "dsa", "web"], "Sem 5: internship at Nimbus Labs"),
           _s(7, 8.8, 1, 4, 3, ["python", "dsa", "cloud", "web"], "Sem 7: pre-placement offer"),
           _job(2019, "Software Engineer", "Nimbus Labs"),
           _job(2023, "Staff Engineer", "Nimbus Labs"),
       ]),
    _p("kavya", "Kavya Reddy", "alum", "IT", grad_year=2020, cgpa=8.2, skills=["python", "web", "design"],
       company="KoshaPay", title="Product Manager", headline="Product Manager at KoshaPay · IT '20",
       phone="+91-90000-00005",
       snaps=[
           _s(1, 7.8, 0, 0, 0, ["design"], "Sem 1: designing posters for every fest"),
           _s(3, 8.0, 0, 2, 1, ["web", "design"], "Sem 3: built the college events app"),
           _s(5, 8.1, 1, 3, 2, ["python", "web", "design"], "Sem 5: product internship"),
           _s(7, 8.2, 1, 4, 2, ["python", "web", "design"], "Sem 7: ran the tech fest"),
           _job(2020, "Associate Product Manager", "KoshaPay"),
           _job(2023, "Product Manager", "KoshaPay"),
       ]),
    _p("sneha", "Sneha Joshi", "student", "IT", grad_year=2028, sem=5, cgpa=8.4, skills=["python", "web", "design"],
       goal="Product manager", headline="IT student, sem 5", phone="+91-90000-00006",
       snaps=[
           _s(1, 8.0, 0, 0, 0, ["design"], "Sem 1: design society"),
           _s(3, 8.3, 0, 2, 1, ["web", "design"], "Sem 3: built a campus map"),
           _s(5, 8.4, 1, 3, 2, ["python", "web", "design"], "Sem 5: product internship"),
       ]),
    _p("ngit_pc", "NGIT Placement Cell", "placement", None, headline="Placement Cell, Northgate Institute of Technology",
       phone="+91-90000-00007", open_to_intros=0, on_leaderboard=0),
]

NGIT_EDGES = [("aman", "rohan", 0.9), ("rohan", "priya", 0.7)]

RCE_PEOPLE = [
    _p("meera", "Meera Iyer", "alum", "CSE", grad_year=2015, cgpa=8.4, skills=["python", "dsa", "ml"],
       company="FinStack", title="Hiring Manager – ML", headline="Hiring Manager – ML at FinStack · CSE '15",
       phone="+91-90000-00101",
       snaps=[
           _s(1, 7.9, 0, 0, 0, ["python"], "Sem 1: steady start"),
           _s(3, 8.1, 0, 2, 1, ["python", "dsa"], "Sem 3: DSA and first ML course"),
           _s(5, 8.2, 1, 3, 2, ["python", "dsa", "ml"], "Sem 5: internship in analytics"),
           _s(7, 8.4, 1, 4, 2, ["python", "dsa", "ml"], "Sem 7: research project in ML"),
           _job(2015, "Analyst", "Quanta Retail"),
           _job(2020, "Hiring Manager – ML", "FinStack"),
       ]),
    _p("vikram", "Vikram Nair", "alum", "ECE", grad_year=2018, cgpa=7.5, skills=["python", "ml", "cloud"],
       company="FinStack", title="Senior ML Engineer", headline="Senior ML Engineer at FinStack · ECE '18",
       phone="+91-90000-00102",
       snaps=[
           _s(1, 6.8, 0, 0, 0, ["python"], "Sem 1: struggled with maths"),
           _s(3, 7.1, 0, 1, 0, ["python"], "Sem 3: first embedded project"),
           _s(5, 7.3, 0, 2, 1, ["python", "ml"], "Sem 5: two projects, one hackathon, no internship"),
           _s(7, 7.5, 1, 3, 2, ["python", "ml", "cloud"], "Sem 7: late internship, switched to ML"),
           _job(2018, "Associate Engineer", "Tarang Systems"),
           _job(2022, "Senior ML Engineer", "FinStack"),
       ]),
    _p("karan", "Karan Bhatia", "alum", "IT", grad_year=2019, cgpa=7.8, skills=["python", "ml", "web"],
       company="FinStack", title="Data Scientist", headline="Data Scientist at FinStack · IT '19",
       phone="+91-90000-00103",
       snaps=[
           _s(1, 7.3, 0, 0, 0, ["web"], "Sem 1: web dev on the side"),
           _s(3, 7.5, 0, 2, 1, ["python", "web"], "Sem 3: Kaggle beginner"),
           _s(5, 7.6, 1, 3, 1, ["python", "ml", "web"], "Sem 5: data internship"),
           _s(7, 7.8, 1, 4, 2, ["python", "ml", "web"], "Sem 7: capstone on credit scoring"),
           _job(2019, "Data Analyst", "Indus Health AI"),
           _job(2022, "Data Scientist", "FinStack"),
       ]),
    _p("rce_pc", "RCE Placement Cell", "placement", None, headline="Placement Cell, Riverbend College of Engineering",
       phone="+91-90000-00104", open_to_intros=0, on_leaderboard=0),
]

RCE_EDGES = [("karan", "meera", 0.4), ("vikram", "meera", 0.55)]

STORY = {
    "ngit": {"people": NGIT_PEOPLE, "edges": NGIT_EDGES},
    "rce": {"people": RCE_PEOPLE, "edges": RCE_EDGES},
}


def local_id(college_id: str, key: str) -> str:
    return f"{college_id}-{key}"


# Aman's sem-5 profile, used by the generator to keep decoys from crowding the story.
AMAN = {"branch": "ECE", "cgpa": 7.2, "internship": 0, "projects": 2, "hackathons": 1, "skills": ["python", "ml"],
        "goal": "ML engineer at a fintech", "sem": 5}
