"""Shared vocabulary for professionals: domains people work in, what they offer and need, and what they are open to.

Offers and needs use the same tags as domains, so "I am a doctor who needs a developer" is a plain
tag match: needs ["software"] against someone who offers ["software"].
"""
from __future__ import annotations

DOMAINS = [
    "software", "ai-ml", "data", "healthcare", "law", "finance", "design", "marketing",
    "education", "research", "hardware", "operations", "entrepreneurship", "media",
]

DOMAIN_LABEL = {
    "software": "Software", "ai-ml": "AI/ML", "data": "Data", "healthcare": "Healthcare", "law": "Legal",
    "finance": "Finance", "design": "Design", "marketing": "Marketing", "education": "Education",
    "research": "Research", "hardware": "Hardware", "operations": "Operations",
    "entrepreneurship": "Founder", "media": "Media",
}

OPEN_TO = ["intros", "mentoring", "collaboration", "hiring", "advice", "speaking"]

# Words people use in plain language, mapped to a domain tag.
SYNONYMS: dict[str, list[str]] = {
    "software": ["developer", "developers", "programmer", "coder", "coders", "coding", "software", "app", "apps",
                 "application", "website", "web", "backend", "frontend", "fullstack", "full-stack", "api", "mobile",
                 "android", "ios", "engineer", "tech", "technical", "build", "saas", "platform"],
    "ai-ml": ["ai", "ml", "machine", "learning", "model", "models", "llm", "nlp", "vision", "deep", "neural", "chatbot"],
    "data": ["data", "analytics", "analyst", "dashboard", "sql", "bi", "statistics", "statistician"],
    "healthcare": ["doctor", "doctors", "medical", "health", "healthcare", "hospital", "patient", "patients", "clinical",
                   "clinic", "nurse", "pharma", "pharmacist", "cardiologist", "physician", "surgeon", "medicine", "dental"],
    "law": ["lawyer", "lawyers", "legal", "advocate", "contract", "contracts", "compliance", "patent", "attorney", "law", "ip"],
    "finance": ["finance", "financial", "accountant", "accounting", "ca", "tax", "investor", "investors", "fund", "funding",
                "banking", "audit", "cfo", "bookkeeping"],
    "design": ["design", "designer", "designers", "ui", "ux", "brand", "branding", "graphic", "prototype", "figma"],
    "marketing": ["marketing", "growth", "seo", "sales", "social", "content", "ads", "campaign", "pr"],
    "education": ["teacher", "teaching", "tutor", "professor", "curriculum", "education", "training", "coach", "coaching"],
    "research": ["research", "researcher", "scientist", "phd", "paper", "lab", "study", "clinical-trial"],
    "hardware": ["hardware", "embedded", "electronics", "iot", "robotics", "mechanical", "sensor", "device", "firmware"],
    "operations": ["operations", "logistics", "supply", "manufacturing", "procurement", "warehouse"],
    "entrepreneurship": ["founder", "founders", "startup", "startups", "entrepreneur", "cofounder", "co-founder", "venture"],
    "media": ["journalist", "video", "film", "writer", "editor", "podcast", "media", "photography", "documentary"],
}

# Words that introduce what someone is looking for ("I need a developer", "mujhe developer chahiye").
NEED_MARKERS = ["need", "needs", "looking", "want", "wants", "find", "hire", "seeking", "require", "chahiye",
                "chahiye.", "zaroorat", "dhundh", "dhoondh", "someone", "anyone", "who can", "help with"]

# What an alumnus's college skills and job title suggest they can offer.
SKILL_TO_DOMAIN = {"python": "software", "ml": "ai-ml", "web": "software", "dsa": "software", "cloud": "software",
                   "design": "design"}
TITLE_TO_DOMAIN = [
    ("machine learning", "ai-ml"), ("ml ", "ai-ml"), ("data scientist", "ai-ml"), (" ai ", "ai-ml"),
    ("ml engineer", "software"), ("ai engineer", "software"),  # they also write software
    ("data ", "data"), ("analyst", "data"), ("analytics", "data"),
    # "engineer" alone says nothing: a mechanical engineer is not a software engineer
    ("software", "software"), ("developer", "software"), ("backend", "software"), ("frontend", "software"),
    ("full-stack", "software"), ("devops", "software"), ("cloud", "software"), ("mobile", "software"),
    ("platform", "software"), ("systems engineer", "software"), ("site reliability", "software"),
    ("product manager", "operations"), ("design", "design"), ("founder", "entrepreneurship"),
    ("professor", "education"), ("research", "research"),
    ("mechanical", "hardware"), ("embedded", "hardware"), ("hardware", "hardware"), ("electronics", "hardware"),
    ("robotics", "hardware"),
]
