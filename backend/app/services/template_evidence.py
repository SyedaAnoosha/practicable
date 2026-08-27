"""Shared helpers for the evidence layer — turning a `Template` row into what a
public page is actually allowed to render.

Used by every public surface that shows a template's evidence: the template detail
page (`content/templates.py`), a domain pack's bundled template (`content/packs.py`),
and a single-template product's buy page (`commerce/products.py`). One place, so the
three pages can't silently drift from each other or from the receipt.
"""
from __future__ import annotations

from pydantic import BaseModel

from app.integrations.storage_client import generate_presigned_url

# Preview images are marketing content shown to a browsing visitor, not a gated
# download — a 60-second link (storage_client's default, tuned for a one-shot paid
# download) would go stale mid-session. An hour comfortably outlives any single visit,
# and unlike the sold file itself, there is no confidentiality reason to keep it short.
PREVIEW_URL_EXPIRY_SECONDS = 3600


class PreviewOut(BaseModel):
    """A single preview image, resolved for a public response. Never the raw Storage
    key — same rule as every other file this app serves (BACKEND.md §4.1): the key is
    an internal addressing detail, the URL is the only thing a browser is handed."""
    url: str
    alt: str


def resolve_previews(preview_images: list | None) -> list[PreviewOut]:
    """`template.preview_image_keys` holds `{"key": ..., "alt": ...}` objects (JSONB).
    Older rows — or a row touched before this field had a shape — may still hold bare
    key strings; tolerated here as an empty alt rather than a 500, since a template
    missing alt text is a content gap, not a crash.
    """
    out: list[PreviewOut] = []
    for item in preview_images or []:
        if isinstance(item, str):
            key, alt = item, ""
        else:
            key, alt = item.get("key", ""), item.get("alt", "")
        if not key:
            continue
        out.append(PreviewOut(url=generate_presigned_url(key, expiry_seconds=PREVIEW_URL_EXPIRY_SECONDS), alt=alt))
    return out


def format_line(file_name: str | None, file_count: int = 1) -> str | None:
    """`.xlsx · 1 file` — read off the real uploaded file's extension, never typed per
    product. None when there's no file yet, so the row simply doesn't render
    (EvidencePanel's absence rule) rather than showing a blank extension.
    """
    if not file_name or "." not in file_name:
        return None
    ext = file_name.rsplit(".", 1)[-1].lower()
    if not ext:
        return None
    plural = "file" if file_count == 1 else "files"
    return f".{ext} · {file_count} {plural}"
