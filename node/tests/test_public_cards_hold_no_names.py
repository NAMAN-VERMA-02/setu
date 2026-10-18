"""The public job card (title, company, field) must never contain a person's own name.

A company called "Iyer & Co." would put a surname into a field the hub stores, which defeats the point.
"""
import os
import sys
from pathlib import Path

os.environ["SETU_NODE_NO_AUTOLOAD"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

from seed import generate, pro  # noqa: E402


def _datasets():
    yield "pro", pro.build()
    yield "ngit", generate.build("ngit")
    yield "rce", generate.build("rce")


@pytest.mark.parametrize("node,ds", list(_datasets()))
def test_no_public_field_contains_the_persons_own_name(node, ds):
    leaks = []
    for p in ds["people"]:
        parts = [w.strip(".,").lower() for w in p["name"].replace("Dr.", "").replace("Adv.", "").split() if len(w.strip(".,")) > 2]
        public = " ".join(filter(None, [p.get("title"), p.get("company")])).lower()
        leaks += [(p["name"], w) for w in parts if w in public.split() or f" {w} " in f" {public} "]
    assert leaks == [], leaks
