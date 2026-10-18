# Runbook

## One-time setup

1. `node scripts/gen-env.mjs <hub-url> <ngit-node-url> <rce-node-url>` writes three git-ignored files with fresh secrets (it never prints them):
   - `.env.vercel.production` → paste into Vercel (Project → Settings → Environment Variables).
   - `node/.env.render-ngit` and `node/.env.render-rce` → paste into each Render service.
   - It also appends the local block to `.env.local`.
2. Vercel also needs `SUPABASE_SERVICE_ROLE_KEY`, `LLM_PROVIDER=gemini`, `LLM_API_KEY`, `NEXT_PUBLIC_SITE_URL`.
3. Render: two Web Services from the repo, root directory `node`, build `pip install -r requirements.txt`, start `uvicorn app:app --host 0.0.0.0 --port $PORT`, health check `/health`, region Singapore. Names `setu-college-ngit` and `setu-college-rce`.
4. Keep warm: UptimeRobot on both `/health` every 5 minutes. Keep `/stage` open (it pings every 5 s).
5. Apply the migration `supabase/migrations/20261021000021_fed_hub.sql` (already applied to `oddyssey-kal`).

## T−30

- `node scripts/mcp-smoke.mjs` (with the node URLs and MCP tokens in the environment): both lines say OK, `identifying_fields=0`.
- Open `/stage?key=…`: both lights green.
- Record the backup video after the second rehearsal.

## T−15

- Stage → **Warm up**, then **Reset demo** (should take under 10 s).
- Phone A `/live/inbox?as=rohan` (turn sound on), phone B `/live/inbox?as=meera`.
- Projector on `/live`. Hotspot ready.

## T−2

- Stage lights green, inboxes show "Nothing waiting", join QR hidden.

## Recovering from failures

| Symptom | Fix |
|---|---|
| A light is red | Stage → Warm up (4 pings wake a sleeping Render instance, about a minute). Check the node's `/health`. |
| RCE shows "revoked" after the kill-switch beat | Open RCE's admin → Hub access ON, or Stage → Reset demo (it switches access back on). |
| Reset says "No college server answered" | Warm up first, then reset again. |
| Nothing updates live | Reload the screen. Pages poll every 3 s when Realtime is not connected. |
| Gemini slow or down | Ask Setu falls back to offline mode after 10 s. The draft button falls back to a template. |
| A judge cannot scan | Stage → "Play Priya on this device". |
| Intro stuck | Stage shows each hop's link; open the pending one directly. |

## Three servers and deploys (added with the professional network)

- The hub needs 17 server variables for three servers: `NODE_{NGIT,RCE,PRO}_URL`, `_HUB_TOKEN`, `_VIEWER_SECRET`, `_MCP_TOKEN`, plus `NEXT_PUBLIC_NODE_{NGIT,RCE,PRO}_URL`. `node scripts/gen-env-pro.mjs` adds the professional ones without touching existing secrets; its output file is `.env.vercel.pro-only`. Check them with `GET /api/fed/health`: all three servers must show `online`.
- **Render does not redeploy when you push.** After changing anything in `node/`, press **Manual Deploy** on each of the three services (or use the API), then wait for `/match` to answer (`POST /match` with the hub token returns 200). Vercel does redeploy on push.
- Bulk-pasting a `.env` file into Vercel's form can silently drop lines. After pasting, confirm every name is in the list, or set variables through the API with a short-lived token and revoke it afterwards.
- Warm-up now covers three servers: **Warm up** on `/stage` pings all of them.

## Screens that blink or never finish loading

Cause seen once (2026-10-18): the hub wrote a server's state to `fed_nodes` on every call, every open screen listens to that table over Realtime, so each search refreshed the screen, which searched again. Fixed: state is written only when it changes. Check any time with `node scripts/realtime-storm-check.mjs https://setu-live-five.vercel.app .env.vercel.production` (run it a few seconds after a reset): it must print `PASS: no refresh storm` (0 events for a burst of searches; a few events right after a reset are normal).
If a tab still blinks after a deploy, hard-refresh it (Ctrl+Shift+R): an old tab keeps running the old code.
