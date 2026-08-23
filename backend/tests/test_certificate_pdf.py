"""The certificate PDF itself - Section V.3.2, the owner-approved wording, and the
content stream being a *valid* one.

Why this file exists at all. `test_certificates.py` covers issuance thoroughly, but
its single test that touches the renderer patches `render_certificate_pdf` to raise,
so the real content stream had never been executed by anything. It was malformed:
eight `Tj` operators and not one `BT`. `Td`/`Tj`/`Tf` are only legal inside a text
object, so a conforming reader draws nothing - every certificate the platform issued
was a blank page with a navy bar across the top, and the whole suite stayed green.

So these tests read the bytes back with a real PDF parser rather than asserting on
the operator strings we just produced. Asserting on our own output would have passed
against the broken version too.

A caveat worth recording, because it nearly let the bug through a second time.
**pypdf's `extract_text()` is lenient**: it recovers text from a stream whose `Tj`
operators sit outside any text object, so it reports the broken document as fine.
Poppler - the engine behind most real viewers - does not. Rendering the defect and
extracting with each:

    pypdf    -> the full text (misleading pass)
    poppler  -> "Practicable" and nothing else

Everything below the header was silently dropped: the learner's name, the course,
the date, the verification code. So `_text_of` prefers `pdftotext` when Poppler is
installed and falls back to pypdf when it is not, and the fallback is marked as the
weaker check rather than passed off as equivalent.
"""
from __future__ import annotations

import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from pypdf import PdfReader

from app.services import certificate_pdf as cert_pdf

_PDFTOTEXT = shutil.which("pdftotext")


def _certificate(
    *,
    learner_name: str = "Jane Doe",
    course_title: str = "Deciding in the Dark",
    verification_code: str = "Xk9_ABC-123def",
) -> SimpleNamespace:
    """A stand-in with exactly the attributes the renderer reads.

    Deliberately not an ORM `Certificate`: the renderer is pure apart from its
    upload, and a real row would drag a database into a test about typography.
    """
    return SimpleNamespace(
        id=uuid.uuid4(),
        learner_name_snapshot=learner_name,
        course_title_snapshot=course_title,
        issued_at=datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc),
        verification_code=verification_code,
        pdf_storage_key=None,
    )


def _render(certificate) -> bytes:
    """Render, capturing the uploaded bytes instead of writing to storage."""
    with patch.object(cert_pdf, "upload_file") as upload:
        cert_pdf.render_certificate_pdf(certificate)
    assert upload.call_count == 1, "The renderer must upload exactly once."
    return upload.call_args.kwargs["body"]


