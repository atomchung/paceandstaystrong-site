# Product Hunt live demo

Status: the backend is implemented in `long-run-hybrid-coach` (PR #473) and this page is
wired to it. What remains before the demo is live is the owner setting `OPENAI_API_KEY` on
the demo service and running its acceptance command.

## Goal

Give a Product Hunt visitor one URL where they can experience Long Run Hybrid Coach immediately, without installing an MCP client or connecting their own Intervals.icu account.

The demo is a **playground for the existing MCP product**, not a second coaching product or a new source of truth.

Target public URL:

- English: `https://paceandstaystrong.com/demo.html`
- Traditional Chinese: `https://paceandstaystrong.com/zh/demo.html`

## User experience

1. Open the demo URL.
2. See a clearly fictional demo athlete with a short, understandable training history and two competing goals.
3. Pick a suggested question or type a coaching question.
4. The demo calls a server-side model endpoint. No API secret is shipped to the browser.
5. The model uses the same Long Run Hybrid Coach semantics and evidence boundary as the MCP product.
6. The demo may read evidence and produce a plan-change preview. It does **not** write to the shared Intervals.icu calendar.
7. The page always offers the real-product path: connect the hosted MCP to the visitor's own AI client and Intervals.icu account.

The hero scenario should make the hybrid trade-off legible:

> I only have three 45-minute sessions next week. I want to improve my 10K without losing strength. What are my realistic options?

The useful answer is not a synthetic score. It should expose materially different allocations and explain what each preserves, sacrifices, and leaves uncertain. Product semantics for this exploration are tracked in `long-run-hybrid-coach#472`.

## Architecture

```text
browser / demo.html
        |
        | POST message + ephemeral demo session id
        v
server-side demo endpoint
        |
        | model call (GPT-6 Astra for the challenge demo)
        v
Long Run Hybrid Coach demo adapter
        |
        +--> immutable / read-only demo athlete evidence
        +--> per-visitor ephemeral PlanState clone
```

### Domains

Three names, three jobs, and they do not overlap:

| | |
| --- | --- |
| `mcp.paceandstaystrong.com` | the production MCP gateway — connected athletes, OAuth, real plans |
| `demo-api.paceandstaystrong.com` | the demo backend, a separate Railway service |
| `paceandstaystrong.com/demo.html`, `/zh/demo.html` | this repository's pages |

The demo route is never added to the MCP gateway and the gateway's host never answers demo
traffic: anonymous demo traffic there would put a public playground inside the production
failure domain and behind the reviewed MCP surface.

### Frontend

This repository owns only the static demo page and its presentation. It must never contain an OpenAI key, Intervals token, provider credential, owner id, or writable shared state.

The page can be deployed by GitHub Pages as it is today. It calls a separate HTTPS backend endpoint with CORS restricted to the production site origin.

### Demo backend

The coaching/runtime repository owns the backend. The endpoint both mirrors call:

```text
POST https://demo-api.paceandstaystrong.com/demo/v1/respond
```

`scripts/check-site.py` holds `data-endpoint` on both pages equal to that string and fails
if either names the MCP host; the coach repository holds the same constant from its side.

Request:

```json
{
  "session_id": "opaque-random-id",
  "message": "I only have three 45-minute sessions..."
}
```

Response is one complete turn — `{"reply": "...", "turn": 3}` — with no streaming in this
version. `turn` is this conversation's own count, and the page reads it to notice a
conversation the backend has lost: a session expires, and it is gone entirely when the
service restarts, while the browser keeps the same id and the same transcript. The
endpoint is pinned to `gpt-5.6-luna` server-side and reuses the canonical Coach contracts, evidence
projection and plan-change projector rather than implementing a second prompt-only coach.

Errors carry a machine-readable `error.code`; the page shows its failure text for any of
them. `429` carries `Retry-After`.

## Demo athlete

Use a dedicated synthetic athlete only. Nothing on the page or backend should expose a real person's provider identity.

Preferred evidence shape:

- 4-6 weeks of plausible running history;
- at least two comparable quality sessions;
- easy/long running exposure;
- 1-2 strength movements with actual execution evidence;
- one explicit running goal and one strength-maintenance goal;
- a clear weekly time constraint for the allocation demo;
- enough missing evidence to demonstrate `unknown != zero` without making the demo confusing.

A dedicated Intervals.icu test account may be used as the source used to prepare/refresh this dataset, but public visitor traffic must not share a writable owner or mutate the shared provider calendar.

### Safer first release

For the launch demo, freeze the provider evidence into an immutable demo snapshot or use a read-only provider credential. Give each browser session an ephemeral copy of the plan state. A visitor can explore and reach an exact preview, but `apply` either:

- remains disabled with a clear "Demo mode does not change the shared athlete" explanation; or
- applies only to that visitor's ephemeral PlanState and resets when the session expires.

Do not let public visitors write to one shared Intervals.icu account.

## Abuse and cost boundary

The endpoint is unauthenticated by design, so add narrow limits:

- strict per-IP and per-session rate limit;
- short maximum input length;
- bounded number of turns per demo session;
- short session TTL;
- no file upload;
- no arbitrary remote MCP URL;
- no provider write tools;
- server-side API key only;
- minimal privacy-safe request logging.

The page should state that the athlete and data are fictional and that the playground resets.

## Suggested prompts

Keep three prompts visible so a visitor can get value without inventing a question:

1. **Trade off limited time** — "I only have three 45-minute sessions next week. I want a faster 10K without losing strength. What are my realistic options?"
2. **Review real execution** — "What changed across the comparable quality runs, and what is still unproven?"
3. **Change a constraint** — "Thursday is no longer available. What would you preserve and what would you give up?"

## Site changes once backend is live

Homepage hero:

- primary Product Hunt CTA: `Try the live demo` -> `/demo.html`;
- secondary CTA: `Connect my training` -> `#setup`;
- keep the existing MCP setup and films; do not reposition the web demo as the canonical product.

Demo page:

- fictional-athlete summary;
- prompt chips;
- conversation area;
- clear `Demo mode` label;
- `Connect my own training` exit CTA;
- English / Traditional Chinese mirrors.

## Release gates

Before linking the homepage CTA:

- [ ] Backend uses a server-side API key and no secret is present in the static site.
- [ ] Demo athlete is synthetic and contains no owner/tester's private identity.
- [ ] Public traffic cannot mutate the shared Intervals.icu calendar.
- [ ] Separate browser sessions cannot see or alter each other's PlanState.
- [ ] Rate limiting and input bounds are active.
- [ ] The three suggested prompts work end to end.
- [ ] Failure mode is readable (backend unavailable / rate limited) rather than an endless spinner.
- [ ] English and Traditional Chinese pages match in capability and disclosure.
- [ ] `python3 scripts/check-site.py` passes.
- [ ] `demo-api.paceandstaystrong.com` resolves and `GET /healthz` reports `"status":"ok"`.
- [ ] `python3 -m entrypoints.demo.acceptance --base-url https://demo-api.paceandstaystrong.com` passes in the coach repository.
- [ ] Mobile and desktop browser smoke tests pass.

## Non-goals for the Product Hunt launch

- A new account system.
- A general-purpose Long Run web app.
- Replacing MCP as the product's primary architecture.
- Public writes to a shared demo provider account.
- Nutrition, new wearables, or additional coaching metrics.
- A second plan store or forked coaching rules.
