"""Need-to-offer matching: "a doctor who needs a developer" finds people who offer software.

Only public fields are ever returned (domain, title, company, years, offer tags). A person's own words about
themselves ("about") never leave the node except to someone they consented to.
"""
from __future__ import annotations

import re

import taxonomy

_WORD = re.compile(r"[a-z0-9][a-z0-9\-+]*")
POSTFIX_MARKERS = {"chahiye", "zaroorat", "dhundh", "dhoondh"}
FILLER = {"for", "a", "an", "the", "to", "some", "with", "help", "who", "can", "ek", "koi", "mujhe", "me", "my", "of"}
CONNECTORS = {"to", "for", "who", "that", "which", "with", "in", "on", "because", "so", "jo", "ke"}


def words(text: str) -> list[str]:
    return _WORD.findall((text or "").lower())


def tags_in(tokens: list[str]) -> list[str]:
    found = []
    for domain, syns in taxonomy.SYNONYMS.items():
        if any(t in syns for t in tokens) and domain not in found:
            found.append(domain)
    return found


def parse_need(query: str, explicit: list[str] | None = None) -> dict:
    """Split a plain-words request into the tags that matter most and the supporting ones.

    "I am a doctor and need a developer for a patient app" has the doctor's own domain in it, but what the
    person is looking for is whatever follows "need": that is the primary tag; the rest only support.
    """
    toks = words(query)
    explicit = [t for t in (explicit or []) if t in taxonomy.DOMAINS]
    marks = [i for i, t in enumerate(toks) if t in taxonomy.NEED_MARKERS]
    # people often explain first and ask last ("I run a clinic. I want X. I need a developer"): the last ask counts
    start = None
    for i in reversed(marks):
        probe = toks[:i] if toks[i] in POSTFIX_MARKERS else toks[i + 1:]
        probe = [t for t in probe if t not in FILLER]
        if tags_in(probe[:8]):
            start = i
            break
    if start is None and marks:
        start = marks[0]
    if start is not None:
        after, before = toks[start + 1:], toks[:start]
        if toks[start] in POSTFIX_MARKERS:
            # Hinglish puts the thing first: "mujhe ek designer chahiye"
            after, before = before[-6:], []
        while after and after[0] in FILLER:
            after = after[1:]
        # what is asked for ends at the first connecting word: "a developer | to build a patient app"
        cut = next((i for i, t in enumerate(after) if t in CONNECTORS), len(after))
        primary = tags_in(after[:cut][:8])
        secondary = [t for t in tags_in(after[cut:]) if t not in primary]
        if not primary:
            primary = tags_in(after)
            secondary = []
        context = [t for t in tags_in(before) if t not in primary and t not in secondary]
    else:
        everything = tags_in(toks)
        primary, secondary, context = everything, [], []
    for t in explicit:
        if t not in primary:
            primary.insert(0, t)
    return {"primary": primary, "secondary": secondary, "context": context, "keywords": [t for t in toks if len(t) > 2]}


def _title_domains(title: str | None) -> list[str]:
    t = f" {(title or '').lower()} "
    out = []
    for needle, domain in taxonomy.TITLE_TO_DOMAIN:
        if needle in t and domain not in out:
            out.append(domain)
    return out


def offers_of(person: dict, profile: dict | None) -> list[str]:
    """What this person can offer, as domain tags."""
    if profile:
        offers = list(profile.get("offers") or [])
        if profile.get("domain") and profile["domain"] not in offers:
            offers.insert(0, profile["domain"])
        return offers
    # What the job title says wins: a mechanical engineer who once learned Python does not offer software.
    # College skills are only used when the title tells us nothing.
    from_title = _title_domains(person.get("title"))
    if from_title:
        return from_title
    out: list[str] = []
    for s in person.get("skills") or []:
        d = taxonomy.SKILL_TO_DOMAIN.get(s)
        if d and d not in out:
            out.append(d)
    return out


def score(parsed: dict, offers: list[str], domain_words: str) -> tuple[float, list[str]]:
    primary, secondary = parsed["primary"], parsed["secondary"]
    if not primary and not secondary:
        weight_total, got = 0, 0
    else:
        weight_total = 2 * len(primary) + len(secondary)
        got = 2 * sum(1 for t in primary if t in offers) + sum(1 for t in secondary if t in offers)
    tag_part = (got / weight_total) if weight_total else 0.0
    kw = parsed["keywords"]
    hay = set(words(domain_words))
    kw_part = (sum(1 for k in kw if k in hay) / max(len(kw), 1)) if kw else 0.0
    matched = [t for t in primary + secondary if t in offers]
    # context tags (the seeker's own world) lift people who know that world too, without deciding the match
    ctx = sum(1 for t in parsed["context"] if t in offers) * 0.04
    total = min(0.99, 0.82 * tag_part + 0.14 * min(kw_part * 3, 1) + min(ctx, 0.08) + (0.04 if matched else 0))
    return total, matched


def rank(store, query: str, tags: list[str] | None, limit: int, exclude_pid: str | None = None) -> list[dict]:
    parsed = parse_need(query, tags)
    rows = []
    for p in store.people():
        if p["role"] not in ("alum", "professional") or not p["open_to_intros"]:
            continue
        pid = store.pid(p["local_id"])
        if pid == exclude_pid:
            continue
        profile = store.profile(p["local_id"]) if p["role"] == "professional" else None
        offers = offers_of(p, profile)
        domain = profile["domain"] if profile else (offers[0] if offers else None)
        text = " ".join(filter(None, [p.get("title"), p.get("company"), (profile or {}).get("specialty"), domain, *offers]))
        s, matched = score(parsed, offers, text)
        if s < 0.2 or not matched:
            continue
        # what was actually asked for must be offered: "I need a developer" never answers with other doctors
        if parsed["primary"] and not any(t in offers for t in parsed["primary"]):
            continue
        reasons = [f"Offers {', '.join(taxonomy.DOMAIN_LABEL.get(t, t) for t in matched)}"]
        if profile and profile.get("years_exp"):
            reasons.append(f"{profile['years_exp']} years of experience")
        ctx_hit = [t for t in parsed["context"] if t in offers]
        if ctx_hit:
            reasons.append(f"Also knows {', '.join(taxonomy.DOMAIN_LABEL.get(t, t) for t in ctx_hit)}")
        if profile and profile.get("open_to"):
            reasons.append("Open to " + ", ".join(profile["open_to"][:3]))
        rows.append({
            "pid": pid, "score": round(s, 2), "domain": domain, "title": p.get("title"), "company": p.get("company"),
            "years_exp": (profile or {}).get("years_exp"), "grad_year": p.get("grad_year"), "role": p["role"],
            "offers": offers, "open_to": (profile or {}).get("open_to", []), "reasons": reasons,
        })
    rows.sort(key=lambda r: (-r["score"], r["pid"]))
    return rows[:limit]
