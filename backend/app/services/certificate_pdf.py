"""Certificate PDF renderer - generates a one-page A4 landscape certificate.

The PDF is generated once, cached under `certificates/{certificate_id}.pdf`,
and served through a presigned URL. Generation failure does not fail the
lesson-completion request - the row is written, the PDF is rendered lazily on
first fetch.

Colours come from frontend/src/styles/theme.css via the base.html.j2 hex palette,
copied into module constants with comments naming each token.

The wording is "Certificate of Completion", signed from the platform rather than
from a named individual. Both are asserted by tests in `tests/test_certificate_pdf.py`,
so a later edit that reintroduces an accreditation claim goes red rather than shipping:

  * The document asserts *completion of a course on this platform* and nothing more.
    `ATTESTATION_LINES` says "has completed the course" - not "is certified in", not
    "is qualified to", not "is accredited". `DISCLAIMER` states in the footer that
    the certificate records completion and is not a professional accreditation, so
    the limit is on the artefact itself and not merely in the email that carried it.
  * The signature block is the platform, not a person. Signing a named individual
    would assert that a human reviewed this specific learner's work; nobody did -
    issuance is automatic on 100% lesson completion. So the signature line reads
    `SIGNATORY_NAME` / `SIGNATORY_ROLE` and is drawn as a typeset name over a rule,
    never as a facsimile handwritten mark, which would misrepresent an automated
    issuance as a personal endorsement.

The verification code and the public verify URL are on the face of the document,
so the assertion is checkable by whoever is handed it rather than taken on trust.
"""
from __future__ import annotations

import logging
from io import BytesIO

from app.core.config import settings
from app.db.models import Certificate
from app.integrations.storage_client import generate_presigned_url, upload_file

logger = logging.getLogger(__name__)

# -- Theme colours (from frontend/src/styles/theme.css) ----------------------
# These are the light-theme hex values; Mail clients and PDF renderers can't
# read CSS custom properties, so they are literal here.
INK = "#1C1712"          # --foreground
GOLD_STRONG = "#7C5C14"  # --gold-strong
MUTED_INK = "#6E675A"    # --muted-foreground
PAGE_BG = "#F1ECE1"      # --muted
HEADER_BG = "#10213E"    # --stage
HEADER_FG = "#F7F2E9"    # --stage-foreground

# -- Wording (Section V.3.2 - owner-approved, see module docstring) ----------
BRAND_NAME = "Practicable"
CERTIFICATE_HEADING = "Certificate of Completion"
ATTESTATION_LINES = ("This is to certify that", "has completed the course")
SIGNATORY_NAME = "Practicable"
SIGNATORY_ROLE = "Issued automatically on course completion"
DISCLAIMER = (
    "This certificate records completion of the course named above. "
    "It is not a professional accreditation or licence."
)

# -- Storage key pattern -----------------------------------------------------
CERTIFICATES_PREFIX = "certificates"

# -- Layout ------------------------------------------------------------------
PAGE_WIDTH = 842   # A4 landscape, points
PAGE_HEIGHT = 595

# Outer margin for page furniture (the brand in the top band, the disclaimer).
MARGIN = 40
# Inset of the gold frame from the page edge. The frame replaces the old 80pt
# navy slab as the thing that contains the composition, at a fraction of the
# vertical cost.
FRAME_INSET = 22.0

# Decorative corner ornament size (points).
_CORNER_SIZE = 18.0

# Helvetica advance widths, in 1/1000 em, for the printable ASCII range 32-126.
# Text is centred by measuring it, not by guessing at `len(s) * 8` - a guess is
# wrong by a whole character for every "i" or "W" in a name, and names are the
# one string on this page we do not control.
_HELVETICA_WIDTHS = (
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
)
_HELVETICA_BOLD_WIDTHS = (
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
)


def _pdf_key(certificate_id: str) -> str:
    """Deterministic storage key for the cached certificate PDF."""
    return f"{CERTIFICATES_PREFIX}/{certificate_id}.pdf"


