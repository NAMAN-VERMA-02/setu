/** The same vocabulary the professional node uses (node/taxonomy.py): fields, and what people offer, need and are open to. */
export const DOMAINS = ["software", "ai-ml", "data", "healthcare", "law", "finance", "design", "marketing", "education", "research", "hardware", "operations", "entrepreneurship", "media"] as const;
export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABEL: Record<string, string> = {
  software: "Software", "ai-ml": "AI/ML", data: "Data", healthcare: "Healthcare", law: "Legal", finance: "Finance", design: "Design",
  marketing: "Marketing", education: "Education", research: "Research", hardware: "Hardware", operations: "Operations",
  entrepreneurship: "Founder", media: "Media",
};

export const OPEN_TO = ["intros", "mentoring", "collaboration", "hiring", "advice", "speaking"] as const;
export const OPEN_TO_LABEL: Record<string, string> = {
  intros: "Introductions", mentoring: "Mentoring", collaboration: "Collaboration", hiring: "Hiring", advice: "Advice", speaking: "Speaking",
};

/** Things people actually type, shown as one-tap examples on the Find screen. */
export const NEED_EXAMPLES = [
  "I am a doctor and I need a developer to build a patient follow-up app",
  "I need a startup lawyer for my company",
  "mujhe ek designer chahiye",
  "who can help me with machine learning on clinical data",
];
