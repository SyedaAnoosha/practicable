"""Repair `prose_sanitized` rows that hold raw plain text (found live 2026-08-22).

The bug, in the owner's words: *"if i am selecting h2, bullets, bold nothing is shown in
the actual reading lesson."*

`prose_sanitized` is rendered with `dangerouslySetInnerHTML`, and `Learn.tsx` switches to
that path the moment the column is non-null. So a body that reached the sanitizer as
plain text was stored verbatim, and the browser then collapsed every newline into a
single space — one undifferentiated wall of text, with no way back to the
`whitespace-pre-line` fallback that would have rendered it correctly, precisely because
the column is set.

`sanitize_html()` now promotes tag-free text to real paragraphs before storing, so no NEW
row can be written this way. That fix cannot repair rows already in the table — this
script does that, once.

What it changes, and what it deliberately leaves alone
------------------------------------------------------
A row qualifies only when `prose_sanitized` is non-null, non-empty, and contains **no
HTML tag at all**. Such a value is unusable as HTML by definition, so re-running it
through `sanitize_html()` can only improve it.

It does **not** guess structure. A line reading "1. First step" stays a paragraph line;
a short line in title case does not become an `<h2>`. Silently restructuring content the
author never asked to have restructured is a worse failure than a flat paragraph — the
same rule `frontend/src/lib/utils/plainTextToEditorHtml.ts` already states for the
editor's load path, and the same one `repair_double_escaped_prose.py` followed.

`body` is left untouched. It is the plain-text original and remains the correct fallback
for any row this script does not repair.

Usage (from backend/):
    python scripts/repair_plaintext_prose.py            # report only, writes nothing
    python scripts/repair_plaintext_prose.py --apply    # write the repaired prose
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.html_sanitizer import _looks_like_plain_text, sanitize_html  # noqa: E402
from app.db.models import Lesson, LessonBlock  # noqa: E402
from app.db.session import _asyncpg_url  # noqa: E402


def _needs_repair(prose: str | None) -> bool:
    """True when the stored value is non-empty text carrying no markup whatsoever.

    Uses the sanitizer's own detector rather than a second copy of the rule, so the
    repair and the prevention can never disagree about what "plain text" means.
    """
    if not prose or not prose.strip():
        return False
    return _looks_like_plain_text(prose)


async def main(apply: bool) -> int:
    engine = create_async_engine(_asyncpg_url(settings.database_url))
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    repaired_lessons = 0
    repaired_blocks = 0

    async with Session() as session:
        lessons = (await session.execute(select(Lesson))).scalars().all()
        for lesson in lessons:
            if not _needs_repair(lesson.prose_sanitized):
                continue
            fixed = sanitize_html(lesson.prose_sanitized)
            if not fixed or fixed == lesson.prose_sanitized:
                continue
            print(
                "lesson " + lesson.slug + ": "
                + str(len(lesson.prose_sanitized or "")) + " chars of plain text -> "
                + str(fixed.count("<p>")) + " paragraph(s)"
            )
            if apply:
                lesson.prose_sanitized = fixed
                repaired_lessons += 1

        blocks = (await session.execute(select(LessonBlock))).scalars().all()
        for block in blocks:
            if not _needs_repair(block.prose_sanitized):
                continue
            fixed = sanitize_html(block.prose_sanitized)
            if not fixed or fixed == block.prose_sanitized:
                continue
            print(
                "block " + str(block.id) + ": "
                + str(len(block.prose_sanitized or "")) + " chars of plain text -> "
                + str(fixed.count("<p>")) + " paragraph(s)"
            )
            if apply:
                block.prose_sanitized = fixed
                repaired_blocks += 1

        if apply and (repaired_lessons or repaired_blocks):
            await session.commit()

    await engine.dispose()

    print()
    if apply:
        print(
            "Repaired " + str(repaired_lessons) + " lesson(s) and "
            + str(repaired_blocks) + " block(s)."
        )
    else:
        print("Dry run — nothing written. Re-run with --apply.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write the repaired prose")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(args.apply)))
