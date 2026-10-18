"""What an alumnus offers comes from their job title first, not from the skills they listed at college."""
import os
import sys
from pathlib import Path

os.environ["SETU_NODE_NO_AUTOLOAD"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

import match  # noqa: E402


@pytest.mark.parametrize("title,skills,expected", [
    ("Mechanical Engineer", ["python", "web", "cloud"], ["hardware"]),
    ("Software Engineer", [], ["software"]),
    ("ML Engineer", ["python"], ["ai-ml", "software"]),
    ("Data Scientist", ["python", "ml"], ["ai-ml", "data"]),
    ("Embedded Engineer", ["dsa"], ["hardware"]),
    ("Tech Lead", ["python", "dsa"], ["software"]),   # no title rule: skills decide
    ("Founder", ["python"], ["entrepreneurship"]),
])
def test_title_wins_over_skills(title, skills, expected):
    assert match.offers_of({"title": title, "skills": skills}, None) == expected


def test_a_mechanical_engineer_is_never_the_answer_to_i_need_a_developer():
    parsed = match.parse_need("I need a developer to build an app")
    offers = match.offers_of({"title": "Mechanical Engineer", "skills": ["python", "web"]}, None)
    assert not any(t in offers for t in parsed["primary"])
