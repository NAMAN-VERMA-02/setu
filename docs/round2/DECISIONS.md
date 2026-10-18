# Decisions

One line each, newest last.

- Migration is `20261021000021_fed_hub.sql`, not `20261018100000_…`: the repo already has migrations up to `…20`, and ordering must stay increasing.
- No Supabase Auth in the Live Network: a signed httpOnly cookie holds `{pid, node}`. Production would use college OTP/SSO on the node.
- Edges are stored once per direction in `fed_edges`; the routing code treats them as undirected and keeps the strongest of any pair. Node `/edges` returns one record per unordered pair.
- Node SQLite lives on the instance disk and re-seeds on boot. Judge profiles survive while the instance stays up (free Render instances sleep and may lose them: re-seed is harmless).
- Pinned the Python `mcp` package to 1.30.0 (newer 2.x renamed FastMCP) and the TypeScript SDK to 1.32.1. `scripts/mcp-smoke.mjs` proves they talk to each other.
- `AgentTurn` in `src/lib/llm/agent-session.ts` gained an optional `text` field so Ask Setu can read the model's final answer. Backwards compatible; existing code ignores it.
- Ask Setu runs the MCP tool loop itself (at most 5 rounds, 10 s for the AI), then falls back to a keyword router over the same tools.
- Event text is role words only ("A NGIT student asked for an intro to …"). A rolled-back SQL test checks that no story name appears in events.
- `/api/fed/overlay` is public and returns Priya's hop link only while the presenter has switched the Priya QR on (it is shown on the projector anyway).
- The draft prompt carries pseudonymous facts only; `{myName}` is filled in on the requester's device from their own college's server.
- Reset also switches each node's hub access back on, so a kill-switch beat never leaves the next run broken.
- Demo screens hide the intro panel and custom cursor with a per-route CSS rule rather than reading the pathname in the root layout (that broke prerendering of dynamic routes).
