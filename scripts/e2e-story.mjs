// Plays the whole demo story against a running hub and its two college nodes, and prints PASS/FAIL per step.
// Usage: node scripts/e2e-story.mjs [hub-url]      (default http://localhost:3000)
// Reads DEMO_STAGE_KEY, NODE_*_URL, NODE_*_HUB_TOKEN, NODE_*_VIEWER_SECRET from .env.local (or the environment).
import { existsSync, readFileSync } from "node:fs";

const HUB = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const env = { ...process.env };
// For the deployed run pass the Vercel env file: node scripts/e2e-story.mjs https://oddyssey-nu.vercel.app .env.vercel.production
const ENV_FILE = process.argv[3] ?? ".env.local";
for (const file of [ENV_FILE, ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2];
  }
}
const STAGE = env.DEMO_STAGE_KEY;
const NODE = { ngit: env.NEXT_PUBLIC_NODE_NGIT_URL ?? env.NODE_NGIT_URL, rce: env.NEXT_PUBLIC_NODE_RCE_URL ?? env.NODE_RCE_URL, pro: env.NEXT_PUBLIC_NODE_PRO_URL ?? env.NODE_PRO_URL };
const ADMIN = { ngit: env.NODE_NGIT_ADMIN_PASSWORD, rce: env.NODE_RCE_ADMIN_PASSWORD, pro: env.NODE_PRO_ADMIN_PASSWORD };

class Jar {
  cookies = new Map();
  async req(path, { method = "GET", json, headers = {}, base = HUB } = {}) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { ...(json ? { "content-type": "application/json" } : {}), cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...headers },
      body: json ? JSON.stringify(json) : undefined,
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }
}

const results = [];
let t0 = Date.now();
async function step(name, fn) {
  const started = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`PASS  ${name}  (${Date.now() - started} ms)${note ? `  ${note}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - started });
    console.log(`FAIL  ${name}  ${e instanceof Error ? e.message : e}`);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const stageHeaders = { "x-stage-key": STAGE };
const tokenOf = (link) => link.split("/h/")[1];

const aman = new Jar();
let introId;
let target;

await step("reset demo under 10 s (also switches every server's hub access back on)", async () => {
  const s = Date.now();
  const r = await new Jar().req("/api/fed/admin/reset", { method: "POST", headers: stageHeaders });
  assert(r.ok, `reset failed: ${JSON.stringify(r.data)}`);
  assert(Date.now() - s < 10000, `took ${Date.now() - s} ms`);
  return `${r.data.people} people, ${r.data.edges} edges`;
});

await step("all three servers online", async () => {
  const r = await new Jar().req("/api/fed/health");
  assert(r.ok && r.data.nodes.length === 3 && r.data.nodes.every((n) => n.status === "online"), `status: ${JSON.stringify(r.data.nodes?.map((n) => [n.id, n.status]))}`);
  return r.data.nodes.map((n) => `${n.id}=${n.latencyMs}ms`).join(" ");
});

let viewer;
await step("Aman picks his persona", async () => {
  const p = await aman.req("/api/fed/persona", { method: "POST", json: { story_key: "aman" } });
  assert(p.ok, JSON.stringify(p.data));
  const s = await aman.req("/api/fed/session");
  assert(s.data.session?.storyKey === "aman", "session not set");
  viewer = s.data.viewer;
  assert(viewer.ngit && viewer.rce, "missing viewer tokens");
  return `ledger ${s.data.ledger.points} pts / ${s.data.ledger.karz} karz`;
});

await step("Mirror: Priya on top, matches from both colleges", async () => {
  const r = await aman.req("/api/fed/mirror");
  assert(r.ok, JSON.stringify(r.data));
  const top = r.data.matches[0];
  assert(top.percent >= 90, `top match only ${top.percent}%`);
  assert(/ML Engineer/.test(top.label) && /FinStack/.test(top.label), `top is ${top.label}`);
  const nodes = new Set(r.data.matches.map((m) => m.node));
  assert(nodes.has("ngit") && nodes.has("rce"), `only ${[...nodes]}`);
  assert(!/Priya/.test(JSON.stringify(r.data)), "a name leaked through the hub");
  return `${r.data.matches.length} matches, top ${top.percent}% ${top.sharedTrait}`;
});

