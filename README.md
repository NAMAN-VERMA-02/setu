# SETU (सेतु), the bridge

**Their yesterday is your tomorrow.** SETU is a college's own alumni network that matches each student to the seniors who were once in *exactly* their position, shows the routes those seniors took, and helps the student reach them directly or through one bridging senior they trust.

Alumni platforms show where seniors are today. A student from a tier-2 or tier-3 college needs a route, and only someone who once stood where that student stands can show one. SETU matches on the "then", not the "now". To our knowledge, no alumni platform matches a student to a senior's past stage.

Repository: `ODDYSSEY` · Built for a hackathon.

## Round 2: federated SETU (Live Network)

Round 1 asked: *why would colleges give you their people's data?* They don't have to. SETU is now federated, built like India's Account Aggregator: each college runs a **Setu Node** on its own server (its people, names, CGPA, timelines, messages), and the **Setu Hub** only routes pseudonymous IDs, public job cards, edge probabilities, consent events and Points/Karz. Names and messages go from a college's server straight to the browser of someone who said yes. A college can disconnect from its own admin page, and its people vanish from SETU because SETU never held them.

- **What's new:** `node/` (Python college server with Mirror, consent rules, admin console and an MCP server), `/live` (hub screens: Mirror, Bridge with the route graph and best-path maths, live intro chain, leaderboard, placement dashboard, privacy proof, Ask Setu over MCP), `/join` (30-second profile for a phone), `/h/[token]` (one-tap yes or no on a hop), `/stage` (presenter control). The campus app above is untouched.
- **Links:** hub `/live` · presenter `/stage?key=…` · each college's `/health` and `/admin` · MCP at each college's `/mcp`.
- **Run a node locally:** `cd node && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt && COLLEGE_ID=ngit uvicorn app:app --port 8001` (and `COLLEGE_ID=rce DB_PATH=./rce.db uvicorn app:app --port 8002`). Tests: `.venv/Scripts/python -m pytest`.
- **Secrets and env:** `node scripts/gen-env.mjs <hub-url> <ngit-url> <rce-url>` writes git-ignored env files for Vercel and both Render services. See `.env.example`.
- **Docs:** [architecture](docs/round2/ARCHITECTURE.md), [demo script](docs/round2/DEMO_SCRIPT.md), [runbook](docs/round2/RUNBOOK.md), [judge Q&A](docs/round2/QA.md), [decisions](docs/round2/DECISIONS.md), [rehearsal log](docs/round2/REHEARSAL.md).
- **Team & Contributions:** Round 2 federation work committed by NAMAN-VERMA-02.

## What it does

| Idea | How SETU does it |
|---|---|
| **A network, not a directory** | Students, alumni, faculty, founders, recruiters and the placement cell each have a real profile (expertise, what they are open to, what they are looking for or offering). `/people` finds the right person from a plain-words question and says why they match. `/network` shows who you are connected to as a hub-and-spoke graph. |
| **Opportunities** | Alumni, faculty, founders, recruiters and the placement cell post jobs, internships, projects, research, referrals, mentoring and events. Everyone sees a feed ranked by skills, goal and intent, with the reasons. |
| **Invites** | Recruiters and founders rarely have a college email. An alumnus, faculty member or the placement cell vouches for them with a single-use, 14-day invite link. |
| **Past-self matching** | Compares a student with every senior's snapshot from the *same semester*: college tier 20, CGPA within 0.5 → 20, branch 15, backlogs 15, 10th within 5% → 10, 12th within 5% → 10, same direction 10. A rarity bonus rewards uncommon shared traits; the rarest one becomes the first line of the message. |
| **Route map** | A branching D3 map of what the matched seniors did next (job, GATE, startup…) and where they landed. Counts only. |
| **Introductions through a senior** | If a matched senior knows people at the student's target company (a count, never names), the student can ask that senior to pass the question on. Never more than 2 hops. The senior forwards a one-time link from their own phone; the recipient replies in one tap with no sign-up. |
| **Trust ladder** | A question → a 15-minute call → a small task → a referral. A referral unlocks only after the senior has seen the student's work. |
| **Pay it forward ×3** | When someone lands a role, SETU shows three juniors whose "today" matches their "yesterday" and asks for one answer each. |
| **Vouches** | A senior who has seen a student's work (or a faculty member) puts their name to a skill. Vouches show on the profile and lift the student in people search. |
| **Messages** | Connected people talk in `/messages`, live. Only the two people in a thread can read it, and it stops if the connection ends. |
| **Updates** | Requests, connection news, vouches, interest in your opportunities and college announcements land in `/notifications`, with an unread badge. An opt-out weekly email is ready once an email provider is configured. |
| **College dashboard** | For the placement cell: students on SETU, first-reply rate, how far requests climb the ladder, placements, help paid forward, and how the wider network is being used. It also imports the alumni list (`/college/import`, see who has joined) and posts announcements and events (`/announcements`). |
| **Draft-writing agent** | An LLM agent reads the student's journey and matches and drafts first messages. The student edits and sends them. See [docs/agent.md](docs/agent.md). |
| **LinkedIn PDF import** | The student's own "Save to PDF" is read once by an LLM into a semester-by-semester draft. The file is never stored. |

