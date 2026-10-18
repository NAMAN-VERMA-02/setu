// Tries to break the privacy and authorization boundaries of a running hub and its college nodes, and prints
// PASS/FAIL per attempt. Each line is evidence for a claim made on stage.
// Usage: node scripts/privacy-probe.mjs [hub-url] [env-file]
//   e.g. node scripts/privacy-probe.mjs https://oddyssey-nu.vercel.app .env.vercel.production
import { createHmac } from "node:crypto";
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
const NODE = { ngit: env.NEXT_PUBLIC_NODE_NGIT_URL, rce: env.NEXT_PUBLIC_NODE_RCE_URL, ...(env.NEXT_PUBLIC_NODE_PRO_URL ? { pro: env.NEXT_PUBLIC_NODE_PRO_URL } : {}) };
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failed = 0;
async function check(name, fn) {
  try {
    const note = await fn();
    console.log(`PASS  ${name}${note ? `  (${note})` : ""}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}  ${e instanceof Error ? e.message : e}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const call = async (url, init = {}) => {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not json
  }
  return { status: res.status, json, text };
};
const jsonPost = (url, body, headers = {}) => call(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const forgedViewer = (pid, secret = "not-the-real-secret") => {
  const payload = Buffer.from(JSON.stringify({ pid, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
};
const NAMES = /Aman|Rohan|Priya|Meera|Vikram|Karan|Arjun|Kavya|Sneha|Khanna|Mehta|Sharma|Iyer|Nair|Bhatia|Malhotra|Reddy|Joshi|Ananya|Rahul|Ishaan|Meenakshi|Zoya|Desai|Kapoor|Neha Verma/;

// ---------------- college nodes ----------------
for (const [id, base] of Object.entries(NODE)) {
  const hub = env[`NODE_${id.toUpperCase()}_HUB_TOKEN`];
  await check(`${id}: hub endpoints refuse no token and a wrong token`, async () => {
    for (const headers of [{}, { authorization: "Bearer wrong" }]) {
      for (const path of ["/directory", "/edges", "/stats"]) {
        const r = await call(`${base}${path}`, { headers });
        expect(r.status === 401, `${path} gave ${r.status}`);
      }
    }
  });
  await check(`${id}: MCP refuses a missing or wrong token`, async () => {
    for (const headers of [{}, { authorization: "Bearer wrong" }]) {
      const r = await jsonPost(`${base}/mcp`, { jsonrpc: "2.0", id: 1, method: "tools/list" }, { accept: "application/json, text/event-stream", ...headers });
      expect(r.status === 401, `gave ${r.status}`);
    }
  });
  await check(`${id}: admin console refuses a missing or wrong password`, async () => {
    for (const headers of [{}, { "x-admin-password": "admin" }, { "x-admin-password": "wrong" }]) {
      const r = await call(`${base}/admin/api/state`, { headers });
      expect(r.status === 401, `state gave ${r.status}`);
    }
    const toggle = await jsonPost(`${base}/admin/hub-access`, { on: false });
    expect(toggle.status === 401, `anonymous hub-access toggle gave ${toggle.status}`);
    const reset = await jsonPost(`${base}/admin/reset`, {});
    expect(reset.status === 401, `anonymous reset gave ${reset.status}`);
  });
  await check(`${id}: an anonymous visitor cannot read any name`, async () => {
    const dir = await call(`${base}/directory`, { headers: { authorization: `Bearer ${hub}` } });
    const pids = dir.json.map((p) => p.pid).slice(0, 12);
    for (const pid of pids) {
      const r = await call(`${base}/public/card/${pid}`);
      expect(r.status === 403, `card ${pid} gave ${r.status}`);
      expect(!r.json?.name, `card ${pid} leaked a name`);
    }
    const cards = await jsonPost(`${base}/public/cards`, { pids });
    expect(cards.status === 401, `anonymous /public/cards gave ${cards.status}`);
    return `${pids.length} cards masked`;
  });
  await check(`${id}: a forged viewer token (wrong secret) is treated as anonymous`, async () => {
    const dir = await call(`${base}/directory`, { headers: { authorization: `Bearer ${hub}` } });
    const target = dir.json.find((p) => p.role === "alum" || p.role === "professional");
    const r = await call(`${base}/public/card/${target.pid}`, { headers: { "x-setu-viewer": forgedViewer(target.pid) } });
    expect(r.status === 403 && !r.json?.name, `forged self-token gave ${r.status} ${JSON.stringify(r.json)}`);
    const cards = await jsonPost(`${base}/public/cards`, { pids: [target.pid] }, { "x-setu-viewer": forgedViewer(target.pid) });
    expect(cards.status === 401, `forged token on /public/cards gave ${cards.status}`);
  });
  await check(`${id}: hub responses carry an identifying-field count of 0`, async () => {
    for (const path of ["/directory", "/edges"]) {
      const res = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${hub}` } });
      expect(res.headers.get("x-setu-identifying-fields") === "0", `${path}: header was ${res.headers.get("x-setu-identifying-fields")}`);
      const body = await res.text();
      expect(!NAMES.test(body), `${path} body contains a person's name`);
      expect(!/@seed\.invalid|@/.test(body), `${path} body contains an email`);
    }
  });
}

