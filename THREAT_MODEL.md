# Threat model: federated SETU (round 2)

What SETU promises: **the hub never holds a name, email or phone.** Colleges keep their people's data on their own node, and the hub only routes pseudonymous IDs. This file lists who could break that promise, what stops them, and what is still open. Data boundaries are in [docs/round2/ARCHITECTURE.md](docs/round2/ARCHITECTURE.md).

## Assets
1. Personal data on each college node: names, contact details, exact marks, timelines, messages.
2. The pid-to-person mapping (`pid` is an HMAC of the local id under the node's secret).
3. Consent: who agreed to be seen, by whom.
4. Hub routing data: edges, intros, hops, points.

## Who we defend against
| Attacker | Wants | Defence | Checked by |
|---|---|---|---|
| Anonymous visitor | names from a node | node returns masked cards unless a valid viewer token is presented | `scripts/privacy-probe.mjs` ("an anonymous visitor cannot read any name"), `node/tests/test_public_cards_hold_no_names.py` |
| Visitor with a forged viewer token | names | tokens are HMAC-SHA256 under a per-node secret with a 2 h expiry; a wrong signature is treated as anonymous | probe ("a forged viewer token ... is treated as anonymous"), `src/lib/fed/tokens.test.ts` |
| Anyone with the hub's public database key | identifying data in hub tables | no `fed_*` column holds a name, email or phone; the public key is read-only and cannot call point-granting functions | probe reads every row of all `fed_*` tables; a vitest guard (`src/lib/fed/schema.test.ts`) fails the build if a column is named like identifying data |
| Someone calling the hub-to-node API | node data | Bearer `HUB_TOKEN` per node, compared in constant time; no token or a wrong token is refused | probe ("hub endpoints refuse no token and a wrong token") |
| Someone reaching the MCP server or admin console | tools, kill switch | separate `MCP_TOKEN` and admin password | probe ("MCP refuses a missing or wrong token", "admin console refuses ...") |
| Guesser of intro links | other people's hops | stateless HMAC hop tokens; edited, swapped or guessed links are rejected | probe ("hop links cannot be guessed, edited or swapped") |
| Forged session cookie | acting as another pid | signed httpOnly cookie | probe ("a forged session cookie is rejected") |
| A hostile or broken college | other colleges' data | each node holds only its own people; the hub holds no names to leak; a node can be disconnected and its people disappear | by design; see ARCHITECTURE |
| Operator error | dev secrets in production | a node refuses to start if its secrets are unset when `SETU_ENV=production` or on Render | `node/tests/test_production_config.py` |

## Availability
- A node being offline must never break the hub or leak data: the hub client gives up after 4 seconds and shows no names for that college while the others still resolve (`src/lib/fed/client.test.ts`).

## Known gaps (not defended yet)
- **Pseudonymous IDs are still personal data** under India's DPDP Act, which is why the UI says "0 identifying fields" and never "0 personal fields".
- **Hub compromise** exposes the routing graph (who is connected to whom, by pid) and the join and consent events, though not names.
- **Node compromise** exposes that college's people. There is no encryption at rest on the SQLite file.
- **Rate limiting** exists only on the node's join endpoint, not on the other node or hub routes.
- **Secret rotation** is manual: changing a node secret changes every pid it minted.
- **Demo sessions**: story personas are picked from a menu with no login. Production would need real node-side sign-in.
- **The probe is run by hand** against a deployment; it is not in CI.
- No third-party security review has been done.
