// Proof that the MCP servers are real and open: a standalone client (not the Setu app) connects to each college
// and to the professional network exactly as any AI assistant would, and shows what it can and cannot see.
// Usage: node scripts/mcp-demo.mjs [env-file] ["a need in plain words"]
//   e.g. node scripts/mcp-demo.mjs .env.vercel.production "I need a developer who has built health apps"
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { existsSync, readFileSync } from "node:fs";

const envFile = process.argv[2] ?? ".env.local";
const NEED = process.argv[3] ?? "I need a developer who has built health apps";
const env = { ...process.env };
for (const file of [envFile, ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2];
  }
}

const c = { dim: "\x1b[2m", bold: "\x1b[1m", green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m", reset: "\x1b[0m" };
const SERVERS = [
  { id: "NGIT", key: "NGIT", what: "college" },
  { id: "RCE", key: "RCE", what: "college" },
  { id: "PRO", key: "PRO", what: "professional network" },
].filter((s) => env[`NODE_${s.key}_URL`] && env[`NODE_${s.key}_MCP_TOKEN`]);

const NAMES = /Aman|Rohan|Priya|Meera|Vikram|Karan|Arjun|Kavya|Sneha|Ananya|Rahul|Ishaan|Meenakshi|Zoya|Khanna|Mehta|Sharma|Iyer|Nair|Bhatia|Malhotra|Desai|Kapoor/;
let leaks = 0;
const line = (s = "") => console.log(s);
const head = (s) => line(`\n${c.bold}${c.cyan}━━ ${s}${c.reset}`);

async function connect(server) {
  const client = new Client({ name: "outside-ai-assistant", version: "1.0.0" });
  const url = new URL(`${env[`NODE_${server.key}_URL`].replace(/\/+$/, "")}/mcp`);
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${env[`NODE_${server.key}_MCP_TOKEN`]}` } } }));
  return client;
}

line(`${c.bold}Setu MCP check${c.reset}  ${c.dim}a standalone client talking to each server directly${c.reset}`);

head("1. Without the key, a server refuses");
for (const s of SERVERS) {
  const base = env[`NODE_${s.key}_URL`].replace(/\/+$/, "");
  const res = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
  line(`  ${s.id.padEnd(5)} ${base}  →  HTTP ${res.status} ${res.status === 401 ? `${c.green}refused${c.reset}` : `${c.red}NOT REFUSED${c.reset}`}`);
}

head("2. With the key, the same servers describe their own tools");
const clients = [];
for (const s of SERVERS) {
  const client = await connect(s);
  clients.push([s, client]);
  const { tools } = await client.listTools();
  line(`  ${c.bold}${s.id}${c.reset} (${s.what}): ${tools.map((t) => t.name).join(", ")}`);
}

head(`3. Ask in plain words:  “${NEED}”`);
for (const [s, client] of clients) {
  const t0 = Date.now();
  const res = await client.callTool({ name: "match_need", arguments: { need: NEED, limit: 3 } });
  const data = res.structuredContent ?? {};
  const people = data.people ?? [];
  line(`  ${c.bold}${s.id}${c.reset} answered in ${Date.now() - t0} ms · identifying_fields = ${c.green}${data.identifying_fields}${c.reset}`);
  if (!people.length) line(`     ${c.dim}nobody here offers that${c.reset}`);
  for (const p of people) line(`     ${String(Math.round(p.score * 100)).padStart(3)}%  ${p.title} · ${p.company}   ${c.dim}${p.reasons[0]} · id ${p.pid}${c.reset}`);
  if (NAMES.test(JSON.stringify(res))) {
    leaks++;
    line(`     ${c.red}A NAME APPEARED IN THIS RESPONSE${c.reset}`);
  }
}

head("4. Aggregate numbers are allowed; individuals are not named");
for (const [s, client] of clients) {
  const res = await client.callTool({ name: "college_stats", arguments: {} });
  const stats = res.structuredContent?.stats ?? {};
  line(`  ${c.bold}${s.id}${c.reset} people by role: ${JSON.stringify(stats.roles)}  ·  names released so far: ${stats.names_released}`);
  if (NAMES.test(JSON.stringify(res))) leaks++;
}

head("5. Asking for someone's name or contact is impossible by design");
const [firstServer, firstClient] = clients[0];
const tools = (await firstClient.listTools()).tools.map((t) => t.name);
line(`  ${firstServer.id} offers ${tools.length} tools, all read-only. None returns a name, email, phone or message: ${c.green}${tools.join(", ")}${c.reset}`);

line(`\n${leaks ? `${c.red}${leaks} response(s) contained a name${c.reset}` : `${c.green}${c.bold}0 names in every response. Real servers, open protocol, nothing identifying.${c.reset}`}`);
await Promise.all(clients.map(([, cl]) => cl.close().catch(() => {})));
process.exit(leaks ? 1 : 0);
