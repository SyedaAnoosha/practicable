"""HTML sanitization for lesson prose.

Storage format: sanitized HTML, not Tiptap JSON.
Reason: HTML needs only one renderer (the browser), while Tiptap JSON would
need a custom renderer on the client *and* a second for any future email/PDF
path.  One format, one consumer.

Sanitizer choice: bleach (Python, maintained) over nh3 (Rust, maintained).
nh3 would be faster but its API surface is narrower and its allow-list
granularity is insufficient for the forced-attribute rules below (e.g.
injecting ``rel`` onto every ``<a>``).  bleach is battle-tested for exactly
this use case and already a project dependency.  If performance becomes a
measured concern, nh3 can replace bleach inside this module's public API
without changing any caller.

Heading-level policy:
  A lesson body's ``<h1>`` would compete with the page's own ``PageTitle h1``,
  which axe flags.  The toolbar's "H1" button therefore emits
  ``<h2>``, and the sanitizer strips ``<h1>``, ``<h5>``, ``<h6>`` — only
  ``h2``, ``h3``, ``h4`` survive.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    import bleach as _bleach

try:
    import bleach
    HAS_BLEACH = True
except ImportError:
    HAS_BLEACH = False


# ── Allow-lists ───────────────────────────────────────────────────────────────
# Explicit allow-list.  Everything else is stripped.

ALLOWED_TAGS: set[str] = {
    # Headings — capped at h2-h4.  h1 competes with PageTitle;
    # h5/h6 are not in the design type scale.
    "h2", "h3", "h4",
    # Text formatting
    "strong", "b", "em", "i", "u", "s", "sub", "sup",
    # Lists
    "ul", "ol", "li",
    # Block elements
    "p", "br", "blockquote", "hr",
    # Tables
    "table", "thead", "tbody", "tr", "th", "td",
    # Code
    "code", "pre",
    # Links
    "a",
}

# Only attributes the design needs.  No class/id — styling comes from the
# .rich-text CSS block, not inline attributes an author could abuse.
ALLOWED_ATTRIBUTES: dict[str, list[str]] = {
    "a": ["href", "title"],
}

ALLOWED_PROTOCOLS: frozenset[str] = frozenset({"http", "https", "mailto"})


# ── Public API ────────────────────────────────────────────────────────────────

# ── Plain text arriving where HTML was expected ───────────────────────────────
# `prose_sanitized` is rendered with `dangerouslySetInnerHTML`, and `Learn.tsx` switches
# to that path the moment the column is non-null. So a body that reaches this function as
# **plain text** — pasted straight in, or written before the editor existed — is stored
# verbatim, and the browser then collapses every newline into a single space. The reader
# gets one undifferentiated wall of text, and the plain-text fallback that would have
# rendered it correctly (`whitespace-pre-line`) is skipped precisely because the column
# is set.
#
# `frontend/src/lib/utils/plainTextToEditorHtml.ts` already solved this shape for the
# editor's LOAD path. It was never applied on save, so the bad value still reached the
# database. This is the server-side twin, and it deliberately matches that file's rules:
#
#   * one `<p>` per blank-line-separated paragraph, single newlines becoming `<br>`
#   * HTML-escaped first, so a literal `<` or `&` in old prose renders as that character
#   * **no guessing of structure** — a line starting "1." does NOT become an `<li>`, and
#     a short line does NOT become a heading. Silently restructuring content the author
#     never asked to have restructured is a worse failure than a flat paragraph.
#
# Applied only when the input contains no block-level markup at all, so it can never
# touch real editor output.

# Any HTML tag at all. Deliberately NOT a list of block-level tags: a body whose only
# markup is `<img>` or `<body onload=...>` has no block tag, and treating it as plain
# text would escape it into visible angle brackets instead of letting bleach strip it
# against the allow-list. One question — "is there markup here?" — rather than a tag list
# that has to be kept in sync with ALLOWED_TAGS.
_ANY_TAG_RE = re.compile(r"<\s*/?\s*[a-zA-Z][a-zA-Z0-9]*\b[^>]*>")


def _looks_like_plain_text(text: str) -> bool:
    """True when the input carries no HTML markup of its own.

    Only genuinely tag-free text is promoted to paragraphs. Anything containing a tag —
    valid or not, allowed or not — goes straight to bleach, which is the component that
    decides what survives.
    """
    return _ANY_TAG_RE.search(text) is None


def _escape_html(text: str) -> str:
    """Escape a tag-free string for embedding in HTML.

    Only reached for input `_looks_like_plain_text` classified as carrying no markup, so
    there is nothing to preserve — anything with a tag went to bleach instead.
    """
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def plain_text_to_html(text: str) -> str:
    """One `<p>` per blank-line-separated paragraph; single newlines become `<br>`."""
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text)]
    paragraphs = [p for p in paragraphs if p]
    if not paragraphs:
        return ""
    return "".join(
        "<p>" + _escape_html(p).replace("\n", "<br>") + "</p>" for p in paragraphs
    )


def sanitize_html(html: Optional[str]) -> Optional[str]:
    """Sanitize HTML from the rich-text editor for safe display.

    Server-side because a client-side sanitizer protects nobody from a direct
    API call — and the admin API is the one an attacker with a stolen admin
    session would use.

    Rules:
      * Only ALLOWED_TAGS survive; everything else is stripped (not escaped).
      * Only ALLOWED_ATTRIBUTES survive per tag.
      * Only ALLOWED_PROTOCOLS are accepted in href/src.
      * Every ``<a>`` gets ``rel="noopener noreferrer"`` forced onto it.
      * ``<script>``, event handlers (onclick, onerror, …) and ``javascript:``
        hrefs are stripped even if they somehow survive the tag allow-list.
    """
    if html is None:
        return None

    if not HAS_BLEACH:
        raise RuntimeError(
            "bleach package is required for HTML sanitization. "
            "Install it with: pip install bleach"
        )

    # Promote plain text to real paragraphs BEFORE sanitizing (see the note above the
    # helper). Doing it here rather than at each call site means every writer of this
    # column — lesson body, block text, and anything added later — gets the guarantee
    # that `prose_sanitized` is always renderable HTML, never raw text whose newlines
    # the browser will silently swallow.
    if html.strip() and _looks_like_plain_text(html):
        html = plain_text_to_html(html)

    cleaned: str = bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )

    # ── Forced rel="noopener noreferrer" on every link ────────────────────
    # bleach's clean() doesn't add attributes; this post-pass injects rel
    # on every surviving <a>.  The regex targets only opening <a> tags that
    # already have an href (the allow-list ensures no <a survives without
    # href), so it cannot match <a> tags that bleach stripped to text.
    def _inject_rel(match: re.Match[str]) -> str:
        tag = match.group(0)
        if 'rel=' not in tag:
            # Insert rel right before the closing >
            tag = tag[:-1] + ' rel="noopener noreferrer">'
        else:
            # Replace any existing rel value
            tag = re.sub(r'rel="[^"]*"', 'rel="noopener noreferrer"', tag)
        return tag

    cleaned = re.sub(r'<a\b[^>]*>', _inject_rel, cleaned)

    return cleaned


def strip_tags(html: Optional[str]) -> str:
    """Strip all HTML tags, returning plain text."""
    if html is None:
        return ""
    if HAS_BLEACH:
        return bleach.clean(html, tags=[], strip=True, strip_comments=True)
    return re.sub(r"<[^>]+>", "", html or "")
