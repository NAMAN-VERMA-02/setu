import "server-only";

export const NODE_IDS = ["ngit", "rce", "pro"] as const;
export type NodeId = (typeof NODE_IDS)[number];

export const NODE_META: Record<NodeId, { name: string; city: string; kind: "college" | "professional" }> = {
  ngit: { name: "Northgate Institute of Technology", city: "Delhi", kind: "college" },
  rce: { name: "Riverbend College of Engineering", city: "Noida", kind: "college" },
  pro: { name: "Setu Professionals", city: "Pan-India", kind: "professional" },
};

export type NodeConfig = {
  id: NodeId;
  baseUrl: string;
  mcpUrl: string;
  hubToken: string;
  viewerSecret: string;
  mcpToken: string;
};

export function isNodeId(v: string): v is NodeId {
  return (NODE_IDS as readonly string[]).includes(v);
}

/** Reads NODE_<ID>_URL, _HUB_TOKEN, _VIEWER_SECRET, _MCP_TOKEN. Returns null when the node is not configured. */
export function nodeConfig(id: NodeId): NodeConfig | null {
  const key = id.toUpperCase();
  const url = process.env[`NODE_${key}_URL`];
  const hubToken = process.env[`NODE_${key}_HUB_TOKEN`];
  const viewerSecret = process.env[`NODE_${key}_VIEWER_SECRET`];
  const mcpToken = process.env[`NODE_${key}_MCP_TOKEN`];
  if (!url || !hubToken || !viewerSecret || !mcpToken) return null;
  const baseUrl = url.replace(/\/+$/, "");
  return { id, baseUrl, mcpUrl: `${baseUrl}/mcp`, hubToken, viewerSecret, mcpToken };
}

export function configuredNodes(): NodeConfig[] {
  return NODE_IDS.map(nodeConfig).filter((n): n is NodeConfig => n !== null);
}

export function secret(name: "HUB_SESSION_SECRET" | "HOP_TOKEN_SECRET" | "DEMO_STAGE_KEY"): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