await step("Bridge: best 39.6% vs shortest 12%", async () => {
  const t = await aman.req("/api/fed/targets?q=FinStack");
  target = t.data.targets.find((x) => /Hiring Manager/.test(x.title ?? ""));
  assert(target, "Hiring Manager not found");
  const r = await aman.req(`/api/fed/route?target=${target.pid}`);
  assert(r.data.status === "ok", JSON.stringify(r.data));
  assert(Math.abs(r.data.best.prob - 0.396) < 0.0015, `best ${r.data.best.prob}`);
  assert(Math.abs(r.data.shortest.prob - 0.12) < 0.0015, `shortest ${r.data.shortest.prob}`);
  assert(r.data.best.path.length === 4, `best path has ${r.data.best.path.length} people`);
});

await step("Aman sends the intro (ask stays on NGIT's server)", async () => {
  const r = await aman.req("/api/fed/intro", { method: "POST", json: { target: target.pid, trust_step: "call" } });
  assert(r.ok && r.data.intro_id, JSON.stringify(r.data));
  introId = r.data.intro_id;
  const ask = await fetch(`${viewer.ngit.url}/public/asks`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-setu-viewer": viewer.ngit.token },
    body: JSON.stringify({ intro_id: introId, text: "Hi, I am a 3rd-year ECE student. Could you spare 15 minutes?", work_url: null }),
  });
  assert(ask.ok, `node refused the ask: ${ask.status}`);
  const state = await aman.req(`/api/fed/intro/${introId}`);
  assert(!JSON.stringify(state.data).includes("15 minutes"), "ask text reached the hub");
  return `chance ${Math.round(r.data.prob * 1000) / 10}%`;
});