def _hex_to_rgb(hex_color: str) -> tuple[float, float, float]:
    """Convert a hex colour string to RGB floats (0-1 range) for PDF operators."""
    h = hex_color.lstrip("#")
    return (
        int(h[0:2], 16) / 255.0,
        int(h[2:4], 16) / 255.0,
        int(h[4:6], 16) / 255.0,
    )


# Common name/title characters with no latin-1 code point, mapped to ASCII so they
# don't encode to "?". Accented letters are excluded — latin-1 has them.
_TRANSLITERATE = str.maketrans({
    "‘": "'", "’": "'", "‚": "'", "‛": "'",   # single quotes
    "“": '"', "”": '"', "„": '"',                   # double quotes
    "–": "-", "—": "-", "‒": "-", "―": "-",   # dashes
    "…": "...",                                                # ellipsis
    "•": "-", " ": " ", " ": " ", " ": " ",    # bullet, spaces
    "′": "'", "″": '"',                                   # primes
})


def _sanitise(text: str) -> str:
    """Make a string safe to place inside a PDF literal string.

    Three separate hazards, all reachable from a learner-controlled display name:

    1. Parentheses and backslashes terminate or escape a PDF literal string. An
       unescaped close-paren in a name ends the string early and the rest of the
       name becomes stray operators - a corrupt page, from someone simply being
       called "Jo (Jos)".
    2. The content stream is encoded latin-1, so any character outside it raises
       `UnicodeEncodeError` *during upload* and the learner just gets a 502. Names
       have accents; replacing the unencodable character is the behaviour that
       still hands them a certificate.
    3. Typographic punctuation - curly apostrophes, en dashes - is outside latin-1
       and would fall to that replacement as a bare "?". `_TRANSLITERATE` maps it
       to the ASCII equivalent first, so "O'Brien" reads as a name rather than as
       "O?Brien" on a document someone shows an employer.

    Order matters: transliterate first, then escape, so a transliterated character
    can never introduce an unescaped delimiter.
    """
    out = text.translate(_TRANSLITERATE)
    out = out.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    # Drop control characters, then force the rest into latin-1's range.
    out = "".join(ch for ch in out if ch >= " ")
    return out.encode("latin-1", "replace").decode("latin-1")


def _text_width(text: str, size: float, *, bold: bool = False) -> float:
    """Width of `text` in points at `size`, using real Helvetica metrics."""
    table = _HELVETICA_BOLD_WIDTHS if bold else _HELVETICA_WIDTHS
    total = 0
    for ch in text:
        idx = ord(ch) - 32
        total += table[idx] if 0 <= idx < len(table) else 556
    return total * size / 1000.0


def _truncate_to_width(text: str, size: float, max_width: float, *, bold: bool = False) -> str:
    """Trim `text` so it fits `max_width`, adding an ellipsis if anything was cut.

    Truncating by character count (the previous `name[:40]`) overflows the page for
    wide names and wastes space on narrow ones, because it measures the wrong thing.
    """
    if _text_width(text, size, bold=bold) <= max_width:
        return text
    ellipsis = "..."
    budget = max_width - _text_width(ellipsis, size, bold=bold)
    out = ""
    for ch in text:
        if _text_width(out + ch, size, bold=bold) > budget:
            break
        out += ch
    return out.rstrip() + ellipsis


def _centred_text(
    text: str, *, y: float, size: float, colour: str, bold: bool = False,
    max_width: float | None = None,
) -> list[str]:
    """Emit a horizontally centred line of text as PDF content-stream operators.

    `BT` ... `ET` wraps every one. `Td`/`Tj`/`Tf` are only legal *inside* a text
    object; a content stream that issues them bare is malformed, and a reader is
    entitled to render nothing at all. That is exactly what the previous version
    did - eight `Tj` operators and not a single `BT` - so every certificate this
    platform issued was a blank page with a navy bar across the top.
    """
    safe = _sanitise(text)
    if max_width is not None:
        safe = _truncate_to_width(safe, size, max_width, bold=bold)
    r, g, b = _hex_to_rgb(colour)
    x = (PAGE_WIDTH - _text_width(safe, size, bold=bold)) / 2
    font = "/FB" if bold else "/F1"
    return [
        "BT",
        f"{r:.4f} {g:.4f} {b:.4f} rg",
        f"{font} {size} Tf",
        f"{x:.2f} {y:.2f} Td",
        f"({safe}) Tj",
        "ET",
    ]


