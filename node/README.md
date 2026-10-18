# Setu Node

One college's alumni records behind a pseudonymous HTTP contract. The central hub only ever receives
pseudonymous ids, public job cards, edge probabilities and consent events (0 identifying fields). Names and
messages go node -> browser, to the person themself or someone they consented to.

Stack: FastAPI, stdlib sqlite3, official `mcp` Python SDK (1.30, Streamable HTTP, stateless, mounted at `/mcp`).

## Run

```bash
cd node
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt     # Windows; use .venv/bin/ on macOS/Linux

COLLEGE_ID=ngit uvicorn app:app --port 8001      # Northgate Institute of Technology, Delhi
COLLEGE_ID=rce  uvicorn app:app --port 8002 \
  DB_PATH=./rce.db                               # Riverbend College of Engineering, Noida (use env, not args)
```

On first boot the database (`DB_PATH`, default `./setu.db`) is created and seeded with ~45 deterministic people.
Unset secrets fall back to insecure dev defaults and print a warning. See `.env.example` for every variable.
Console: `http://localhost:8001/admin` (dev password `admin`). Tests: `.venv/Scripts/python -m pytest`.

Two nodes side by side need separate DB files: `DB_PATH=./ngit.db COLLEGE_ID=ngit ...` and `DB_PATH=./rce.db COLLEGE_ID=rce ...`.

## Endpoints

| Who | Endpoint |
|-----|----------|
| anyone | `GET /health` (never blocked by hub access) |
| browser (CORS: `HUB_ORIGIN`, plus localhost:3000/3001 if `NODE_DEV=1`; viewer token in `X-Setu-Viewer`; writes 10/min/IP) | `POST /public/join`, `GET /public/card/{pid}`, `POST /public/cards`, `GET /public/me`, `POST /public/asks`, `GET /public/asks/{intro_id}`, `POST /public/asks/{intro_id}/notes` |
| hub (`Authorization: Bearer HUB_TOKEN`; 503 `{"error":"hub_access_revoked"}` when switched off) | `GET /directory[?pid=]`, `GET /edges`, `POST /vector`, `POST /mirror`, `GET /timeline/{pid}`, `POST /reveal`, `POST /reverse-mirror`, `GET /stats`, `POST /admin/reset` |
| admin (`X-Admin-Password`) | `GET /admin`, `GET /admin/api/state`, `POST /admin/hub-access {"on":bool}`, `POST /admin/reset` |
| MCP client (`Bearer MCP_TOKEN`) | `POST /mcp`: tools `college_stats`, `find_helpers`, `mirror_search`, `get_timeline` |

Every response carries `X-Setu-Identifying-Fields: <n>` (name/email/phone/exact-cgpa/free-text fields in the body)
and writes one audit row.

Viewer token: `base64url(json{pid,exp}) + "." + base64url(HMAC-SHA256(VIEWER_SECRET, payloadPart))`, no padding.
Pseudonym: `pid = "<college>_" + HMAC-SHA256(NODE_SECRET, local_id).hex()[:12]`.

## Mirror

15-dim vector: branch one-hot (CSE, IT, ECE, ME, AIML), cgpa/10, internship, min(projects/5,1), min(hackathons/3,1),
skills (python, ml, web, dsa, cloud, design). A student's current snapshot is compared with each senior's snapshot at the
same semester: `score = cos*0.80 + 0.06 same college + 0.04 same branch + 0.02 outcome matches goal`, capped at 0.99.
The rarest shared trait is the shared trait fewest of this node's seniors at that semester have.

## Seed

`seed/story.py` holds the hand-written story people (Aman, Priya, ... and the RCE alumni). `seed/generate.py` adds
~45 people per node with a fixed RNG seed per college, so the same college always gets the same data.
`POST /admin/reset` wipes everything (including people who joined) and re-seeds.
