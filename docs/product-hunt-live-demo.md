# Product Hunt live demo

Status: implementation plan; the public site remains static until the demo backend is live.

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

### Frontend

This repository owns only the static demo page and its presentation. It must never contain an OpenAI key, Intervals token, provider credential, owner id, or writable shared state.

The page can be deployed by GitHub Pages as it is today. It calls a separate HTTPS backend endpoint with CORS restricted to the production site origin.

### Demo backend

The coaching/runtime repository owns the backend. Recommended endpoint shape:

```text
POST https://mcp.paceandstaystrong.com/demo/v1/respond
```

Request:

```json
{
  "session_id": "opaque-random-id",
  "message": "I only have three 45-minute sessions..."
}
```

Response may be streamed, but the first implementation can return one complete turn. The endpoint should use GPT-6 Astra server-side for the Product Hunt demo and call/reuse the canonical Coach logic rather than implement a second prompt-only coach.

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
- [ ] Mobile and desktop browser smoke tests pass.

## Non-goals for the Product Hunt launch

- A new account system.
- A general-purpose Long Run web app.
- Replacing MCP as the product's primary architecture.
- Public writes to a shared demo provider account.
- Nutrition, new wearables, or additional coaching metrics.
- A second plan store or forked coaching rules.