// ---------------- hub authorization ----------------
await check("hub: presenter-only routes refuse everyone without the stage key", async () => {
  for (const [path, method] of [["/api/fed/admin/reset", "POST"], ["/api/fed/stage", "GET"], ["/api/fed/stage", "POST"], ["/api/fed/intro/00000000-0000-4000-8000-000000000001/hire", "POST"]]) {
    for (const headers of [{}, { "x-stage-key": "wrong" }]) {
      const r = await call(`${HUB}${path}`, { method, headers });
      expect(r.status === 403, `${method} ${path} gave ${r.status}`);
    }
  }
});
await check("hub: session-only routes refuse anonymous callers", async () => {
  for (const [path, method] of [["/api/fed/mirror", "GET"], ["/api/fed/route?target=ngit_000000000000", "GET"], ["/api/fed/intro", "POST"], ["/api/fed/draft", "POST"], ["/api/fed/timeline/ngit_000000000000", "GET"]]) {
    const r = await call(`${HUB}${path}`, { method, headers: { "content-type": "application/json" }, body: method === "POST" ? "{}" : undefined });
    expect(r.status === 401, `${method} ${path} gave ${r.status}`);
  }
});
await check("hub: a forged session cookie is rejected", async () => {
  const forged = Buffer.from(JSON.stringify({ pid: "ngit_000000000000", node: "ngit" })).toString("base64url") + "." + createHmac("sha256", "guess").update("x").digest("base64url");
  const r = await call(`${HUB}/api/fed/session`, { headers: { cookie: `setu_fed=${forged}` } });
  expect(r.json?.session === null, `forged cookie produced a session: ${r.text.slice(0, 120)}`);
});
await check("hub: hop links cannot be guessed, edited or swapped", async () => {
  for (const token of ["garbage", "abc.def", "MDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAx.AAAAAAAAAAAAAAAAAAAAAA"]) {
    const r = await call(`${HUB}/api/fed/hop/${token}`);
    expect(r.status === 404, `GET ${token.slice(0, 12)}… gave ${r.status}`);
    const p = await jsonPost(`${HUB}/api/fed/hop/${token}`, { accept: true });
    expect(p.status === 404, `POST ${token.slice(0, 12)}… gave ${p.status}`);
  }
});
await check("hub: unknown or non-persona inbox is refused", async () => {
  // (the placement cells are deliberate demo personas, so they are not in this list)
  for (const as of ["nobody", ""]) {
    const r = await call(`${HUB}/api/fed/inbox?as=${as}`);
    expect(r.status === 404, `as=${as || "(empty)"} gave ${r.status}`);
  }
  // a generated (non-story) person cannot be opened as a persona either
  const dir = await call(`${SUPA}/rest/v1/fed_directory?select=pid,story_key&story_key=is.null&limit=1`, { headers: { apikey: ANON, authorization: `Bearer ${ANON}` } });
  const r = await call(`${HUB}/api/fed/inbox?as=${dir.json[0].pid}`);
  expect(r.status === 404, `generated pid as persona gave ${r.status}`);
});

