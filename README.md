# Pace & Stay Strong

Public static website for the personal GitHub project **Long Run Hybrid Coach**.

Long Run Hybrid Coach is an independent, Intervals-first, device-agnostic running and
strength coaching project. This repository publishes the public overview, privacy policy,
terms of service, and public assets. It is not the coaching runtime and has no access to
athlete state, provider credentials, gateway secrets, or deployment volumes.

## Repository boundaries

- Product runtime, contracts, tests, evals, entrypoints, and gateway release operations:
  [`long-run-hybrid-coach`](https://github.com/atomchung/long-run-hybrid-coach)
- Brand decisions, application records, GTM notes, and master assets: the private
  `garmin-coach-loop-venture` workspace
- Public pages and published assets: this repository

Capability claims on this site must remain consistent with the current core release. A
runtime or data-boundary change is made in the core repository first, then reflected here.
Copy-only changes stay in this repository and do not create a gateway release.

## Local verification

```bash
git diff --check
python3 -c "from pathlib import Path; html = Path('index.html').read_text(); assert 'assets/styles.css' in html; assert Path('privacy.html').exists(); assert Path('terms.html').exists()"
```

## Deployment

The `main` branch deploys to GitHub Pages through
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). The root website domain and
the hosted MCP endpoint are separate concerns: the website is static; the MCP endpoint is
served by the core gateway deployment.

The canonical address is the apex `paceandstaystrong.com`. `CNAME` records that decision,
but this site publishes from a workflow rather than a branch, and Pages ignores a `CNAME`
file on that path — the domain is attached in this repository's Pages settings, and the
DNS records that make it answer are at Cloudflare. The sequence, including the order that
avoids both a takeover window and an outage, is
`docs/ops/point-the-website-at-the-apex-domain.md` in the core repository.