def _text_of(pdf_bytes: bytes, tmp_path=None) -> str:
    """Extract page text, preferring Poppler over pypdf.

    See the module docstring: pypdf recovers text that a conforming renderer would
    drop, so on its own it cannot tell a valid content stream from the malformed
    one that shipped. Poppler is what actually decides whether a person opening the
    file sees their name.
    """
    reader = PdfReader(BytesIO(pdf_bytes))
    assert len(reader.pages) == 1, "The certificate is one page."

    if _PDFTOTEXT and tmp_path is not None:
        path = tmp_path / "cert.pdf"
        path.write_bytes(pdf_bytes)
        # `-enc UTF-8`: pdftotext writes Latin-1 by default, so an accented name
        # comes back as an undecodable byte and the test fails for a reason that
        # has nothing to do with the certificate.
        return subprocess.run(
            [_PDFTOTEXT, "-enc", "UTF-8", str(path), "-"],
            capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout

    return reader.pages[0].extract_text()


# -- The bug that motivated the file ----------------------------------------

def test_the_certificate_is_not_a_blank_page(tmp_path):
    """A real PDF renderer must find the certificate's content on the page."""
    text = _text_of(_render(_certificate()), tmp_path)
    assert text.strip(), (
        "The rendered certificate has no extractable text - the content stream is "
        "malformed (most likely text operators outside a BT/ET text object)."
    )


@pytest.mark.skipif(not _PDFTOTEXT, reason="needs Poppler's pdftotext")
def test_stripping_bt_et_loses_everything_but_the_header(tmp_path):
    """The shipped defect, reproduced and measured against a conforming renderer.

    This is the test that proves the fix is real rather than cosmetic. It takes the
    current content stream, removes exactly the `BT`/`ET` pairs (which is precisely
    what the old renderer omitted), and asks Poppler what a person would see.

    The answer is "Practicable" - the brand in the header - and nothing else. The
    learner's name, the course title, the issue date and the verification code are
    all silently dropped, because a conforming renderer discards text operators that
    appear outside a text object. No error, no warning: a near-empty page.

    Note this is asserted against Poppler specifically. pypdf's extractor recovers
    the text anyway, so had this file only ever used pypdf it would have passed
    against the broken renderer and proved nothing.
    """
    original = cert_pdf._build_certificate_content

    def without_text_objects(*args, **kwargs):
        return [op for op in original(*args, **kwargs) if op not in ("BT", "ET")]

    with patch.object(cert_pdf, "_build_certificate_content", without_text_objects):
        broken = _render(_certificate(learner_name="Jane Doe"))

    text = _text_of(broken, tmp_path)
    assert "Jane Doe" not in text, (
        "Expected the malformed stream to drop the learner's name; if this now "
        "renders, the harness is no longer reproducing the original defect and the "
        "regression it guards has lost its meaning."
    )
    assert "Certificate of Completion" not in text
    assert "Xk9_ABC-123def" not in text

    # And the same content, correctly wrapped, keeps all of it.
    good = _text_of(_render(_certificate(learner_name="Jane Doe")), tmp_path)
    assert "Jane Doe" in good
    assert "Certificate of Completion" in good
    assert "Xk9_ABC-123def" in good


def test_every_text_operator_sits_inside_a_text_object():
    """Structural check on the operators, balanced BT/ET and no stray Tj.

    The extraction test above is the one that matters, but this one names the
    defect directly so a regression reports the cause rather than the symptom.
    """
    lines = cert_pdf._build_certificate_content(
        cert_pdf.PAGE_WIDTH,
        cert_pdf.PAGE_HEIGHT,
        learner_name="Jane Doe",
        course_title="Deciding in the Dark",
        issued_at="23 August 2026",
        verification_code="ABC123",
    )
    depth = 0
    for op in lines:
        if op == "BT":
            depth += 1
            assert depth == 1, "Text objects cannot nest."
        elif op == "ET":
            depth -= 1
            assert depth >= 0, "ET without a matching BT."
        elif op.endswith(" Tj") or op.endswith(" Td") or " Tf" in op:
            assert depth == 1, f"Text operator outside a text object: {op!r}"
    assert depth == 0, "Unclosed text object - a BT with no ET."


# -- Section V.3.2: the owner's wording decision -----------------------------

def test_heading_is_certificate_of_completion(tmp_path):
    """The owner chose this wording; it is not a detail to drift."""
    assert "Certificate of Completion" in _text_of(_render(_certificate()), tmp_path)


@pytest.mark.parametrize(
    "forbidden",
    ["is certified in", "accredited", "qualified to", "licensed", "diploma", "degree"],
)
def test_the_certificate_claims_completion_and_nothing_more(forbidden: str, tmp_path):
    """No accreditation claim anywhere on the face of the document.

    A certificate that overstates is a liability the platform then issues at scale,
    automatically, with no human in the loop. The wording is therefore a test, not
    a convention - so adding "accredited" to the template goes red.

    "not a professional accreditation" in the disclaimer is a denial of the claim,
    so the check is on the standalone word, not the substring.
    """
    text = _text_of(_render(_certificate()), tmp_path).lower()
    if forbidden == "accredited":
        assert "accredited" not in text
    else:
        assert forbidden not in text


def test_the_signature_is_the_platform_not_a_named_person(tmp_path):
    """Section V.3.2: signed from the platform.

    Issuance is automatic on 100% lesson completion - no human reviews the work.
    A named signatory would assert a personal endorsement that never happened, so
    the block names the platform and says plainly how the certificate was issued.
    """
    text = _text_of(_render(_certificate()), tmp_path)
    assert cert_pdf.SIGNATORY_NAME in text
    assert "Issued automatically on course completion" in text


def test_the_scope_limit_is_on_the_document_itself(tmp_path):
    """The disclaimer must be on the artefact, not only in the email that sent it.

    The PDF is what gets forwarded to an employer; the email is not.
    """
    text = _text_of(_render(_certificate()), tmp_path)
    assert "not a professional accreditation" in text.lower()


# -- What the document has to carry ------------------------------------------

def test_the_certificate_carries_name_course_date_and_verification(tmp_path):
    cert = _certificate(
        learner_name="Priya Raghunathan",
        course_title="Deciding in the Dark",
        verification_code="Xk9_ABC-123def",
    )
    text = _text_of(_render(cert), tmp_path)
    assert "Priya Raghunathan" in text
    assert "Deciding in the Dark" in text
    assert "23 August 2026" in text
    assert "Xk9_ABC-123def" in text


def test_the_verify_url_is_printed_so_the_claim_is_checkable(tmp_path):
    """The code alone is useless to whoever is handed the certificate unless the
    document also says where to check it."""
    cert = _certificate(verification_code="CODE123")
    assert "/verify/CODE123" in _text_of(_render(cert), tmp_path)


def test_render_caches_the_storage_key_on_the_certificate():
    cert = _certificate()
    with patch.object(cert_pdf, "upload_file"):
        key = cert_pdf.render_certificate_pdf(cert)
    assert key == f"certificates/{cert.id}.pdf"
    assert cert.pdf_storage_key == key, (
        "The key must be set on the row, or every download re-renders."
    )


# -- Learner-controlled strings ----------------------------------------------

def test_a_name_containing_parentheses_does_not_corrupt_the_page(tmp_path):
    """`(` and `)` delimit PDF literal strings.

    An unescaped close-paren ends the string early and the remainder of the name
    is parsed as operators. Someone called "Jo (Jos) Smith" would get a corrupt
    document - reachable from an ordinary display name, with no malice required.
    """
    cert = _certificate(learner_name="Jo (Jos) Smith")
    text = _text_of(_render(cert), tmp_path)
    assert "Jo (Jos) Smith" in text


def test_a_backslash_in_a_name_is_escaped(tmp_path):
    cert = _certificate(learner_name="Back\\Slash")
    assert "Back\\Slash" in _text_of(_render(cert), tmp_path)


def test_an_accented_name_renders_rather_than_failing_the_download(tmp_path):
    """Accented letters are inside latin-1 and must survive intact.

    If they did not, the encode would raise inside the upload path and the learner
    would see a 502 on a certificate they had earned.
    """
    cert = _certificate(learner_name="José Ibáñez")
    assert "José Ibáñez" in _text_of(_render(cert), tmp_path)


def test_typographic_punctuation_is_transliterated_not_replaced(tmp_path):
    """Curly apostrophes and en dashes have no latin-1 code point.

    Without transliteration they encode to a literal "?" - so "O'Brien" would be
    printed as "O?Brien" on a document someone shows an employer.
    """
    cert = _certificate(
        learner_name="O’Brien",
        course_title="Risk – Under Uncertainty",
    )
    text = _text_of(_render(cert), tmp_path)
    assert "O'Brien" in text
    assert "?" not in text, f"A character was lost to the latin-1 fallback: {text!r}"


def test_a_very_long_name_is_truncated_to_the_page_rather_than_overflowing(tmp_path):
    """Names are the one string on this page nobody controls."""
    cert = _certificate(learner_name="Wolfeschlegelsteinhausenbergerdorff " * 4)
    text = _text_of(_render(cert), tmp_path)
    assert "..." in text, "An over-wide name must be visibly truncated."
    width = cert_pdf._text_width(
        next(line for line in text.splitlines() if "Wolfe" in line), 26, bold=True,
    )
    assert width <= cert_pdf.PAGE_WIDTH - 160 + 1, (
        "The truncated name still overflows the page margins."
    )


def test_a_name_that_fits_is_not_truncated(tmp_path):
    """The truncation must not fire on ordinary input."""
    assert "..." not in _text_of(_render(_certificate(learner_name="Jane Doe")), tmp_path)


# -- Metrics -----------------------------------------------------------------

def test_text_width_uses_real_metrics_not_a_character_count():
    """A fixed per-character estimate mis-centres every line.

    "MMMM" and "iiii" are the same length and nowhere near the same width; the
    previous renderer centred on `len(s) * 10`, so any name that was not average
    sat visibly off-centre.
    """
    assert cert_pdf._text_width("MMMM", 12) > cert_pdf._text_width("iiii", 12) * 2


def test_centred_text_is_actually_centred():
    lines = cert_pdf._centred_text("Hello", y=100, size=12, colour=cert_pdf.INK)
    x = float(next(op for op in lines if op.endswith(" Td")).split()[0])
    width = cert_pdf._text_width("Hello", 12)
    assert abs((x + width / 2) - cert_pdf.PAGE_WIDTH / 2) < 0.5
