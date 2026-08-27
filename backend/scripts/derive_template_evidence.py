"""Derive the pre-purchase evidence facts from the real template files.

Why this exists
---------------
EvidencePanel is built on an absence rule: a fact whose column is unset does not render.
When page_count, sheet_count and is_editable are NULL, the panel renders
format/version/licence and nothing about the artefact itself.

The facts are not editorial. They are properties of the file already sitting in Storage,
so this script measures them rather than asking anyone to type them:

  page_count    PDF page count (pypdf); slide count for PPTX
  sheet_count   XLSX worksheet count (openpyxl), visible sheets only
  is_editable   true for a source format the buyer can edit (xlsx/docx/pptx),
                false for PDF. Never guessed from a filename alone — the bytes are
                opened and must parse.
  has_macros    true only if the container actually holds a vbaProject.bin

Nothing here fabricates. If a file cannot be opened or a fact cannot be measured, the
column is left NULL and the row is reported as skipped — a blank row on the buy page is
honest; an invented one is the failure the absence rule was written against.

Usage (from backend/):
    python scripts/derive_template_evidence.py            # report only, writes nothing
    python scripts/derive_template_evidence.py --apply    # write the measured facts
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import zipfile
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db.models import Template  # noqa: E402
from app.db.session import _asyncpg_url  # noqa: E402
from app.integrations.storage_client import download_file  # noqa: E402

# Formats whose native form the buyer can edit. PDF is deliberately absent: a PDF is
# readable everywhere and editable nowhere without extra software, and claiming
# otherwise on a buy page is a small overclaim.
EDITABLE_EXTENSIONS = {".xlsx", ".xlsm", ".docx", ".pptx", ".ppt", ".xls", ".doc"}

# Office-version floors, by container generation. OOXML (the "x" formats) needs 2007+;
# the legacy binary formats open in anything still shipping. Stated as a floor, never
# as a recommendation.
OOXML_EXTENSIONS = {".xlsx", ".xlsm", ".docx", ".pptx"}
LEGACY_OFFICE_EXTENSIONS = {".xls", ".doc", ".ppt"}

OLE2_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def _extension(file_name: str, storage_key: str) -> str:
    """The file's real extension. Falls back to the storage key, whose suffix survives
    even where the upload path rewrote the name (".../...-risk-assessment-template-pdf")."""
    name = (file_name or "").lower()
    if "." in name:
        return "." + name.rsplit(".", 1)[1]
    key = (storage_key or "").lower()
    if "." in key.rsplit("/", 1)[-1]:
        return "." + key.rsplit(".", 1)[1]
    # The upload path slugifies "foo.pdf" to "foo-pdf"; recover that shape only, and
    # only for extensions we actually know how to open.
    for ext in (".pdf", ".xlsx", ".docx", ".pptx"):
        if key.endswith("-" + ext[1:]):
            return ext
    return ""


def _pdf_page_count(blob: bytes) -> int | None:
    try:
        from pypdf import PdfReader

        return len(PdfReader(BytesIO(blob)).pages) or None
    except Exception:
        return None


def _xlsx_sheet_count(blob: bytes) -> int | None:
    """Visible worksheets only — a hidden calculation sheet is not something the buyer
    gets to use, and counting it inflates the number on the page."""
    try:
        from openpyxl import load_workbook

        wb = load_workbook(BytesIO(blob), read_only=True, data_only=True)
        try:
            visible = [
                ws for ws in wb.worksheets
                if getattr(ws, "sheet_state", "visible") == "visible"
            ]
            return len(visible) or None
        finally:
            wb.close()
    except Exception:
        return None


def _pptx_slide_count(blob: bytes) -> int | None:
    """Slide count read straight from the OOXML container — no python-pptx dependency
    needed for a count, and the legacy binary .ppt simply has no such container, so it
    correctly returns None rather than a guess."""
    try:
        with zipfile.ZipFile(BytesIO(blob)) as z:
            slides = [
                n for n in z.namelist()
                if n.startswith("ppt/slides/slide") and n.endswith(".xml")
            ]
            return len(slides) or None
    except Exception:
        return None


def _has_macros(blob: bytes, ext: str) -> bool | None:
    """True only when the container actually holds a VBA project. has_macros is a safety
    property the publish guard refuses on, so it is measured, never assumed: an
    unreadable container returns None and leaves the existing value alone."""
    if ext in LEGACY_OFFICE_EXTENSIONS:
        # Legacy binary containers cannot be inspected this cheaply; leave untouched.
        return None
    try:
        with zipfile.ZipFile(BytesIO(blob)) as z:
            return any("vbaproject.bin" in n.lower() for n in z.namelist())
    except Exception:
        return None


def _parses(blob: bytes, ext: str) -> bool:
    """Did the bytes actually open as the format they claim to be? is_editable is only
    written when this is true — the claim is "you can open and edit this", and a file we
    could not open ourselves is not evidence for it."""
    if ext == ".pdf":
        return _pdf_page_count(blob) is not None
    if ext in (".xlsx", ".xlsm"):
        return _xlsx_sheet_count(blob) is not None
    if ext in OOXML_EXTENSIONS:
        try:
            with zipfile.ZipFile(BytesIO(blob)):
                return True
        except Exception:
            return False
    if ext in LEGACY_OFFICE_EXTENSIONS:
        return blob[:8] == OLE2_MAGIC
    return False


def measure(blob: bytes, ext: str) -> dict:
    """Everything measurable about these bytes. Keys absent from the result were not
    measurable and must not be written."""
    out: dict = {}

    if ext == ".pdf":
        pages = _pdf_page_count(blob)
        if pages:
            out["page_count"] = pages
    elif ext in (".xlsx", ".xlsm"):
        sheets = _xlsx_sheet_count(blob)
        if sheets:
            out["sheet_count"] = sheets
    elif ext in (".pptx", ".ppt"):
        slides = _pptx_slide_count(blob)
        if slides:
            out["page_count"] = slides

    if _parses(blob, ext):
        out["is_editable"] = ext in EDITABLE_EXTENSIONS
        if ext in OOXML_EXTENSIONS:
            out["min_office_version"] = "Microsoft Office 2007 or later"
        elif ext in LEGACY_OFFICE_EXTENSIONS:
            out["min_office_version"] = "Microsoft Office 97 or later"

    macros = _has_macros(blob, ext)
    if macros is not None:
        out["has_macros"] = macros

    return out


async def main(apply: bool) -> int:
    engine = create_async_engine(_asyncpg_url(settings.database_url))
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    written = 0
    skipped: list[tuple[str, str]] = []

    async with Session() as session:
        templates = (
            await session.execute(select(Template).order_by(Template.slug))
        ).scalars().all()

        for t in templates:
            if not t.storage_key:
                skipped.append((t.slug, "no storage_key"))
                continue

            ext = _extension(t.file_name or "", t.storage_key)
            if not ext:
                skipped.append((t.slug, "extension not determinable"))
                continue

            blob = await asyncio.to_thread(download_file, t.storage_key)
            if blob is None:
                skipped.append((t.slug, "object missing from Storage"))
                continue

            facts = measure(blob, ext)
            if not facts:
                skipped.append((t.slug, "nothing measurable from " + ext))
                continue

            # Only fill what is unset. A human-entered value outranks a measured one:
            # someone who typed a page count knew something the file did not say.
            changes = {}
            for field, value in facts.items():
                current = getattr(t, field)
                if field == "has_macros":
                    # Non-nullable with a False default, so "unset" is indistinguishable
                    # from "deliberately false". Only ever raise it, never lower it.
                    if value and not current:
                        changes[field] = value
                elif current is None:
                    changes[field] = value

            if not changes:
                skipped.append((t.slug, "already populated"))
                continue

            print(t.slug + " (" + ext + "): " + repr(changes))
            if apply:
                for field, value in changes.items():
                    setattr(t, field, value)
                written += 1

        if apply and written:
            await session.commit()

    await engine.dispose()

    print()
    if skipped:
        print("Skipped (left NULL deliberately — a blank row is honest):")
        for slug, why in skipped:
            print("  " + slug + ": " + why)
    print()
    if apply:
        print("Wrote evidence for " + str(written) + " template(s).")
    else:
        print("Dry run — nothing written. Re-run with --apply.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write the measured facts")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(args.apply)))
