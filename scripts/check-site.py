#!/usr/bin/env python3
"""Check the static site before it is pushed, because pushing publishes it.

Covers the three things this repository can break silently:

1. A local link or in-page anchor that points at nothing.
2. A mirror that fell out of step -- an English page with no `zh/` counterpart,
   or a language link that lands on the wrong page.
3. One of the four registered listing URLs disappearing from the repository root.

Standard library only, no build step. Run it from the repository root.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Registered with an app platform under review. These paths cannot move.
LISTING_PATHS = ("index.html", "privacy.html", "terms.html", "support.html")

MIRRORED = ("index.html", "start.html", "privacy.html", "terms.html", "support.html")

LINK = re.compile(r'(?:href|src)="([^"]+)"')
ID = re.compile(r'\sid="([^"]+)"')
HTML_LANG = re.compile(r'<html lang="([^"]+)"')
HREFLANG = re.compile(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">')

# Simplified-only forms. Every one of these has a different Traditional form, so
# a hit is a real mistake rather than a style preference.
SIMPLIFIED = set(
    "训练录说认让应该无开权实处备删网页项单这为与请统类设导览资讯档们学点动态样"
    "进过还费选择确时间员现长关门问题数据计转输载图试验证连结标级复杂简体极"
)

problems: list[str] = []


def fail(page: Path, message: str) -> None:
    problems.append(f"{page.relative_to(ROOT)}: {message}")


def pages() -> list[Path]:
    return sorted(p for p in ROOT.rglob("*.html") if ".git" not in p.parts)


def main() -> int:
    all_pages = pages()
    ids = {p: set(ID.findall(p.read_text())) for p in all_pages}

    for name in LISTING_PATHS:
        if not (ROOT / name).is_file():
            problems.append(f"listing URL /{name} has no file at the repository root")

    for name in MIRRORED:
        for side in (ROOT / name, ROOT / "zh" / name):
            if not side.is_file():
                problems.append(f"mirror incomplete: {side.relative_to(ROOT)} is missing")

    for page in all_pages:
        text = page.read_text()
        is_zh = page.parent.name == "zh"

        lang = HTML_LANG.search(text)
        expected_lang = "zh-Hant" if is_zh else "en"
        if not lang or lang.group(1) != expected_lang:
            fail(page, f'<html lang> should be "{expected_lang}"')

        if is_zh and (found := SIMPLIFIED.intersection(text)):
            fail(page, f"simplified characters present: {''.join(sorted(found))}")

        # Local links and anchors.
        for raw in LINK.findall(text):
            if raw.startswith(("http://", "https://", "mailto:", "data:")):
                continue
            target, _, fragment = raw.partition("#")
            target = target.split("?")[0]
            if not target:
                if fragment and fragment not in ids[page]:
                    fail(page, f'anchor "#{fragment}" does not exist on this page')
                continue
            resolved = (page.parent / target).resolve()
            if not resolved.is_file():
                fail(page, f'link "{raw}" resolves to a missing file')
                continue
            if fragment and resolved.suffix == ".html":
                if fragment not in ids.get(resolved, set(ID.findall(resolved.read_text()))):
                    fail(page, f'anchor "{raw}" does not exist on the target page')

        # Mirror declarations.
        if page.name in MIRRORED:
            declared = dict(HREFLANG.findall(text))
            for key in ("en", "zh-Hant", "x-default"):
                if key not in declared:
                    fail(page, f'missing hreflang="{key}"')
            english = "https://paceandstaystrong.com/" + ("" if page.name == "index.html" else page.name)
            chinese = "https://paceandstaystrong.com/zh/" + ("" if page.name == "index.html" else page.name)
            if declared.get("en") != english:
                fail(page, f'hreflang="en" should be {english}')
            if declared.get("zh-Hant") != chinese:
                fail(page, f'hreflang="zh-Hant" should be {chinese}')
            if declared.get("x-default") != english:
                fail(page, f'hreflang="x-default" should be {english}')

    if problems:
        print(f"{len(problems)} problem(s):", file=sys.stderr)
        for line in problems:
            print(f"  {line}", file=sys.stderr)
        return 1

    print(f"OK — {len(all_pages)} pages, links, anchors, and both mirrors check out.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
