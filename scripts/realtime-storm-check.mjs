// Regression check for the "screen refreshes itself forever" bug.
// The hub writes a server's state to fed_nodes, and every open screen listens to that table over Realtime. If searches
// or health pings write on every call, screens refresh themselves in a loop. This subscribes like a screen does, fires a
// burst of searches and pings, and counts the change events: with the fix it is at most a couple, not one per request.
// Usage: node scripts/realtime-storm-check.mjs [hub-url] [env-file]
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

const HUB = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const env = { ...process.env };
for (const file of [process.argv[3] ?? ".env.local", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2];
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let events = 0;
const channel = supabase.channel("storm-check").on("postgres_changes", { event: "*", schema: "public", table: "fed_nodes" }, () => events++);
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("could not subscribe to Realtime")), 15000);
  channel.subscribe((s) => s === "SUBSCRIBED" && (clearTimeout(t), resolve()));
});

const cookies = new Map();
const call = async (path, init = {}) => {
  const res = await fetch(`${HUB}${path}`, { ...init, headers: { "content-type": "application/json", cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...(init.headers ?? {}) } });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    cookies.set(pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1));
  }
  return res;
};

await call("/api/fed/health"); // settle: a first ping may legitimately record a state change
await new Promise((r) => setTimeout(r, 3000));
const settled = events;
events = 0;

await call("/api/fed/persona", { method: "POST", body: JSON.stringify({ story_key: "ananya" }) });
for (let i = 0; i < 6; i++) await call("/api/fed/health");
for (let i = 0; i < 5; i++) await call("/api/fed/match", { method: "POST", body: JSON.stringify({ query: "I need a developer to build a patient app" }) });
for (let i = 0; i < 3; i++) await call("/api/fed/mirror");
await new Promise((r) => setTimeout(r, 6000)); // let any broadcast arrive

await supabase.removeChannel(channel);
console.log(`events while settling: ${settled}`);
console.log(`events caused by 6 health pings + 5 searches + 3 Mirror loads: ${events}`);
if (events > 2) {
  console.log("FAIL: requests are writing to fed_nodes, which makes every open screen refresh in a loop");
  process.exit(1);
}
console.log("PASS: no refresh storm");
process.exit(0);