// ---------------- hub database exposure ----------------
const rest = (path, init = {}) => call(`${SUPA}/rest/v1/${path}`, { ...init, headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": "application/json", ...(init.headers ?? {}) } });
const TABLES = ["fed_nodes", "fed_directory", "fed_edges", "fed_intros", "fed_hops", "fed_ledger", "fed_events", "fed_audit", "fed_vouches", "fed_payforward", "fed_opportunities"];
await check("hub database: no table holds a name, email or phone (anonymous read of every row)", async () => {
  let rows = 0;
  for (const t of TABLES) {
    const r = await rest(`${t}?select=*&limit=5000`);
    expect(r.status === 200, `${t} read gave ${r.status}`);
    rows += r.json.length;
    const text = JSON.stringify(r.json);
    expect(!NAMES.test(text), `${t} contains a person's name`);
    expect(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(text), `${t} contains an email address`);
    expect(!/\b\d{10}\b/.test(text), `${t} contains a phone-like number`);
  }
  return `${rows} rows across ${TABLES.length} tables`;
});
await check("hub database: the public key cannot write or call the point-granting functions", async () => {
  const count = async (table) => {
    const res = await fetch(`${SUPA}/rest/v1/${table}?select=*`, { method: "HEAD", headers: { apikey: ANON, authorization: `Bearer ${ANON}`, prefer: "count=exact" } });
    const n = Number(res.headers.get("content-range")?.split("/")[1]);
    if (Number.isNaN(n)) throw new Error(`could not count ${table} (content-range: ${res.headers.get("content-range")})`);
    return n;
  };
  const hopsBefore = await count("fed_hops");
  const ledgerBefore = await count("fed_ledger");
  // ask for the affected rows back: a write that really happened would return them
  const ret = { prefer: "return=representation" };
  const insert = await rest("fed_ledger", { method: "POST", headers: ret, body: JSON.stringify({ pid: "ngit_000000000000", points: 999999, reason: "cheat" }) });
  expect(insert.status >= 400, `anonymous ledger insert gave ${insert.status}`);
  const update = await rest("fed_ledger?id=gt.0", { method: "PATCH", headers: ret, body: JSON.stringify({ points: 999999 }) });
  expect(update.status >= 400 || (Array.isArray(update.json) && update.json.length === 0), `anonymous ledger update changed rows: ${update.text.slice(0, 80)}`);
  const del = await rest("fed_hops?idx=gt.-1", { method: "DELETE", headers: ret });
  expect(del.status >= 400 || (Array.isArray(del.json) && del.json.length === 0), `anonymous delete removed rows: ${del.text.slice(0, 80)}`);
  expect((await count("fed_hops")) === hopsBefore, "the hop count changed");
  expect((await count("fed_ledger")) === ledgerBefore, "the ledger count changed");
  const inflated = await rest("fed_ledger?select=points&points=eq.999999");
  expect(inflated.json.length === 0, "a ledger row was inflated");
  for (const [fn, args] of [["fed_mark_hired", { p_intro: "00000000-0000-4000-8000-000000000001" }], ["fed_respond_hop", { p_hop: "00000000-0000-4000-8000-000000000001", p_accept: true, p_response: "referral" }], ["fed_create_intro", { p_requester: "a", p_target: "b", p_path: ["a", "b"], p_prob: 1, p_shortest: 1, p_trust: "question" }], ["fed_event", { p_kind: "x", p_text: "forged", p_node: null, p_intro: null }]]) {
    const r = await jsonPost(`${SUPA}/rest/v1/rpc/${fn}`, args, { apikey: ANON, authorization: `Bearer ${ANON}` });
    expect(r.status >= 400, `anonymous ${fn} gave ${r.status}`);
  }
  const check2 = await rest("fed_ledger?select=reason&reason=eq.cheat");
  expect(check2.json.length === 0, "a forged ledger row exists");
});
await check("hub database: events never name anyone", async () => {
  const r = await rest("fed_events?select=text&limit=5000");
  expect(!r.json.some((e) => NAMES.test(e.text)), "an event mentions a person's name");
  return `${r.json.length} events`;
});

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll privacy and authorization checks passed");
process.exit(failed ? 1 : 0);
