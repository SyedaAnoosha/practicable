"""Editor formatting survives from admin save to the reading page, end to end.

The chain: admin save -> `sanitize_html` -> `lessons.prose_sanitized` ->
`GET /lessons/{id}` -> `RichText` -> `.rich-text` CSS. Two faults are pinned here:

1. Plain text stored in an HTML column. `sanitize_html` now promotes tag-free text to
   real paragraphs, so a pasted body is no longer stored raw and rendered as one wall
   of text via `dangerouslySetInnerHTML`.
2. A tag detector whose `\\b` had been mangled into a literal backspace, so it matched
   nothing and classified real editor HTML as plain text.
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
