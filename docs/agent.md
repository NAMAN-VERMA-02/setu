# Draft-writing agent

An LLM agent that reads a student's journey and matches, and drafts first messages to the seniors most likely to help. It is **read-only and advisory**: it proposes text, the student edits it and presses Send, and the normal ask flow takes over.

Code: [`src/lib/agent`](../src/lib/agent) · endpoint: `POST /api/agent/drafts` · UI: [`agent-drafts.tsx`](../src/components/matches/agent-drafts.tsx)

## Flow

```mermaid
flowchart TD
    A([Student presses<br/>"Draft messages for me"]) --> B{Signed in?<br/>Journey shared?<br/>Under 5 runs/hour?}
    B -- no --> X1[401 / 409 / 429<br/>no model call]
    B -- yes --> C[Agent loop<br/>max 6 turns · 8 tool calls<br/>6,000 output tokens per turn]

    C --> D[get_my_journey<br/>own data, cleaned]
    C --> E[find_matches<br/>top 5 seniors, visible traits only]
    D --> C
    E --> C

    C --> F[submit_drafts<br/>up to 3 drafts]
    F --> G{Guardrails<br/>checkDrafts}

    G -- all rejected,<br/>first attempt --> H[Reasons returned<br/>to the model once]
    H --> C
    G -- some or all rejected,<br/>after retry --> I[Show accepted drafts only,<br/>list notes]
    G -- accepted --> I

    C -- refusal / limit /<br/>no submission --> X2[Friendly error<br/>student writes their own]

    I --> J[Student edits each draft]
    J --> K{Student presses Send?}
    K -- no --> Z([Nothing is sent])
    K -- yes --> L[POST /api/asks<br/>database rules apply again]
    L --> M([Ask is created: one question,<br/>trust step = question])

    C -. counts only .-> R[(agent_runs<br/>status · turns · tool calls · tokens)]
```

## What the agent can and cannot do

| Can | Cannot |
|---|---|
| Read the student's **own** goal and semesters | Send, edit or delete anything |
| See the top 5 matches with **only** the traits each senior agreed to show | See hidden marks, emails, phone numbers, or anyone's contact list |
| Propose up to 3 drafts, then call `submit_drafts` once | Contact a senior, create an ask, or advance a trust step |

The tool list is exactly `get_my_journey`, `find_matches`, `submit_drafts`. There is no send tool, so a manipulated model has nothing dangerous to call.

## Guardrails

| Risk | Control | Where |
|---|---|---|
| Unauthorised use | Must be signed in, must have shared a journey (give to get) | `route.ts` |
| Runaway cost or loops | 6 turns, 8 tool calls, 6,000 output tokens per turn, 5 runs per user per hour (counted in the database, so it holds across servers) | `run.ts`, `agent_runs` |
| Prompt injection through profile text | Every free-text field is stripped of control characters, emails, phone numbers and links, truncated, and described to the model as untrusted data | `sanitizeUntrusted`, `prompt.ts` |
| Model invents a senior | A draft is accepted only for an id that `find_matches` returned in this run | `checkDrafts` |
| Referral requests | Drafts mentioning referrals, "put in a word", "hire me" and similar are rejected: a first message is only a question | `checkDrafts` |
| One question only | Exactly one `?` per message | `checkDrafts` |
| Contact details leaking | Any email, phone number or link in a draft rejects it | `checkDrafts`, `redact` |
| Wrong opening | Every message must start with the match's rarest shared trait; it is prepended if the model forgot | `checkDrafts` |
| Over-long messages | 700 characters maximum | `checkDrafts` |
| Bridge misuse | A "pass it on" route is accepted only when the senior has contacts at the student's target company and the student has no bridge request open | `checkDrafts` |
| Spam | At most 3 drafts, one per senior | `checkDrafts` |
| Bypassing the checks | The ask itself is validated again by the database (one open bridge per student, 3 waiting per senior, first step is a question) | `guard_ask` trigger |
| Model refusal or outage | Mapped to a friendly message; the student can always write their own | `route.ts` |
| Privacy of the audit trail | `agent_runs` stores counts only: never the journey, matches or drafted text | migration `…0009` |

## Human in the loop

Nothing is sent by the agent. Each draft sits in an editable text box with **Send** and **Discard**. Sending goes through the same `/api/asks` route as a hand-written message.

## Failure modes we accept

- The model may write a bland draft. The student can edit or discard it.
- Redaction patterns are heuristics. A creative contact detail could slip past them, but the senior still sees the message only after the student sends it, and the student reads it first.
- No refusal fallback model is configured; a refusal simply returns the friendly error.

## Configuration

`LLM_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must be set. `LLM_PROVIDER` is `gemini` (default) or `anthropic`; `LLM_MODEL` overrides the default model. The guardrails run outside the model, so they are identical for both providers.