## Try the demo (about 10 minutes)

Prerequisite: the app is running with the sample data loaded (see [Setup](#setup)).

1. **Join.** Sign up at `/signup` with a `@kiet.edu` address, batch 2028 or later, 18 or older. Confirm the email link.
2. **Share your journey** at `/onboarding`: a goal such as "SDE at Cognizant", marks as ranges, and each semester so far. Switch on only the marks you are happy to show.
3. **See your matches** at `/matches`: "N seniors were where you are", the route map, and ranked cards with the rarest shared trait as the opening line.
4. **Draft messages.** Press *Draft messages for me*, edit a draft, and send it. (Needs an AI key.)
5. **Bridge.** On a card that says "Knows 3 people at Cognizant", choose *pass it on*. As the senior, open `/requests` and press *Forward to someone I know*; the one-time link works in a private window without signing in.
6. **Be findable.** Fill in `/profile`: headline, expertise, what you are open to, and what you are looking for.
7. **Find people.** At `/people` ask "who can help me with GATE and a backlog". Each result says why it matched. Connect with two or three.
8. **See your network** at `/network`: you in the middle, spokes for students, alumni, faculty, founders, recruiters and the institution.
9. **Opportunities.** At `/opportunities` filter by type, read the "why this fits you" notes, and show interest in one.
10. **As a poster.** Log in as an alumnus, faculty member or recruiter: post at `/opportunities/new`, then open `/opportunities/mine` to see who is interested and shortlist them.
11. **Invite a recruiter.** As an alumnus, create an invite at `/invites`, then open the link in a private window and sign up with any email.
12. **Vouch and message.** As an alumnus who has seen a student's work, open the student's profile and vouch for a skill. Message any connection from their profile (`/messages`); the other side's header badge lights up live.
13. **Updates.** The student's `/notifications` now shows the vouch and the new connection request.
14. **Placement cell.** At `/college/import` paste a short CSV (`name,batch,branch,email`) and watch the joined count; post an announcement or event at `/announcements`; everyone gets an update.
15. **Climb the ladder, pay it forward, and the college dashboard** at `/requests`, `/payitforward` and `/college` (placement accounts only, see below).

## Stack

Next.js 16 (App Router, TypeScript, Tailwind, mobile-first) · Supabase (Postgres, Auth, Row Level Security) · Gemini (default) or Claude for the PDF import and the draft agent, behind one provider switch · D3 (`d3-hierarchy`, `d3-shape`) for the route map · Vitest.

```
src/
  app/            pages and route handlers (api/match, api/asks, api/payitforward, api/agent, api/parse-journey, f/[token])
  components/     matches, requests, pay-it-forward and college screens
  lib/
    scoring/      trait matching, rarity, rank, route map, pay-it-forward picks
    asks/         trust ladder, forward tokens, error mapping
    agent/        tool loop, guardrails, prompt
    match/        shared match service
    supabase/     browser, server, admin clients and session proxy
    validation/   zod schemas
supabase/
  migrations/     schema, RLS, guard triggers, functions
  seed/           150 synthetic journeys and outcomes
docs/             design direction, agent flow and guardrails
```

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below; never commit .env.local
npm run dev
npm test                     # unit tests
```

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | everything | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | everything | the public anon or publishable key |
| `NEXT_PUBLIC_SITE_URL` | email links, forward links | `http://localhost:3000` locally; your production URL when deployed |
| `SUPABASE_SERVICE_ROLE_KEY` | matching, pay it forward, agent | **secret**: server only, bypasses RLS; results are sanitised before they leave the server |
| `LLM_API_KEY` | PDF import, draft agent | **secret**. A Google Gemini key works out of the box (free key at aistudio.google.com/apikey) |
| `LLM_PROVIDER` | optional | `gemini` (default) or `anthropic` |
| `CRON_SECRET` | weekly email | **secret**. Vercel Cron sends it as a bearer token to `/api/cron/digest`; without it the route refuses everyone |
| `RESEND_API_KEY` and `DIGEST_FROM` | weekly email | **secret** and a verified sender. Without them the cron route sends nothing |
| `LLM_MODEL` | optional | overrides the default model (`gemini-3.8-flash`, or `claude-opus-5-5` for Anthropic) |

### Database

Apply the files in `supabase/migrations/` in order (they are numbered). Then load the demo data in the SQL editor:

1. `supabase/seed.sql`: the demo college (`kiet.edu`, tier is a placeholder).
2. `supabase/seed/sample_journeys.sql`: 150 synthetic journeys.
3. `supabase/seed/sample_outcomes.sql`: placements, open questions, requests, pay-it-forward answers.
4. `supabase/seed/sample_network.sql`: 12 faculty, 10 founders, 12 recruiters, profiles and intents for everyone, about 80 opportunities, about 400 connections and expressions of interest.
5. `supabase/seed/demo_for_user.sql`: fills in the most recently created real account (profile and a few connections) so a fresh demo login does not look empty.

Sample accounts use the reserved `@seed.invalid` domain and a "(sample)" name suffix, so none of them can log in or receive mail. Remove them with `delete from auth.users where email like '%@seed.invalid';`.

**College dashboard access.** Roles cannot be changed from the app. In the SQL editor, run
`update public.users set role = 'placement' where id = '<your user id>';`.

## Deploy (Vercel + Supabase)

1. In Vercel choose **Add New → Project**, import this GitHub repository, and keep the Next.js defaults.
2. Add the environment variables above. Mark `SUPABASE_SERVICE_ROLE_KEY` and `LLM_API_KEY` as **Sensitive**.
3. Deploy, then set `NEXT_PUBLIC_SITE_URL` to the production URL and redeploy.
4. In Supabase, open **Authentication → URL Configuration**: set **Site URL** to the production URL and add `https://<your-domain>/auth/callback` to **Redirect URLs**.
5. In Supabase **Authentication → Providers → Email**, keep *Confirm email* on, and enable leaked-password protection.
6. Run the security advisor and check that only the known, intentional findings remain (see below).

`/dev/*` preview pages return 404 in production builds.

## Privacy and guardrails

- Marks are stored and shown only as ranges, and only where the owner switched them on. Hidden marks still count towards a match score but are never listed or quoted.
- Company counts are shown only if the count is 2 or more, and only as counts.
- One open bridge request per student; at most 3 waiting requests per senior.
- Forward links expire after 7 days. Only a hash of the link is stored. Declining is silent: the student never learns of it.
- A referral unlocks only after the senior has seen the student's work.
- College email verification; users must be 18 or older. The date of birth is checked once and not stored.
- Row Level Security is enabled on every table. Server-side functions that must see across users are narrow and documented in the migrations.
- Matching and similar features read other people's rows with the service role on the server and return only sanitised results.
- No scraping, no contact access, no one is contacted unless they are on SETU or a senior chooses to share a link.

Designed on the principles of India's DPDP Act 2023 (data minimisation, separate purposes, deletion on request). We do not claim certification.

**Known advisor findings (intentional):** the `snapshots_visible` view is security-definer so it can mask marks per owner opt-in; `get_forward` and `reply_forward` are callable without signing in because the forward link is the credential; the other flagged functions are called by signed-in users through the app.

## What is built and what is not

Built: signup with college-email verification and the 18+ check, journey form, LinkedIn PDF import, match scoring with rarity, route map, asks with the trust ladder, bridge forward links, silent declines, requests inbox, pay it forward, college dashboard, draft agent with guardrails, role-based profiles and intents, people search with reasons, opportunities board (post, rank, interest, shortlist), connections and the network graph, invite-based signup for recruiters and founders, role-aware dashboards, vouches, in-app messaging with live updates, alumni import and announcements for the placement cell, notifications with an unread badge, and demo data for all of it.

Not built yet, and not claimed:

- A recruiter-specific candidate search page (vouches already lift students in `/people`, but there is no dedicated recruiter view).
- Sending the invitation emails for imported alumni from SETU itself: the placement cell gets a ready-written message that opens in its own mail app.
- The weekly email has been unit-tested for content only. It has not been sent for real: it needs `RESEND_API_KEY`, `DIGEST_FROM` and `CRON_SECRET` in Vercel.
- WhatsApp notifications, push notifications, and multi-college institutions.
- Read receipts, typing indicators, attachments and group chats in messaging.
- Entering company counts, and the in-browser LinkedIn *connections* parser that would send only "company: count".
- The "route did not work" markers on the route map (no outcome data for it yet).
- Shared rate limiting beyond the agent (the PDF import limit is per server instance).
- The AI providers have been unit-tested with scripted models only. The Gemini adapter has not been run against the live API yet.

What SETU does **not** claim: that it guarantees a referral or a job (it opens the route; the senior decides), that it knows who works where (it knows counts that consenting seniors shared), chains longer than 2 hops, or that the referral advantage figure is an Indian one.

## Team & Contributions

All work in this repository is committed under NAMAN-VERMA (GitHub: NAMAN-VERMA-02), who directed every feature: the schema and security rules, auth, the journey form and PDF import, matching and the route map, the asks and bridge flow, pay it forward, the college dashboard, and the draft agent.

Built with Claude as a coding assistant; the team designed, directed and reviewed every feature.