async function inbox(key) {
  const r = await new Jar().req(`/api/fed/inbox?as=${key}`);
  assert(r.ok, `${key} inbox: ${JSON.stringify(r.data)}`);
  const waiting = r.data.items.find((i) => i.status === "sent");
  assert(waiting, `${key} has nothing waiting`);
  return tokenOf(waiting.link);
}
async function act(key, accept, response, note) {
  const token = await inbox(key);
  const jar = new Jar();
  const ctx = await jar.req(`/api/fed/hop/${token}`);
  assert(ctx.ok, `hop context: ${JSON.stringify(ctx.data)}`);
  if (note && ctx.data.read) {
    await fetch(`${ctx.data.read.url}/public/asks/${ctx.data.intro.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-setu-viewer": ctx.data.read.token },
      body: JSON.stringify({ text: note }),
    });
  }
  const r = await jar.req(`/api/fed/hop/${token}`, { method: "POST", json: { accept, ...(response ? { response } : {}) } });
  assert(r.ok, `${key} act: ${JSON.stringify(r.data)}`);
  return { ctx: ctx.data, result: r.data };
}

await step("Rohan says yes with a note; the hop page can read the ask from NGIT", async () => {
  const { ctx } = await act("rohan", true, undefined, "I know Aman. Passing this on.");
  assert(ctx.read?.node === "ngit", "no direct read path to the requester's node");
  const ask = await fetch(`${ctx.read.url}/public/asks/${ctx.intro.id}`, { headers: { "x-setu-viewer": ctx.read.token } });
  assert(ask.ok && (await ask.json()).text.includes("15 minutes"), "Rohan cannot read the ask");
});

await step("Vikram declines silently; Setu re-routes via Priya at 37.8%", async () => {
  await act("vikram", false);
  const s = await aman.req(`/api/fed/intro/${introId}`);
  assert(s.data.intro.status === "in_progress", `status ${s.data.intro.status}`);
  assert(Math.abs(s.data.intro.success_prob - 0.378) < 0.0015, `prob ${s.data.intro.success_prob}`);
  const sent = s.data.hops.find((h) => h.status === "sent");
  const priya = s.data.people.find((p) => p.pid === sent.to_pid);
  assert(priya?.company === "FinStack" && priya.node === "ngit", "new hop is not the NGIT alum");
  assert(!JSON.stringify(s.data).toLowerCase().includes("vikram"), "the decliner is identifiable");
});

await step("Priya says yes", async () => {
  await act("priya", true);
});

await step("Meera picks a 15-minute call; intro delivered", async () => {
  await act("meera", true, "call");
  const s = await aman.req(`/api/fed/intro/${introId}`);
  assert(s.data.intro.status === "delivered" && s.data.intro.response === "call", `${s.data.intro.status}/${s.data.intro.response}`);
});

await step("Aman reads the names straight from the colleges", async () => {
  const s = await aman.req(`/api/fed/intro/${introId}`);
  const accepted = s.data.hops.filter((h) => h.status === "accepted").map((h) => h.to_pid);
  const names = {};
  for (const node of ["ngit", "rce"]) {
    const pids = accepted.filter((p) => p.startsWith(`${node}_`));
    if (!pids.length) continue;
    const r = await fetch(`${s.data.viewer[node].url}/public/cards`, { method: "POST", headers: { "content-type": "application/json", "x-setu-viewer": s.data.viewer[node].token }, body: JSON.stringify({ pids }) });
    for (const c of await r.json()) if (c.name) names[c.pid] = c.name;
  }
  assert(Object.keys(names).length === accepted.length, `names for ${Object.keys(names).length} of ${accepted.length}`);
  assert(Object.values(names).some((n) => n.includes("Meera")), "Meera's name was not revealed");
  return Object.values(names).join(", ");
});

await step("Hire: +100 to everyone who said yes", async () => {
  const before = (await aman.req("/api/fed/session")).data.ledger;
  const r = await new Jar().req(`/api/fed/intro/${introId}/hire`, { method: "POST", headers: stageHeaders });
  assert(r.ok && r.data.helpers === 3, JSON.stringify(r.data));
  const lb = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/fed_leaderboard?select=pid,points,score&order=score.desc&limit=8`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` } }).then((x) => x.json());
  assert(lb.length > 0, "leaderboard unreadable");
  return `Aman still ${before.score}; top score ${lb[0].score}`;
});

// ---------------- the professional story: a doctor needs a developer ----------------
const NEED = "I am a doctor and I need a developer to build a patient follow-up app";
const doctor = new Jar();
let docViewer;
let ishaan;
let docIntro;

await step("Professional network is online and holds its own people", async () => {
  const h = await new Jar().req("/api/fed/health");
  const pro = h.data.nodes.find((n) => n.id === "pro");
  assert(pro?.status === "online", `pro node is ${pro?.status}`);
  assert(pro.people >= 40, `only ${pro.people} people`);
  return `${pro.people} professionals, ${pro.latencyMs} ms`;
});

await step("Dr. Ananya picks her persona; her own words are read from the professional server", async () => {
  const p = await doctor.req("/api/fed/persona", { method: "POST", json: { story_key: "ananya" } });
  assert(p.ok, JSON.stringify(p.data));
  const s = await doctor.req("/api/fed/session");
  assert(s.data.session.role === "professional", `role is ${s.data.session.role}`);
  docViewer = s.data.viewer;
  const me = await fetch(`${docViewer.pro.url}/public/me`, { headers: { "x-setu-viewer": docViewer.pro.token } }).then((r) => r.json());
  assert(/need a developer/.test(me.about) && me.needs.includes("software"), "her profile text did not come back from her own server");
  const hubSees = JSON.stringify((await doctor.req("/api/fed/session")).data);
  assert(!/need a developer|cardiac clinic/.test(hubSees), "the hub returned her private words");
});

await step("Find: a plain-words need returns the health-app developer first, from the whole network", async () => {
  const r = await doctor.req("/api/fed/match", { method: "POST", json: { query: NEED } });
  assert(r.ok, JSON.stringify(r.data));
  const top = r.data.results[0];
  assert(/Developer/.test(top.title ?? ""), `top result is ${top.title}`);
  assert(top.percent >= 85, `top match only ${top.percent}%`);
  assert(r.data.searched.length === 3 && r.data.searched.every((s) => s.ok), `searched ${JSON.stringify(r.data.searched)}`);
  assert(!r.data.results.some((x) => /Cardiologist|Physician|Surgeon/.test(x.title ?? "")), "doctors came back for a request for a developer");
  assert(!/Ishaan|Kapoor/.test(JSON.stringify(r.data)), "a name leaked through Find");
  ishaan = top.pid;
  return `${top.title}, ${top.company} ${top.percent}%; warmest route ${top.route ? Math.round(top.route.chance * 1000) / 10 + "%" : "none"}`;
});

await step("Bridge for the doctor: through a trusted CTO 59.5% vs a cold message 20%", async () => {
  const r = await doctor.req(`/api/fed/route?target=${ishaan}`);
  assert(r.data.status === "ok", JSON.stringify(r.data));
  assert(Math.abs(r.data.best.prob - 0.595) < 0.002, `best ${r.data.best.prob}`);
  assert(r.data.best.path.length === 3, `best path has ${r.data.best.path.length} people`);
  assert(r.data.shortest.path.length === 2 && Math.abs(r.data.shortest.prob - 0.2) < 0.002, `shortest ${JSON.stringify(r.data.shortest)}`);
});

await step("Bridge hand-off from Find finds the exact person, and the AI draft speaks as a professional", async () => {
  const one = await doctor.req(`/api/fed/targets?pid=${ishaan}`);
  assert(one.data.targets?.length === 1 && one.data.targets[0].pid === ishaan, "Bridge could not look the person up by id");
  const d = await doctor.req("/api/fed/draft", { method: "POST", json: { target: ishaan } });
  assert(d.ok && typeof d.data.draft === "string", JSON.stringify(d.data));
  assert(d.data.draft.includes("{myName}"), "the draft has no name placeholder");
  assert(!/student|college|semester/i.test(d.data.draft), `the draft talks like a student: ${d.data.draft.slice(0, 120)}`);
  assert(!/Ananya|Rao|Ishaan|Kapoor/.test(d.data.draft), "the draft contains a real name");
  return d.data.fallback ? "template" : "AI";
});

await step("Doctor sends the intro; the CTO and the developer both say yes", async () => {
  const sent = await doctor.req("/api/fed/intro", { method: "POST", json: { target: ishaan, trust_step: "call" } });
  assert(sent.ok && sent.data.intro_id, JSON.stringify(sent.data));
  docIntro = sent.data.intro_id;
  const ask = await fetch(`${docViewer.pro.url}/public/asks`, { method: "POST", headers: { "content-type": "application/json", "x-setu-viewer": docViewer.pro.token }, body: JSON.stringify({ intro_id: docIntro, text: "I run a cardiac clinic and need a patient follow-up app. Could we talk for 15 minutes?", work_url: null }) });
  assert(ask.ok, `professional server refused the ask: ${ask.status}`);
  // a guest can scan a QR for whoever is being asked right now and play them
  await new Jar().req("/api/fed/stage", { method: "POST", headers: stageHeaders, json: { action: "qr_hop:on" } });
  const overlay = await new Jar().req("/api/fed/overlay");
  await new Jar().req("/api/fed/stage", { method: "POST", headers: stageHeaders, json: { action: "qr_hop:off" } });
  assert(overlay.data.hop?.link?.includes("/h/") && /CTO/.test(overlay.data.hop.label), `overlay: ${JSON.stringify(overlay.data)}`);
  assert(!/Rahul|Desai/.test(JSON.stringify(overlay.data.hop.label)), "the QR label names the person");
  const off = await new Jar().req("/api/fed/overlay");
  assert(off.data.hop === null, "the QR stayed on after it was switched off");
  await act("rahul", true, undefined, "Ananya is a great doctor. Ishaan, worth a call.");
  const mid = await doctor.req(`/api/fed/intro/${docIntro}`);
  assert(mid.data.hops.find((h) => h.status === "sent")?.is_target, "the developer was not asked after the CTO said yes");
  await act("ishaan", true, "call");
  const done = await doctor.req(`/api/fed/intro/${docIntro}`);
  assert(done.data.intro.status === "delivered" && done.data.intro.response === "call", `${done.data.intro.status}/${done.data.intro.response}`);
});

await step("Doctor now reads both names and the note straight from the professional server", async () => {
  const s = await doctor.req(`/api/fed/intro/${docIntro}`);
  const accepted = s.data.hops.filter((h) => h.status === "accepted").map((h) => h.to_pid);
  const cards = await fetch(`${s.data.viewer.pro.url}/public/cards`, { method: "POST", headers: { "content-type": "application/json", "x-setu-viewer": s.data.viewer.pro.token }, body: JSON.stringify({ pids: accepted }) }).then((r) => r.json());
  const names = cards.filter((c) => c.name).map((c) => c.name);
  assert(names.includes("Rahul Desai") && names.includes("Ishaan Kapoor"), `names: ${names.join(", ")}`);
  const ask = await fetch(`${s.data.viewer.pro.url}/public/asks/${docIntro}`, { headers: { "x-setu-viewer": s.data.viewer.pro.token } }).then((r) => r.json());
  assert(ask.notes.some((n) => /worth a call/.test(n.text)), "the CTO's note did not arrive");
  const hub = JSON.stringify(s.data);
  assert(!/Rahul Desai|Ishaan Kapoor|worth a call|cardiac clinic/.test(hub), "the hub holds a name or message");
  return names.join(", ");
});

await step("A professional joins from a phone and can immediately find help", async () => {
  const lawyer = new Jar();
  const j = await fetch(`${NODE.pro}/public/join`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: HUB },
    body: JSON.stringify({ name: "Test Architect", role: "professional", domain: "operations", title: "Architect", company: "Studio Nine", years_exp: 10, city: "Jaipur", offers: ["operations"], needs: ["software"], open_to: ["intros"], about: "I need a developer for a site-inspection app.", open_to_intros: true, on_leaderboard: true, is_18_plus: true }),
  });
  const body = await j.json();
  assert(j.ok && body.pid, `professional server refused: ${JSON.stringify(body)}`);
  const reg = await lawyer.req("/api/fed/register", { method: "POST", json: { pid: body.pid, node: "pro" } });
  assert(reg.ok, JSON.stringify(reg.data));
  const f = await lawyer.req("/api/fed/match", { method: "POST", json: { query: "I need a developer for an inspection app" } });
  assert(f.ok && f.data.results.length > 0, "a new professional found nobody");
  const m = await lawyer.req("/api/fed/mirror");
  assert(m.ok && m.data.notStudent === true, "Mirror should tell a professional to use Find");
  return `${f.data.results.length} results, route to the best: ${f.data.results[0].route ? "yes" : "none yet"}`;
});

async function adminAccess(node, on) {
  const r = await fetch(`${NODE[node]}/admin/hub-access`, { method: "POST", headers: { "content-type": "application/json", "x-admin-password": ADMIN[node] ?? "admin" }, body: JSON.stringify({ on }) });
  assert(r.ok, `admin toggle failed: ${r.status}`);
}
await step("Kill switch: RCE off, then on", async () => {
  if (!ADMIN.rce) return "skipped (no NODE_RCE_ADMIN_PASSWORD in .env.local; node admin password needed)";
  await adminAccess("rce", false);
  await new Jar().req("/api/fed/health");
  const off = await aman.req(`/api/fed/route?target=${target.pid}`);
  assert(off.data.status === "target_offline", `expected target_offline, got ${off.data.status}`);
  const m = await aman.req("/api/fed/mirror");
  assert(m.data.matches.every((x) => x.node !== "rce"), "RCE people still shown");
  const s = Date.now();
  await adminAccess("rce", true);
  let back = false;
  while (Date.now() - s < 3000 && !back) {
    await new Jar().req("/api/fed/health");
    back = (await aman.req(`/api/fed/route?target=${target.pid}`)).data.status === "ok";
  }
  assert(back, "RCE did not come back within 3 s");
  return `back in ${Date.now() - s} ms`;
});

await step("A judge joins from a phone and sees their Mirror", async () => {
  const judge = new Jar();
  const j = await fetch(`${NODE.ngit}/public/join`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: HUB },
    body: JSON.stringify({ name: "Test Judge", role: "student", branch: "ECE", sem: 5, cgpa: 7.3, internship: false, projects: 2, hackathons: 1, skills: ["python", "ml"], goal: "ML engineer at a fintech", open_to_intros: true, on_leaderboard: true, is_18_plus: true }),
  });
  const body = await j.json();
  assert(j.ok && body.pid, `node refused: ${JSON.stringify(body)}`);
  const reg = await judge.req("/api/fed/register", { method: "POST", json: { pid: body.pid, node: "ngit" } });
  assert(reg.ok, JSON.stringify(reg.data));
  const m = await judge.req("/api/fed/mirror");
  assert(m.ok && m.data.matches.length > 0, "judge Mirror is empty");
  return `${m.data.matches.length} matches`;
});

await step("Ask Setu returns a trace from both colleges", async () => {
  const r = await new Jar().req("/api/fed/ask", { method: "POST", json: { question: "NGIT ke kaunse alumni fintech ML mein madad kar sakte hain?" } });
  assert(r.ok, JSON.stringify(r.data));
  const nodes = new Set(r.data.trace.map((t) => t.node));
  assert(nodes.has("ngit") && nodes.has("rce"), `trace only covers ${[...nodes]}`);
  assert(r.data.trace.every((t) => t.identifyingFields === 0), "a tool call reported identifying fields");
  return `${r.data.mode} mode, ${r.data.trace.length} calls, ${r.data.cards.length} cards`;
});

await step("Ask Setu: a plain-words need in any profession reaches every server over MCP", async () => {
  const r = await new Jar().req("/api/fed/ask", { method: "POST", json: { question: "I am a doctor and I need a developer to build a patient follow-up app" } });
  assert(r.ok, JSON.stringify(r.data));
  const tools = new Set(r.data.trace.map((t) => t.tool));
  const nodes = new Set(r.data.trace.filter((t) => t.tool === "match_need").map((t) => t.node));
  assert(tools.has("match_need"), `tools used: ${[...tools]}`);
  assert(nodes.has("pro"), `match_need reached ${[...nodes]}`);
  assert(r.data.trace.every((t) => t.identifyingFields === 0), "a tool call reported identifying fields");
  assert(r.data.cards.some((c) => /Developer/.test(c.title ?? "")), "no developer came back");
  return `${r.data.mode} mode, match_need on ${[...nodes].join("+")}`;
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed in ${Math.round((Date.now() - t0) / 1000)} s`);
process.exit(failed.length ? 1 : 0);
