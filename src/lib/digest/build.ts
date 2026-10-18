export type DigestInput = {
  name: string;
  siteUrl: string;
  /** Titles of notifications they have not read yet, newest first. */
  unread: string[];
  /** Fresh open opportunities in their college. */
  opportunities: { title: string; company: string | null; kind: string }[];
};

export type Digest = { subject: string; text: string };

const MAX_UNREAD = 6;
const MAX_OPPS = 3;

/** The weekly email. Returns null when there is nothing worth sending, so quiet weeks stay quiet. */
export function buildDigest(input: DigestInput): Digest | null {
  const unread = input.unread.slice(0, MAX_UNREAD);
  const opps = input.opportunities.slice(0, MAX_OPPS);
  if (unread.length === 0 && opps.length === 0) return null;

  const first = input.name.replace(/\s*\(.*?\)\s*/g, " ").trim().split(/\s+/)[0] || "there";
  const site = input.siteUrl.replace(/\/+$/, "");
  const lines: string[] = [`Hi ${first},`, ""];

  if (unread.length > 0) {
    const more = input.unread.length - unread.length;
    lines.push(`You have ${input.unread.length} update${input.unread.length === 1 ? "" : "s"} waiting:`);
    for (const u of unread) lines.push(`- ${u}`);
    if (more > 0) lines.push(`- and ${more} more`);
    lines.push(`See them: ${site}/notifications`, "");
  }
  if (opps.length > 0) {
    lines.push("New this week at your college:");
    for (const o of opps) lines.push(`- ${o.title}${o.company ? ` at ${o.company}` : ""} (${o.kind})`);
    lines.push(`Browse: ${site}/opportunities`, "");
  }
  lines.push("You get this once a week. Turn it off any time on your notifications page: " + `${site}/notifications`);

  return { subject: unread.length > 0 ? `${input.unread.length} update${input.unread.length === 1 ? "" : "s"} waiting on SETU` : "New opportunities this week on SETU", text: lines.join("\n") };
}
