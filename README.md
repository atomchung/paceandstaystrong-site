# Pace & Stay Strong

Public static website for the personal GitHub project **Long Run Hybrid Coach**.

Long Run Hybrid Coach is an independent, Intervals-first, device-agnostic running and
strength coaching project. This repository publishes the short public product overview,
privacy policy, terms of service, support page, and public assets. It is not the coaching
runtime and has no access to athlete state, provider credentials, gateway secrets, or
deployment volumes.

The website explains only the stable first-layer product story: what the Coach is, why
Intervals.icu is currently part of the loop, that Garmin is not a prerequisite, and the
choice between the hosted MCP and a self-hosted gateway. The core repository README is the
canonical detailed onboarding guide and owns per-client setup, capability boundaries, and
current verification status.

## Repository boundaries

- Product runtime, contracts, tests, evals, entrypoints, detailed onboarding, and gateway
  release operations:
  [`long-run-hybrid-coach`](https://github.com/atomchung/long-run-hybrid-coach)
- Brand decisions, application records, GTM notes, and master assets: the private
  `garmin-coach-loop-venture` workspace
- Public landing page, policy/support pages, and published assets: this repository

Capability claims on this site must remain consistent with the current core release. A
runtime or data-boundary change is made in the core repository first, then reflected here.
Copy-only changes stay in this repository and do not create a gateway release. Platform-
specific setup details should not be duplicated here when the core README can own them in
one place.

## Localization contract

This site mirrors exactly one page into Traditional Chinese, on purpose — not as a first
step toward full localization.

1. **Mirrored pages: exactly one pair.** `start.html` ↔ `zh/start.html`. Any commit that
   changes `start.html` must change `zh/start.html` in the same commit, or open a tracking
   issue in the same change.
2. **The homepage and the legal pages (privacy, terms, support) are English-only by
   decision, not omission.** Community posts carry the persuasion job in each language;
   legal wording keeps a single authoritative version.
3. **No build step, no SSG, no i18n framework, no JS language toggle.** Static mirror
   files with `hreflang` are the final mechanism, not a stopgap.
4. **A second mirrored page requires evidence, not intent.** Both of the following, not
   either: real traffic on `zh/start.html`, and a reader demonstrably blocked by an
   English page.

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
