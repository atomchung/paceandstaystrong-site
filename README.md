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

Every page on this site exists in two languages: English at the repository root, and
Traditional Chinese under `zh/` with the same filename. `index.html` ↔ `zh/index.html`,
`start.html` ↔ `zh/start.html`, and the same for `privacy`, `terms`, and `support`.

`start.html` and `zh/start.html` are no longer pages. The setup steps were folded into
the homepage on 25 August 2026 — a first-time reader was being asked to choose between
learning what the product is and learning how to connect it, and the connection address is
the fastest answer to both. What remains at those two paths is a redirect stub to
`index.html#setup`, kept because the start URL was published in launch posts and a 404 is
worse than a hop. Nothing links to them.

This replaces the earlier single-pair rule, in which only the start page was mirrored and
the homepage and legal pages were English-only. That rule was overturned on 23 August 2026:
a "中文" link in the navigation reads as a whole-site language switch, so a reader who
follows it onto one translated page and hits English everywhere after it has been misled by
the navigation rather than served by it.

1. **Full mirror, matching filenames.** A new English page requires its `zh/` counterpart in
   the same change. There is no partial-mirror state to design around.
2. **Same commit, both languages.** Any commit that changes an English page changes its
   Chinese counterpart, or opens a tracking issue in the same change. A translation left for
   later is a page that silently states an older version of the product.
3. **The language link on every page points at that same page in the other language** — never
   at the other language's homepage. Each pair declares both `hreflang` values plus
   `x-default` pointing at the English page.
4. **English is authoritative for `privacy.html` and `terms.html`.** The Chinese versions
   carry a governing-language notice saying so, and exist for readability rather than legal
   effect. This is why translating them is safe: a wording that drifts in the Chinese text
   cannot change what the product has promised, because the promise is the English text.
5. **No build step, no SSG, no i18n framework, no JS language toggle.** Static mirror files
   with `hreflang` are the final mechanism, not a stopgap. Shared presentation, including the
   Traditional Chinese font stack keyed off `html[lang="zh-Hant"]`, lives in
   `assets/styles.css` rather than being repeated per page.

### The four listing URLs

`/`, `/privacy.html`, `/terms.html`, and `/support.html` are registered with an app platform
under review. They must keep answering at those exact paths in English. Adding a translation
under `zh/` does not move them; renaming, redirecting, or turning any of the four into a
language chooser does. Separately, the privacy policy's commitments may be added to but never
removed — the policy record is issue #182 in the core repository.

## Local verification

Pushing to `main` publishes, so the check runs before the push, not after it. It walks
every page for dead links and dead in-page anchors, confirms both language mirrors are
complete and point at each other, confirms the four listing URLs still exist at the
repository root, and flags simplified characters that slipped into a `zh/` page.

```bash
git diff --check
python3 scripts/check-site.py
```

Then read the pages in a browser — the checker verifies that links resolve, not that the
copy is right:

```bash
python3 -m http.server 4173
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