def _left_text(
    text: str, *, x: float, y: float, size: float, colour: str, bold: bool = False,
) -> list[str]:
    """Emit a left-aligned line of text, likewise wrapped in BT/ET."""
    safe = _sanitise(text)
    r, g, b = _hex_to_rgb(colour)
    font = "/FB" if bold else "/F1"
    return [
        "BT",
        f"{r:.4f} {g:.4f} {b:.4f} rg",
        f"{font} {size} Tf",
        f"{x:.2f} {y:.2f} Td",
        f"({safe}) Tj",
        "ET",
    ]


def _rect(x: float, y: float, w: float, h: float, colour: str) -> list[str]:
    """Emit a filled rectangle."""
    r, g, b = _hex_to_rgb(colour)
    return ["q", f"{r:.4f} {g:.4f} {b:.4f} rg", f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re", "f", "Q"]


def _stroked_rect(
    x: float, y: float, w: float, h: float, colour: str, *, line_width: float = 1.0,
) -> list[str]:
    """Emit an outlined (not filled) rectangle - the frame around the page.

    Path operators, unlike text operators, are legal outside a text object, so this
    emits no `BT`/`ET`. It is bracketed in `q`/`Q` so the stroke colour and line
    width it sets cannot leak into whatever is drawn next.
    """
    r, g, b = _hex_to_rgb(colour)
    return [
        "q",
        f"{r:.4f} {g:.4f} {b:.4f} RG",
        f"{line_width:.2f} w",
        f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re",
        "S",
        "Q",
    ]


def _centred_rule(y: float, width: float, colour: str, *, thickness: float = 1.0) -> list[str]:
    """A short horizontal rule centred on the page - a divider between blocks.

    Used instead of a full-width rule so the accent separates without boxing the
    text in; the whitespace either side is doing as much work as the rule itself.
    """
    return _rect((PAGE_WIDTH - width) / 2, y, width, thickness, colour)


def _corner_ornament(x: float, y: float, size: float, colour: str, *, rotate: int = 0) -> list[str]:
    """Draw a small L-shaped corner ornament for the certificate frame.

    Four of these sit inside the gold frame corners to add visual refinement.
    `rotate` is 0/90/180/270 degrees clockwise.
    """
    r, g, b = _hex_to_rgb(colour)
    s = size
    # Each corner is two short strokes forming an L shape.
    # The rotation is handled by swapping which axes the strokes follow.
    if rotate == 0:      # top-left
        h1, v1 = (x, y, s, 0), (x, y, 0, -s)
    elif rotate == 90:   # top-right
        h1, v1 = (x, y, -s, 0), (x, y, 0, -s)
    elif rotate == 180:  # bottom-right
        h1, v1 = (x, y, -s, 0), (x, y, 0, s)
    else:                # bottom-left
        h1, v1 = (x, y, s, 0), (x, y, 0, s)

    ops = ["q", f"{r:.4f} {g:.4f} {b:.4f} RG", "1.2 w"]
    # Horizontal stroke
    ops += [f"{h1[0]:.2f} {h1[1]:.2f} m", f"{h1[0]+h1[2]:.2f} {h1[1]+h1[3]:.2f} l", "S"]
    # Vertical stroke
    ops += [f"{v1[0]:.2f} {v1[1]:.2f} m", f"{v1[0]+v1[2]:.2f} {v1[1]+v1[3]:.2f} l", "S"]
    ops.append("Q")
    return ops


def _diamond(x: float, y: float, size: float, colour: str) -> list[str]:
    """A small centred diamond shape used as a decorative divider."""
    r, g, b = _hex_to_rgb(colour)
    half = size / 2
    return [
        "q",
        f"{r:.4f} {g:.4f} {b:.4f} rg",
        f"{x - half:.2f} {y:.2f} m",
        f"{x:.2f} {y + half:.2f} l",
        f"{x + half:.2f} {y:.2f} l",
        f"{x:.2f} {y - half:.2f} l",
        "h",  # close path
        "f",  # fill
        "Q",
    ]


def _verify_url(verification_code: str) -> str:
    """The public verification URL printed on the certificate face."""
    return f"{settings.frontend_url.rstrip('/')}/verify/{verification_code}"


def _build_certificate_content(
    page_width: float,
    page_height: float,
    *,
    learner_name: str,
    course_title: str,
    issued_at: str,
    verification_code: str,
) -> list[str]:
    """Build the PDF content-stream operators for the certificate.

    Kept as a pure function returning operator strings so a test can assert on the
    document's wording and structure without a storage backend - which is how the
    Section V.3.2 wording constraints are enforced.
    """
    lines: list[str] = []

    # Page background - the warm paper tone, not bare white.
    lines += _rect(0, 0, page_width, page_height, PAGE_BG)

    # -- Frame ---------------------------------------------------------------
    # A slim navy band for the brand, and a thin gold frame that holds the warm
    # paper on all four sides.
    band_h = 38.0
    lines += _rect(0, page_height - band_h, page_width, band_h, HEADER_BG)
    lines += _left_text(
        BRAND_NAME, x=MARGIN, y=page_height - 25, size=14, colour=HEADER_FG, bold=True,
    )

    frame_top = page_height - band_h - FRAME_INSET
    lines += _stroked_rect(
        FRAME_INSET,
        FRAME_INSET,
        page_width - 2 * FRAME_INSET,
        frame_top - FRAME_INSET,
        GOLD_STRONG,
        line_width=1.5,
    )

    # -- Corner ornaments ----------------------------------------------------
    # Four small L-shaped gold accents inside the frame corners for visual
    # refinement.
    ci = FRAME_INSET + 6  # ornament inset from frame edge
    cs = _CORNER_SIZE
    lines += _corner_ornament(ci, frame_top - ci, cs, GOLD_STRONG, rotate=0)       # top-left
    lines += _corner_ornament(page_width - ci, frame_top - ci, cs, GOLD_STRONG, rotate=90)  # top-right
    lines += _corner_ornament(page_width - ci, ci, cs, GOLD_STRONG, rotate=180)   # bottom-right
    lines += _corner_ornament(ci, ci, cs, GOLD_STRONG, rotate=270)                # bottom-left

    # -- Heading block -------------------------------------------------------
    # Vertical rhythm, top to bottom. Gaps are not uniform: they encode the
    # hierarchy.
    lines += _centred_text(
        CERTIFICATE_HEADING, y=page_height - 120, size=34, colour=INK, bold=True,
    )
    # A short gold rule under the heading.
    lines += _centred_rule(page_height - 142, 100, GOLD_STRONG, thickness=2)
    # A small diamond ornament below the rule for added elegance.
    lines += _diamond(PAGE_WIDTH / 2, page_height - 154, 8, GOLD_STRONG)

    # "This is to certify that"
    lines += _centred_text(
        ATTESTATION_LINES[0], y=page_height - 198, size=12, colour=MUTED_INK,
    )

    # -- Learner name, the hero element --------------------------------------
    # The widest thing on the page and the only string we do not control, so it
    # is measured and truncated against a real margin.
    name_max_width = page_width - 160
    lines += _centred_text(
        learner_name, y=page_height - 248, size=28, colour=INK, bold=True,
        max_width=name_max_width,
    )
    # A hairline under the name.
    lines += _centred_rule(page_height - 268, name_max_width, MUTED_INK, thickness=0.6)

    # "has completed the course" - deliberately not "is certified in".
    lines += _centred_text(
        ATTESTATION_LINES[1], y=page_height - 306, size=12, colour=MUTED_INK,
    )

    # Course title.
    lines += _centred_text(
        course_title, y=page_height - 340, size=20, colour=INK, bold=True,
        max_width=name_max_width,
    )

    # Small diamond divider before the date.
    lines += _diamond(PAGE_WIDTH / 2, page_height - 370, 5, GOLD_STRONG)

    # Issue date.
    lines += _centred_text(
        f"Issued {issued_at}", y=page_height - 394, size=11, colour=MUTED_INK,
    )

    # -- Signature block, left ----------------------------------------------
    # A typeset name over a rule. Not a facsimile signature: issuance is
    # automatic, so a handwritten mark would assert a personal review that never
    # happened.
    sig_x = float(MARGIN + 28)
    sig_w = 250.0
    foot_rule_y = 155.0
    lines += _rect(sig_x, foot_rule_y, sig_w, 1, MUTED_INK)
    lines += _left_text(SIGNATORY_NAME, x=sig_x, y=135, size=12, colour=INK, bold=True)
    lines += _left_text(SIGNATORY_ROLE, x=sig_x, y=120, size=8, colour=MUTED_INK)

    # -- Verification block, right ------------------------------------------
    ver_x = page_width - (MARGIN + 28) - sig_w
    lines += _rect(ver_x, foot_rule_y, sig_w, 1, MUTED_INK)
    lines += _left_text(
        f"Verification code: {verification_code}", x=ver_x, y=135, size=9,
        colour=INK, bold=True,
    )
    lines += _left_text(
        f"Verify at {_verify_url(verification_code)}", x=ver_x, y=120, size=8,
        colour=MUTED_INK,
    )

    # The scope disclaimer.
    lines += _centred_text(DISCLAIMER, y=42, size=8, colour=MUTED_INK)

    return lines


def render_certificate_pdf(certificate: Certificate) -> str:
    """Generate the certificate PDF and upload to storage.

    Returns the storage key. Composes a one-page A4 landscape document from the
    content stream built above.

    If generation or upload fails, the caller is responsible for handling -
    the caller (the download endpoint) catches exceptions and returns a 502.
    """
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    writer = PdfWriter()
    page = writer.add_blank_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)

    issued = certificate.issued_at
    issued_str = issued.strftime("%d %B %Y") if hasattr(issued, "strftime") else str(issued)

    lines = _build_certificate_content(
        PAGE_WIDTH,
        PAGE_HEIGHT,
        learner_name=certificate.learner_name_snapshot,
        course_title=certificate.course_title_snapshot,
        issued_at=issued_str,
        verification_code=certificate.verification_code,
    )

    content = DecodedStreamObject()
    # `_sanitise` has already forced every drawn string into latin-1's range, so
    # this encode cannot raise on a learner's accented name.
    content.set_data("\n".join(lines).encode("latin-1"))
    page[NameObject("/Contents")] = writer._add_object(content)

    # Standard PDF Type1 fonts - always present in a reader, nothing to embed.
    def _font(base: str) -> DictionaryObject:
        d = DictionaryObject()
        d[NameObject("/Type")] = NameObject("/Font")
        d[NameObject("/Subtype")] = NameObject("/Type1")
        d[NameObject("/BaseFont")] = NameObject(base)
        # WinAnsi so the latin-1 bytes above map to the glyphs they name.
        d[NameObject("/Encoding")] = NameObject("/WinAnsiEncoding")
        return d

    fonts = DictionaryObject()
    fonts[NameObject("/F1")] = writer._add_object(_font("/Helvetica"))
    fonts[NameObject("/FB")] = writer._add_object(_font("/Helvetica-Bold"))
    resources = DictionaryObject()
    resources[NameObject("/Font")] = fonts
    page[NameObject("/Resources")] = resources

    buf = BytesIO()
    writer.write(buf)
    pdf_bytes = buf.getvalue()

    key = _pdf_key(str(certificate.id))
    upload_file(key=key, body=pdf_bytes, content_type="application/pdf")
    certificate.pdf_storage_key = key
    return key


def get_certificate_pdf_url(certificate: Certificate) -> str:
    """Return a presigned URL for the certificate PDF.

    If the PDF hasn't been generated yet, generate it now (lazy rendering).
    If generation fails, raise - the caller returns 502.
    """
    # Bind the key returned by the renderer rather than re-reading the attribute:
    # `render_certificate_pdf` sets `pdf_storage_key` on the instance, but the type
    # of that column is `str | None`, so a re-read is only narrowable by asserting.
    # Taking the return value keeps the non-null guarantee at the call site.
    key = certificate.pdf_storage_key or render_certificate_pdf(certificate)

    return generate_presigned_url(key, expiry_seconds=3600)
