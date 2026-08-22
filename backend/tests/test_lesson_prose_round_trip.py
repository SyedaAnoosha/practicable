"""Editor formatting survives all the way to the reading page (owner report 2026-08-22).

The report: *"if i am selecting h2, bullets, bold nothing is shown in the actual reading
lesson."*

The chain under test is admin save -> `sanitize_html` -> `lessons.prose_sanitized` ->
`GET /lessons/{id}` -> `RichText` -> `.rich-text` CSS. Each link had its own coverage;
nothing asserted the chain end to end, which is how a break in the middle went unnoticed.

Two distinct faults sat behind the report, and both are pinned here:

1. **Plain text stored in an HTML column.** `sanitize_html` passed tag-free text through
   unchanged, so a pasted body was stored raw. `Learn.tsx` switches to the
   `dangerouslySetInnerHTML` path the moment `prose_sanitized` is non-null, so the
   browser collapsed every newline into a space — one wall of text — and the
   `whitespace-pre-line` fallback that renders plain text correctly was skipped precisely
   *because* the column was set. Found live on
   `asset-inventory-what-you-don-t-know-can-hurt-you` (15,060 characters, zero tags) and
   repaired by `scripts/repair_plaintext_prose.py`.

2. **A detector that matched nothing.** The tag test's `\\b` had been mangled into a
   literal backspace, so it matched no input at all and classified *real editor HTML* as
   plain text — which would have escaped every heading and bullet into visible angle
   brackets. Caught before shipping; `test_real_editor_html_survives_untouched` is what
   would have caught it in CI.
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.html_sanitizer import sanitize_html
from app.db.models import Lesson

# What Tiptap actually emits for: an H2, a bold word, a bullet list, a numbered list.
EDITOR_HTML = (
    "<h2>Why asset inventory matters</h2>"
    "<p>You cannot manage what you <strong>cannot see</strong>.</p>"
    "<ul><li>Laptops and desktops</li><li>Cloud resources</li></ul>"
    "<ol><li>Find them</li><li>Own them</li></ol>"
    "<h3>A smaller heading</h3>"
    "<p>Closing line with <em>emphasis</em>.</p>"
)


class TestSanitizerPreservesEditorFormatting:
    """The unit half: every mark the toolbar can produce survives sanitizing."""

    def test_real_editor_html_survives_untouched(self):
        """The regression that matters most. If the plain-text detector ever misfires
        again, this fails loudly instead of silently escaping every heading."""
        assert sanitize_html(EDITOR_HTML) == EDITOR_HTML

    @pytest.mark.parametrize(
        "fragment",
        [
            "<h2>Heading two</h2>",
            "<h3>Heading three</h3>",
            "<h4>Heading four</h4>",
            "<p><strong>bold</strong></p>",
            "<p><em>italic</em></p>",
            "<p><u>underline</u></p>",
            "<ul><li>a bullet</li></ul>",
            "<ol><li>a number</li></ol>",
            "<blockquote><p>a quote</p></blockquote>",
        ],
    )
    def test_each_toolbar_mark_survives(self, fragment: str):
        assert sanitize_html(fragment) == fragment

    def test_plain_text_is_never_stored_raw_in_an_html_column(self):
        """Fault 1. Whatever comes back must be renderable as HTML — never bare text
        whose newlines the browser will silently swallow."""
        result = sanitize_html("Line one\nline two\n\nA second paragraph")
        assert result is not None
        assert "<p>" in result
        assert result == "<p>Line one<br>line two</p><p>A second paragraph</p>"


@pytest.mark.asyncio
async def test_formatting_reaches_the_reading_page(
    admin_client: AsyncClient, entitled_client: AsyncClient, content_graph, db_session, entitled_user, grant
):
    """The integration half: save through the admin API, read back through the public
    lesson API as an entitled reader, and assert the markup arrived intact."""
    await grant(entitled_user, content_graph.lesson_product)
    await db_session.flush()

    lesson = content_graph.lesson
    resp = await admin_client.put(
        f"/admin/lessons/{lesson.id}",
        json={
            "title": lesson.title,
            "lesson_type": "reading",
            "body": EDITOR_HTML,
        },
    )
    assert resp.status_code in (200, 204), resp.text

    stored = (
        await db_session.execute(select(Lesson).where(Lesson.id == lesson.id))
    ).scalar_one()
    await db_session.refresh(stored)
    assert stored.prose_sanitized == EDITOR_HTML, "the sanitizer altered real editor output"

    read = await entitled_client.get(
        f"/courses/{content_graph.course.slug}/lessons/{lesson.slug}"
    )
    assert read.status_code == 200, read.text
    prose = read.json()["prose_sanitized"]

    # The three the owner named by hand, asserted individually so a failure says which.
    assert "<h2>" in prose, "H2 did not reach the reading page"
    assert "<strong>" in prose, "bold did not reach the reading page"
    assert "<ul>" in prose and "<li>" in prose, "bullets did not reach the reading page"
