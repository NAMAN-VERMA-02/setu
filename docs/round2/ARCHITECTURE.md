# Round 2 architecture: federated Setu

```
 Browser (projector, judges' phones)
   │  names, messages, own profile  ◄──── direct, CORS, viewer token ────┐
   │                                                                     │
   ▼  pseudonymous only                                                  │
 Setu Hub = this Next.js app on Vercel + Supabase (fed_* tables, Realtime)│
   │  signed HTTPS (Bearer per node)          MCP (Streamable HTTP)      │
   ├──────────────► NGIT Setu Node (Render, server 1) ◄──────────────────┤
   └──────────────► RCE  Setu Node (Render, server 2) ◄──────────────────┘
                    each: FastAPI + SQLite + MCP server + /admin page
```

Setu is federated like India's Account Aggregator. Each college runs a **Setu Node** with its own people. The **Setu Hub** only routes: pseudonymous IDs, public job cards, edge probabilities, consent events, Points and Karz.

## Data boundary

| Data | Lives in | May reach the hub? |
|---|---|---|
| Name, email, phone, exact CGPA, raw timeline, ask text, hop notes | College node | **Never.** Node → browser only, to the person themselves or someone they consented to. |
| Pseudonymous ID `pid` = `<node>_` + first 12 hex of HMAC-SHA256(NODE_SECRET, local_id) | Node mints it; hub stores it | Yes |
| Public card: role, branch code, grad year, public title and company (only if open to intros) | Node; hub caches it | Yes (the person chose to make it public) |
| 15-number feature vector for a Mirror query | Computed on the node | In transit only, never stored |
| Edges (pid ↔ pid, prior, yes/no counts), intros, hops, Points/Karz, events | Hub | Yes. This is the routing table, like UPI's VPA directory. |

The UI says "**0 identifying fields**", never "0 personal fields": pseudonymous IDs can still be personal data under DPDP.

## Pieces

- **Node** (`node/`): FastAPI, SQLite, MCP at `/mcp`, admin console at `/admin` with the kill switch. Every response carries `X-Setu-Identifying-Fields` and writes an audit row.
- **Hub schema** (`supabase/migrations/20261021000021_fed_hub.sql`): `fed_*` tables, read-only for the public, writes only through service-role RPCs (`fed_create_intro`, `fed_respond_hop`, `fed_reroute`, `fed_mark_hired`). A vitest guard fails if any `fed_` column is named like identifying data.
- **Routing** (`src/lib/fed/bridge.ts`): hop-limited search on −ln p, at most 3 people in between, compared with the fewest-hops route.
- **Tokens** (`src/lib/fed/tokens.ts`): session cookie (`setu_fed`), viewer token (2 h, one secret per node), hop token (stateless link per hop). All HMAC-SHA256, constant-time compare.
- **Screens**: `/live/*` (projector), `/h/[token]` (phone hop page), `/join`, `/stage` (presenter).

## Sessions

No Supabase Auth in the Live Network. An httpOnly signed cookie holds `{pid, node}`. Story personas are picked on `/live` and labelled "Demo persona". Judges get a real session from `/join`. Production would use node-side college OTP/SSO.

## Why MCP

MCP is not the privacy mechanism. The node plus per-hop consent is. Node ↔ hub federation is signed HTTPS. MCP is the open interface so any assistant (Claude, ChatGPT, Gemini, Cursor) can query a college's node without custom work, and its tools return nothing identifying.
