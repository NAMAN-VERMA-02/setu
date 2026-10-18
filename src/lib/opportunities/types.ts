export type FeedOpp = {
  id: string;
  kind: string;
  title: string;
  description: string;
  company: string | null;
  skills: string[];
  mode: string | null;
  location: string | null;
  createdAt: string;
  deadline: string | null;
  poster: { id: string; name: string; role: string; headline: string | null } | null;
  /** My own interest status, if I have sent one. */
  interest: string | null;
  score: number;
  reasons: string[];
};

/** Body of GET /api/opportunities. */
export type FeedResponse = { canPost: boolean; opportunities: FeedOpp[] };

export type MineApplicant = {
  id: string;
  note: string | null;
  status: string;
  createdAt: string;
  person: { id: string; name: string; role: string; batch: number; branch: string; headline: string | null } | null;
  reasons: string[];
};

export type MineOpp = { id: string; kind: string; title: string; status: string; createdAt: string; applicants: MineApplicant[] };

/** Body of GET /api/opportunities/mine. */
export type MineResponse = { opportunities: MineOpp[] };

export type Result = { ok: boolean; error?: string };
