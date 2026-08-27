"""Render real preview images from the template files themselves.

Why this exists
---------------
Each paid template needs two preview images so a buyer can see the artefact before
paying. When `preview_image_keys` is `[]`, `PreviewGallery` never renders and the buy
page asks for money against a description alone.

What this does, and what it refuses to do
-----------------------------------------
A preview must be the actual artefact. Every pixel here comes from the real file in
Storage — it never draws a mock, never renders a logo card, never substitutes a stock
image. Where a format cannot be rendered at all, it writes nothing and says so: an
absent gallery is honest, and a fabricated one is an overclaim.

  PDF   → two *representative* pages rendered at ~110 DPI, JPEG, long edge ≤1400px
  XLSX  → the real opening screenful of the first visible sheet, composed in this
          platform's own table treatment (see `_sheet_preview.py` — the data is the
          artefact's, the styling is ours, and the alt text says so)
  other → skipped, reported, left empty. PPT/DOC would need a headless office suite,
          which is not a dependency worth taking for a preview image.

Why "representative" rather than "the first two"
------------------------------------------------
The naive rule produced bad previews on real files, verified by rendering them and
looking: `vendor-risk-assessment-template`'s page 2 is nothing but empty numbered rows,
and its page 3 is a third-party disclaimer. A preview of a blank page is worse than no
preview — it tells a buyer the artefact is empty. So page 1 is always kept (it is the
cover and carries the title), and the second slot goes to the densest remaining page
that is neither near-empty nor a disclaimer/boilerplate page. See `_pick_pages`.

`pypdfium2` (BSD-3/Apache-2.0, self-contained wheel — no system poppler) does the
rasterising. PyMuPDF was rejected despite being present in the environment: it is AGPL,
which is not a licence this commercial platform should take a dependency on.

Alt text is derived, not typed ("{title} — page {n} of {total}", and for a sheet, a
phrase that names the styling as ours). It describes what the image is, which is what a
screen-reader user needs from a preview thumbnail, and it cannot drift from the file the
way a hand-written caption can.

Usage (from backend/):
    python scripts/generate_template_previews.py            # report only, uploads nothing
    python scripts/generate_template_previews.py --apply    # render, upload, record
    python scripts/generate_template_previews.py --apply --force   # redo existing
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db.models import Template  # noqa: E402
from app.db.session import _asyncpg_url  # noqa: E402
from app.integrations.storage_client import download_file, upload_file  # noqa: E402

from _sheet_preview import render_sheet_previews  # noqa: E402

# Two pages is the honest maximum: more pages of a paid artefact given away free stops
# being a preview and starts being the product.
PREVIEW_PAGE_COUNT = 2

# ~110 DPI against a 72pt/inch page. Legible enough to judge the artefact on a retina
# thumbnail and in the lightbox, small enough that two of them do not become the heaviest
# thing on the buy page.
RENDER_SCALE = 110 / 72

# The long edge cap keeps a poster-sized page from arriving as a 4MB JPEG.
MAX_LONG_EDGE_PX = 1400
JPEG_QUALITY = 82


# A page with less text than this is treated as blank-ish — a grid of empty numbered
# rows extracts to a few dozen characters, and showing one as a "sample page" actively
# misleads. Measured against the real files: the emptiest page worth showing had ~750
# characters, the blank row-grid had 83.
MIN_REPRESENTATIVE_CHARS = 200

# Pages that are legal/boilerplate rather than the artefact. Matched case-insensitively
# against the page's own extracted text, and only when the marker dominates a short page
# — a document that merely *mentions* a disclaimer mid-body is not excluded.
BOILERPLATE_MARKERS = ("disclaimer", "terms of use", "copyright notice", "all rights reserved")
BOILERPLATE_MAX_CHARS = 1200


def _page_texts(blob: bytes) -> list[str]:
    """Extracted text per page, for choosing which pages to show. Failure returns an
    empty list, which makes `_pick_pages` fall back to sequential order."""
    try:
        from pypdf import PdfReader

        return [(p.extract_text() or "") for p in PdfReader(BytesIO(blob)).pages]
    except Exception:
        return []


def _is_boilerplate(text: str) -> bool:
    lowered = text.lower()
    return len(text.strip()) <= BOILERPLATE_MAX_CHARS and any(
        m in lowered for m in BOILERPLATE_MARKERS
    )


def _pick_pages(texts: list[str], total: int, limit: int) -> list[int]:
    """Zero-based indices of the pages worth showing.

    Page 1 is always first: it carries the title and is what a buyer expects a preview
    to open on. Remaining slots go to the densest pages that clear
    `MIN_REPRESENTATIVE_CHARS` and are not boilerplate, presented in document order so
    the gallery still reads front-to-back rather than as a "greatest hits" jumble.
    """
    if not texts:
        return list(range(min(limit, total)))

    first = [0] if total else []
    candidates = [
        i for i in range(1, total)
        if len(texts[i].strip()) >= MIN_REPRESENTATIVE_CHARS and not _is_boilerplate(texts[i])
    ]
    # Densest first to choose, then re-sorted into document order to present.
    candidates.sort(key=lambda i: len(texts[i].strip()), reverse=True)
    chosen = sorted(candidates[: max(0, limit - len(first))])

    if not chosen and total > 1:
        # Every other page is blank or boilerplate. One honest page beats a blank
        # second one, so the gallery gets a single image rather than a padded pair.
        return first
    return first + chosen


def render_pdf_previews(blob: bytes, limit: int = PREVIEW_PAGE_COUNT) -> list[tuple[bytes, int, int]]:
    """Representative pages as JPEG bytes. Returns (jpeg, page_number, total_pages)."""
    import pypdfium2 as pdfium
    from PIL import Image

    texts = _page_texts(blob)

    out: list[tuple[bytes, int, int]] = []
    pdf = pdfium.PdfDocument(blob)
    try:
        total = len(pdf)
        for index in _pick_pages(texts, total, limit):
            page = pdf[index]
            pil: Image.Image = page.render(scale=RENDER_SCALE).to_pil()

            if max(pil.size) > MAX_LONG_EDGE_PX:
                ratio = MAX_LONG_EDGE_PX / max(pil.size)
                pil = pil.resize(
                    (max(1, round(pil.width * ratio)), max(1, round(pil.height * ratio))),
                    Image.LANCZOS,
                )

            # Flatten onto white: a page with transparency would otherwise render its
            # background black once JPEG drops the alpha channel.
            if pil.mode in ("RGBA", "LA", "P"):
                pil = pil.convert("RGBA")
                flat = Image.new("RGB", pil.size, (255, 255, 255))
                flat.paste(pil, mask=pil.split()[-1])
                pil = flat
            elif pil.mode != "RGB":
                pil = pil.convert("RGB")

            buf = BytesIO()
            pil.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
            out.append((buf.getvalue(), index + 1, total))
    finally:
        pdf.close()
    return out


def _extension(file_name: str, storage_key: str) -> str:
    """Same recovery rule as derive_template_evidence.py — the upload path slugifies
    "foo.pdf" to "foo-pdf", so the name alone is not always enough."""
    name = (file_name or "").lower()
    if "." in name:
        return "." + name.rsplit(".", 1)[1]
    key = (storage_key or "").lower()
    if "." in key.rsplit("/", 1)[-1]:
        return "." + key.rsplit(".", 1)[1]
    for ext in (".pdf", ".xlsx", ".docx", ".pptx"):
        if key.endswith("-" + ext[1:]):
            return ext
    return ""


async def main(apply: bool, force: bool) -> int:
    engine = create_async_engine(_asyncpg_url(settings.database_url))
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    written = 0
    skipped: list[tuple[str, str]] = []

    async with Session() as session:
        templates = (
            await session.execute(
                select(Template).where(Template.published.is_(True)).order_by(Template.slug)
            )
        ).scalars().all()

        for t in templates:
            if t.preview_image_keys and not force:
                skipped.append((t.slug, "already has previews"))
                continue
            if not t.storage_key:
                skipped.append((t.slug, "no storage_key"))
                continue

            ext = _extension(t.file_name or "", t.storage_key)
            if ext not in (".pdf", ".xlsx", ".xlsm"):
                # Deliberate: a slide deck or a legacy binary doc needs a headless office
                # suite to rasterise, which is not a dependency worth taking for a
                # preview. Left empty, and the gallery correctly does not render.
                skipped.append((t.slug, "cannot render " + (ext or "unknown format") + " without a headless office suite"))
                continue

            blob = await asyncio.to_thread(download_file, t.storage_key)
            if blob is None:
                skipped.append((t.slug, "object missing from Storage"))
                continue

            keys: list[dict] = []
            sizes: list[int] = []

            if ext == ".pdf":
                try:
                    rendered = await asyncio.to_thread(render_pdf_previews, blob)
                except Exception as exc:  # noqa: BLE001 — a bad PDF is a skip, not a crash
                    skipped.append((t.slug, "render failed: " + type(exc).__name__))
                    continue
                if not rendered:
                    skipped.append((t.slug, "no pages rendered"))
                    continue
                for jpeg, page_no, total in rendered:
                    keys.append({
                        "key": "templates/" + str(t.id) + "/previews/page-" + str(page_no) + ".jpg",
                        "alt": t.title + " — page " + str(page_no) + " of " + str(total),
                    })
                    sizes.append(len(jpeg))
                blobs = [j for j, _, _ in rendered]
            else:
                try:
                    results = await asyncio.to_thread(render_sheet_previews, blob)
                except Exception as exc:  # noqa: BLE001
                    skipped.append((t.slug, "render failed: " + type(exc).__name__))
                    continue
                if not results:
                    # Nothing renderable at all. An absent gallery is the honest outcome.
                    skipped.append((t.slug, "no sheet could be previewed"))
                    continue
                blobs = []
                for index, (jpeg, sheet_name, _cols) in enumerate(results, start=1):
                    keys.append({
                        "key": "templates/" + str(t.id) + "/previews/sheet-" + str(index) + ".jpg",
                        # The alt text states the composition explicitly so a screen-reader
                        # user is never told this is the workbook's own visual design.
                        "alt": t.title + " — opening rows of the “" + sheet_name
                               + "” sheet, shown in this site's table styling",
                    })
                    sizes.append(len(jpeg))
                    blobs.append(jpeg)

            if apply:
                for entry, jpeg in zip(keys, blobs):
                    await asyncio.to_thread(
                        upload_file, key=entry["key"], body=jpeg, content_type="image/jpeg"
                    )

            print(
                t.slug + ": " + str(len(keys)) + " previews ("
                + ", ".join(str(round(s / 1024)) + "KB" for s in sizes) + ")"
            )

            if apply:
                t.preview_image_keys = keys
                written += 1

        if apply and written:
            await session.commit()

    await engine.dispose()

    print()
    if skipped:
        print("Skipped (gallery stays absent — honest, not empty):")
        for slug, why in skipped:
            print("  " + slug + ": " + why)
    print()
    if apply:
        print("Wrote previews for " + str(written) + " template(s).")
    else:
        print("Dry run — nothing uploaded or written. Re-run with --apply.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="render, upload and record")
    parser.add_argument("--force", action="store_true", help="regenerate even where previews exist")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(args.apply, args.force)))
