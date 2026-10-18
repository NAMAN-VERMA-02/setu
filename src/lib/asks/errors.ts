/** Turns database rule violations into friendly API errors. */
const RULES: { match: string; status: number; message: string }[] = [
  { match: "3 waiting requests", status: 409, message: "That senior has a full queue right now. Try someone else." },
  { match: "one open bridge request", status: 409, message: "You already have a request waiting on a bridging senior." },
  { match: "no contacts at that company", status: 422, message: "That senior has no contacts at that company." },
  { match: "not a senior from your college", status: 422, message: "You can only ask seniors from your college." },
  { match: "closed", status: 410, message: "This request has closed." },
  { match: "one at a time", status: 409, message: "Trust steps unlock one at a time." },
  { match: "asks_work_seen_needs_work", status: 409, message: "The student has not shared any work yet." },
  { match: "asks_check", status: 409, message: "A referral unlocks only after you have seen the student's work." },
  { match: "only the senior", status: 403, message: "Only the senior can do that." },
  { match: "only the student", status: 403, message: "Only the student can do that." },
  { match: "only the bridging senior", status: 409, message: "A forward link already exists for this request." },
  { match: "can only cancel", status: 403, message: "You can only cancel your own request." },
  { match: "not a party", status: 403, message: "That request is not yours." },
];

export function mapDbError(message: string | undefined): { status: number; error: string } {
  const hit = RULES.find((r) => message?.includes(r.match));
  return hit ? { status: hit.status, error: hit.message } : { status: 400, error: "We could not do that. Please try again." };
}
