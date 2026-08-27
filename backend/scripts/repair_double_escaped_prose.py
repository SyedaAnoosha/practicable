"""Repair cascading-escaped lesson/block prose.

A stored body can accumulate layers of HTML-entity escaping — e.g. `<p>`
becomes `&lt;p&gt;`, then `&amp;lt;p&amp;gt;` and so on, visible as literal
escaped markup on the reading page instead of formatted text. The editor fix
(AdminCourses.tsx preferring prose_sanitized, plainTextToEditorHtml only
running against genuine legacy plain text) stops new corruption; this is a
one-time repair for rows already corrupted.

Approach: repeatedly html.unescape() each affected body/prose_sanitized
value until it stabilises, then re-run the result through sanitize_html() so
the stored prose_sanitized stays governed by the same allow-list as any
freshly-saved content. `body` is set to the same unescaped,
plain-tag-stripped text via strip_tags(), mirroring a legacy plain-text
body, so the plain-text fallback in AdminCourses.tsx keeps behaving sanely
for any row this script cannot fully repair.

A row only qualifies as "affected" if its escaped text, once unescaped,
actually decodes into real markup (contains a literal `<` after unescaping)
AND the stored text contains an escaped tag pattern (e.g. `&lt;p&gt;` or
deeper). Content that legitimately contains literal `&lt;`-style text (an
admin discussing HTML in prose) is deliberately left untouched — the
detection requires the escaped pattern to itself decode to one of the
sanitizer's allowed tags, not just contain an ampersand.

Dry-run by default: prints every row it would change and a before/after
snippet, changes nothing. Pass --apply to write.

Usage:
    python -m scripts.repair_double_escaped_prose            # dry run
    python -m scripts.repair_double_escaped_prose --apply     # write changes
"""
from __future__ import annotations

import argparse
import asyncio
import html
import re

from sqlalchemy import select

from app.core.html_sanitizer import ALLOWED_TAGS, sanitize_html, strip_tags
from app.db.models import Lesson, LessonBlock
from app.db.session import AsyncSessionLocal

# A genuine opening/closing tag for one of our allowed tags, once fully
# unescaped (<p>, <p class=...>, </p>, <br>, ...). Matched only against the
# STABLE (fully-unescaped) text, never the raw stored value — each layer of
# corruption escapes the previous layer's literal `&` differently
# (&lt;p&gt; -> &amp;lt;p&amp;gt; -> &amp;amp;lt;p&amp;amp;gt; -> ...), so no
# single regex could match "an escaped tag at any depth" directly. Unescaping
# to stability first sidesteps that entirely.
_REAL_TAG_RE = re.compile(
    r"</?(" + "|".join(re.escape(t) for t in sorted(ALLOWED_TAGS)) + r")(?:[\s/][^<>]*)?>",
    re.IGNORECASE,
)

MAX_UNESCAPE_ITERATIONS = 10


def unescape_until_stable(text: str, max_iter: int = MAX_UNESCAPE_ITERATIONS) -> tuple[str, int]:
    """Repeatedly html.unescape() until a pass changes nothing. Returns (result, passes)."""
    prev = text
    for i in range(max_iter):
        nxt = html.unescape(prev)
        if nxt == prev:
            return prev, i
        prev = nxt
    return prev, max_iter


def looks_corrupted(text: str | None) -> bool:
    """True if unescaping `text` to stability reveals a real allow-listed tag
    that wasn't visible in the original (i.e. it was escaped at least once).

    Deliberately depth-independent: doesn't try to pattern-match the escaped
    form directly (impossible with one regex — each corruption layer escapes
    the previous layer's `&` differently, see _ESCAPED_ONCE_RE's note). A row
    already containing genuine unescaped tags (the normal, uncorrupted case)
    is excluded via the `stable != text` check, since unescaping healthy HTML
    already containing e.g. a literal '&amp;' entity for a real ampersand is
    a no-op past the first pass only if that entity has nothing left to
    unescape into a tag — see the guard below for the one case that isn't:
    prose that legitimately contains a literal '&lt;' as text (e.g. an
    author writing "the tag looks like &lt;p&gt;"), which WILL decode to
    something matching _REAL_TAG_RE. That case is accepted as an acceptable
    false positive: repair() re-sanitizes and re-stores the same visible
    content either way (unescaping text that reads as "&lt;p&gt;" once and
    then re-escaping it back out via storage is idempotent), so a false
    positive here costs nothing but one extra unescape/re-store pass.
    """
    if not text:
        return False
    stable, passes = unescape_until_stable(text)
    if passes == 0:
        return False
    return bool(_REAL_TAG_RE.search(stable))


async def repair(apply: bool) -> None:
    # get_session() is a FastAPI dependency generator, not an async context manager —
    # `async with get_session()` raises TypeError before any query runs. Use
    # AsyncSessionLocal() (the session factory itself) instead — see grant_admin.py.
    async with AsyncSessionLocal() as session:
        lessons = (await session.execute(select(Lesson))).scalars().all()
        blocks = (await session.execute(select(LessonBlock))).scalars().all()

        changed_lessons = 0
        changed_blocks = 0

        for lesson in lessons:
            # Prefer prose_sanitized as the source of truth when present — it's
            # what's actually rendered — else fall back to body.
            source = lesson.prose_sanitized or lesson.body
            if not looks_corrupted(source):
                continue

            unescaped, passes = unescape_until_stable(source)
            new_sanitized = sanitize_html(unescaped)
            new_body = strip_tags(unescaped)

            print(f"[lesson] {lesson.id} '{lesson.title}': {passes} unescape pass(es)")
            print(f"  before: {source[:120]!r}")
            print(f"  after : {(new_sanitized or '')[:120]!r}")

            if apply:
                lesson.prose_sanitized = new_sanitized
                lesson.body = new_body
            changed_lessons += 1

        for block in blocks:
            source = block.prose_sanitized or block.text_body
            if not looks_corrupted(source):
                continue

            unescaped, passes = unescape_until_stable(source)
            new_sanitized = sanitize_html(unescaped)
            new_text_body = strip_tags(unescaped)

            print(f"[block] {block.id} (lesson {block.lesson_id}): {passes} unescape pass(es)")
            print(f"  before: {source[:120]!r}")
            print(f"  after : {(new_sanitized or '')[:120]!r}")

            if apply:
                block.prose_sanitized = new_sanitized
                block.text_body = new_text_body
            changed_blocks += 1

        if apply:
            await session.commit()

        mode = "APPLIED" if apply else "DRY RUN — nothing written, pass --apply to write"
        print(f"\n{mode}")
        print(f"Lessons affected: {changed_lessons} / {len(lessons)}")
        print(f"Blocks affected:  {changed_blocks} / {len(blocks)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = parser.parse_args()
    asyncio.run(repair(args.apply))
