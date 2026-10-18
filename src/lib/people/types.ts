import type { ConnState } from "@/lib/connections/types";

export type PersonCard = {
  id: string;
  name: string;
  role: string;
  batch: number;
  branch: string;
  headline: string | null;
  company: string | null;
  title: string | null;
  expertise: string[];
  openTo: string[];
  intents: { kind: string; category: string; statement: string }[];
  reasons: string[];
  vouches?: number;
  connection: ConnState;
};

/** Body of GET /api/people. */
export type PeopleResponse = { total: number; people: PersonCard[] };
