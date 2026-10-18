// Connects to both college nodes over MCP, lists tools and calls college_stats.
// Usage: node scripts/mcp-smoke.mjs  (reads NODE_NGIT_URL / NODE_NGIT_MCP_TOKEN, NODE_RCE_URL / NODE_RCE_MCP_TOKEN)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

let failed = false;
for (const id of ["NGIT", "RCE"]) {
  const base = process.env[`NODE_${id}_URL`];
  const token = process.env[`NODE_${id}_MCP_TOKEN`];
  if (!base || !token) {
    console.log(`${id}: skipped (set NODE_${id}_URL and NODE_${id}_MCP_TOKEN)`);
    failed = true;
    continue;
  }
  const client = new Client({ name: "setu-smoke", version: "1.0.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base.replace(/\/+$/, "")}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
    const { tools } = await client.listTools();
    const stats = await client.callTool({ name: "college_stats", arguments: {} });
    const idf = stats.structuredContent?.identifying_fields;
    console.log(`${id}: OK · tools=${tools.map((t) => t.name).join(",")} · college_stats identifying_fields=${idf}`);
    if (idf !== 0) failed = true;
  } catch (e) {
    console.log(`${id}: FAILED · ${e instanceof Error ? e.message : e}`);
    failed = true;
  } finally {
    await client.close().catch(() => {});
  }
}
process.exit(failed ? 1 : 0);
