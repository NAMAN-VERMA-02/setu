"""Plain-words requests as people really write them, including the long note a professional saves on their profile."""
import os
import sys
from pathlib import Path

os.environ["SETU_NODE_NO_AUTOLOAD"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import match  # noqa: E402
from seed import pro as pro_seed  # noqa: E402


def test_the_last_ask_in_a_long_note_decides():
    about = next(p for p in pro_seed.STORY_PEOPLE if p["key"] == "ananya")["about"]
    parsed = match.parse_need(about)
    assert parsed["primary"] == ["software"], parsed
    assert "healthcare" in parsed["secondary"] or "healthcare" in parsed["context"]


def test_a_note_with_two_asks_prefers_the_one_that_names_a_profession():
    parsed = match.parse_need("I want to grow. I need a lawyer who knows contracts")
    assert parsed["primary"] == ["law"]


def test_hinglish_with_the_marker_at_the_end():
    assert match.parse_need("mujhe ek designer chahiye")["primary"] == ["design"]
    assert match.parse_need("ek lawyer chahiye startup ke liye")["primary"][0] == "law"
