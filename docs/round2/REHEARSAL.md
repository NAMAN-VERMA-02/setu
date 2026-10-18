# Rehearsal

## Verified so far (local, no hub database access)

- Node: 27 pytest tests pass. Both nodes run under uvicorn; `/health`, `/directory` and MCP `tools/list` work; `scripts/mcp-smoke.mjs` passes against both (TypeScript SDK 1.32.1 ↔ Python `mcp` 1.30.0), `identifying_fields=0`.
- Hub: 172 vitest tests pass (routing story numbers 0.396 / 0.12 / 0.378, tokens, schema guard, history totals 142 / 68% / 9, colleague edges, Ask Setu helpers). `next build` passes.
- Hub database functions: a rolled-back SQL block on `oddyssey-kal` played the whole story: intro with 3 hops, idempotent yes, silent decline, re-route to 0.378, delivery as a 15-min call, points (Rohan 10, Priya 10, Meera 25, Vikram 0), hire +100 to the three helpers, no story names in events, a fourth open intro refused.

- Deployed nodes (Render, Singapore, free plan): `https://setu-college-ngit.onrender.com` and `https://setu-college-rce.onrender.com`. Each answers `/health` (44 people), refuses a wrong hub token with 401, lists 44 directory entries with the hub token, and passes `scripts/mcp-smoke.mjs` with `identifying_fields=0`.

- **Full story, scripted** (`node scripts/e2e-story.mjs [hub-url]`): 15/15 steps pass against the real hub database with both nodes running locally, in about 25 s. It covers: both colleges online; reset in about 3 s; Mirror (Priya on top at 92%, matches from both colleges); Bridge 39.6% vs 12%; intro sent with the ask kept on NGIT's server; Rohan yes with a note; Vikram decline with a silent re-route via Priya at 37.8%; Priya yes; Meera's 15-minute call; names read straight from the colleges; hire with +100 each; kill switch off and back on within 3 s (about 0.6 s measured); a judge joining and seeing their Mirror; Ask Setu in AI mode with trace calls on both colleges, all `identifying_fields=0`.
- Ask Setu uses `gemini-3.5-flash-lite` (about 0.8 s per tool-calling turn); the larger `gemini-3.8-flash` took 3 to 10 s and fell outside the 10 s budget. Override with `FED_LLM_MODEL`.

## Still to run on the deployed URLs (needs Vercel to have the env values, then a redeploy)

Run `node scripts/e2e-story.mjs https://setu-live-five.vercel.app .env.vercel.production` (the second argument supplies the Render URLs and secrets; node admin passwords are read from `.env.local`), twice in a row, and record timings below. Then do the same steps by hand on a real phone.

Run twice in a row and record timings here.

1. Reset (under 10 s).
2. Aman (context 1) sends to Meera.
3. Rohan (context 2) accepts.
4. Vikram declines; the re-route shows Priya at 0.378.
5. Priya's link opens in context 3 (logged out) and accepts.
6. Meera chooses a call → delivered; names are revealed on Aman's screen.
7. Hire → pay-it-forward on Priya's page.
8. The leaderboard updates.
9. RCE hub access off → RCE disappears and Aman → Meera says "RCE is offline".
10. Back on → everything returns.
11. `/join` creates a judge profile and shows its Mirror.
12. Ask Setu returns a trace from both nodes.

| Run | Date | Result | Notes |
|---|---|---|---|
| 1 (live, functions in US East) | 2026-10-18 | 14/15 | Whole story worked; reset 14.5 s (limit 10 s) and steps took 3 to 10 s because Vercel ran in `iad1` while Supabase is in Mumbai and the nodes in Singapore. |
| 2 (live, functions in Mumbai via `vercel.json`) | 2026-10-18 | 15/15 in 24 s | Reset 2.4 s, kill switch back in about 1 s, every step 0.4 to 2.5 s. Ask Setu ran in offline mode because the live app had no `LLM_API_KEY` yet. |

| 3 (live, AI key set) | 2026-10-18 | 15/15 in 23 s | Reset 2.3 s, kill switch back in 0.8 s, Ask Setu in AI mode (2 MCP calls, 7 cards). Second clean run in a row. |

Two things found only by running live: the Vercel region (fixed) and a stale `SUPABASE_SERVICE_ROLE_KEY` on Vercel that made every hub write fail with "Invalid API key" (fixed by pasting the right value). The reset now reads from the colleges before it clears the hub and reports its failure reason.

## Professional network, live (2026-10-18)

| Run | Result | Notes |
|---|---|---|
| 4 (live, three servers, first deploy of the professional network) | 18/24 | The college story and the professional join passed. Find, Bridge and the doctor's intro failed because the NGIT and RCE servers were still on the first build: Render does not redeploy on push for services created from a public repo URL. Fixed by triggering manual deploys. |
| 5 (live, all three servers on the latest code) | 24/24 in 34 s | Doctor story included: Find (91%, route 59.5%), hand-off to Bridge, AI draft written as a professional, CTO and developer both say yes, names and note read straight from the professional server. |
| 6 (live, after title-first matching fix) | 24/24 in 32 s | Second clean run in a row. |

- **Privacy probe** (`scripts/privacy-probe.mjs`): all checks pass on production, now including the professional server (1,562 hub rows contain no name, email or phone).
- **MCP demo** (`scripts/mcp-demo.mjs`): three servers answer 401 without a key and a plain-words need in about 120 ms with `identifying_fields = 0`; 0 names in every response.
- **Found only by running live:** the Vercel variables for the third server had not saved (the bulk paste silently drops lines; set through the API instead), and Render needs a manual deploy after each push (`trigger_deploy`, or the dashboard's Manual Deploy).
