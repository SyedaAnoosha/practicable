"""Admin CRUD for templates, including the downloadable file upload."""
import asyncio
import uuid
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.core.publish_guard import check_has_macros, check_preview_images
from app.db.models import Author, Section, Template, User, Product, ProductContent
from app.db.session import get_session
from app.integrations.storage_client import delete_file, generate_presigned_upload_url, head_object, upload_file
from app.services.template_evidence import format_line, resolve_previews

from .common import PublishStateIn, apply_publish_state_or_422, ensure_unique_slug, get_or_404, record_audit, slugify

router = APIRouter()

# Templates are documents, not video. Uploads are buffered in memory, so this bound is
# what keeps that safe.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

# An allow-list rather than a deny-list: this bucket serves files to paying customers.
ALLOWED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
    "application/vnd.ms-excel",  # .xls
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/msword",  # .doc
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
    "application/vnd.ms-powerpoint",  # .ppt
    "application/pdf",
    "text/csv",
    "application/zip",
}

# week4_plan.md W4-R1 / Phase 2 step 1: PreviewGallery needs real document-page images,
# not the document format itself — a distinct, much smaller allow-list from the file
# upload above. Capped well under MAX_UPLOAD_BYTES; a "preview" is one rendered page.
ALLOWED_PREVIEW_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_PREVIEW_UPLOAD_BYTES = 8 * 1024 * 1024


class PreviewImageOut(BaseModel):
    """One admin-facing preview row: the raw key (so the admin UI can issue a remove
    call against it) plus a resolved URL to actually render the thumbnail, and its
    alt text. Never sent to a public endpoint — see `template_evidence.PreviewOut`,
    which strips the key."""
    storage_key: str
    url: str
    alt: str


class TemplateWriteIn(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1)
    # Defaults to False so a template is never given away by omitting a field.
    is_free: bool = False
    # ── W4-R1: evidence fields (optional on create/update, validated at publish) ─
    page_count: Optional[int] = None
    sheet_count: Optional[int] = None
    is_editable: Optional[bool] = None
    has_macros: bool = False
    min_office_version: Optional[str] = None
    version: Optional[str] = None
    last_reviewed_at: Optional[datetime] = None


class TemplateOut(BaseModel):
    id: str
    slug: str
    title: str
    description: str
    file_name: str
    file_size_bytes: int
    mime_type: str
    published: bool
    publish_state: str
    is_free: bool
    # False until a file has been uploaded; the editor uses it to block publishing, which
    # would otherwise put a buyable product on the site whose download 404s after payment.
    has_file: bool
    # ── W4-R1: evidence fields ────────────────────────────────────────────────────
    page_count: Optional[int] = None
    sheet_count: Optional[int] = None
    is_editable: Optional[bool] = None
    has_macros: bool = False
    min_office_version: Optional[str] = None
    preview_images: List[PreviewImageOut] = Field(default_factory=list)
    version: Optional[str] = None
    last_reviewed_at: Optional[datetime] = None
    format: Optional[str] = None
    # Phase 8 (8A-6): server-derived readiness, same states a bare ProductOut would
    # carry — None/no_product for a free template, which has no product at all.
    readiness: Literal["no_product", "price_unset", "stripe_price_unresolved", "unpublished", "ready"]
    readiness_message: str
    product_id: Optional[str] = None
    # Phase 8 (8B-7): the price-change confirmation step needs the *current* price to
    # compute the ±50%/zero delta — it cannot be inferred client-side without this.
    price_amount: Optional[int] = None
    currency: Optional[str] = None


async def _standalone_template_product(session: AsyncSession, template_id: uuid.UUID) -> Optional[Product]:
    """The template's own standalone product — created via this file's own
    create-product endpoint — as distinct from a pack (admin/packs.py) that merely
    includes the template alongside a question_set. A template can be referenced by
    both kinds of ProductContent row at once; this picks the standalone one
    specifically, the only one this file's readiness/price display concerns itself
    with. See the 2026-08-21 comment at this function's call site for how the
    MultipleResultsFound crash this replaces was found.
    """
    # Products that carry a question_set content row are packs, never standalone
    # template products — excluding them up front is what makes the remaining
    # ProductContent row (if any) safe to fetch with scalar_one_or_none().
    pack_product_ids = select(ProductContent.product_id).where(
        ProductContent.content_type == "question_set"
    )
    product_content = (
        await session.execute(
            select(ProductContent).where(
                ProductContent.content_type == "template",
                ProductContent.content_id == template_id,
                ProductContent.product_id.not_in(pack_product_ids),
            )
        )
    ).scalar_one_or_none()
    if product_content is None:
        return None
    return (
        await session.execute(select(Product).where(Product.id == product_content.product_id))
    ).scalar_one_or_none()


async def _to_out(t: Template, session: AsyncSession) -> TemplateOut:
    previews = []
    for item in t.preview_image_keys or []:
        key = item if isinstance(item, str) else item.get("key", "")
        alt = "" if isinstance(item, str) else item.get("alt", "")
        if not key:
            continue
        previews.append(PreviewImageOut(storage_key=key, url=resolve_previews([{"key": key, "alt": alt}])[0].url, alt=alt))

    # Phase 8 (8A-6): resolve the template's linked product (None until "Make
    # purchasable" has been called, and always None for a free template) and
    # derive readiness from it — same helper courses use, so the two agree.
    from app.core.publish_guard import compute_readiness

    # Found 2026-08-21 (Phase 9A re-verification): a template can legitimately be
    # referenced by TWO ProductContent rows now — its own standalone product (this
    # endpoint's create-product) AND a pack that includes it (POST /admin/packs) —
    # `scalar_one_or_none()` here crashed with MultipleResultsFound the moment a
    # template was in a pack, 500ing the whole list. This is the standalone
    # template's own product specifically: the one ProductContent row whose product
    # has no sibling question_set row (a pack's product always has one; a standalone
    # template product never does).
    product = await _standalone_template_product(session, t.id)
    readiness_result = compute_readiness(product)

    return TemplateOut(
        id=str(t.id), slug=t.slug, title=t.title, description=t.description,
        file_name=t.file_name, file_size_bytes=t.file_size_bytes,
        mime_type=t.mime_type, published=t.published, publish_state=t.publish_state.value, is_free=t.is_free,
        has_file=bool(t.storage_key),
        page_count=t.page_count, sheet_count=t.sheet_count, is_editable=t.is_editable,
        has_macros=t.has_macros, min_office_version=t.min_office_version,
        preview_images=previews,
        version=t.version,
        last_reviewed_at=t.last_reviewed_at,
        format=format_line(t.file_name) if t.storage_key else None,
        readiness=readiness_result.state,
        readiness_message=readiness_result.message,
        product_id=str(product.id) if product else None,
        price_amount=product.price_amount if product else None,
        currency=product.currency if product else None,
    )


@router.get("/admin/templates", response_model=list[TemplateOut])
async def list_templates(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(select(Template).order_by(Template.title))).scalars().all()
    return [await _to_out(t, session) for t in rows]


@router.get("/admin/templates/{template_id}", response_model=TemplateOut)
async def get_template(template_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    return await _to_out(await get_or_404(session, Template, template_id, "Template"), session)


@router.post("/admin/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Creates the row only. The file arrives via the upload endpoint below, so that
    editing wording and replacing the customer-facing artefact stay separate actions."""
    # section_id/author_id are NOT NULL but aren't an editorial concern — there is one of
    # each, and asking an editor to pick would expose a schema detail as a form field.
    section_id = (await session.execute(select(Section.id).limit(1))).scalar_one_or_none()
    author_id = (await session.execute(select(Author.id).limit(1))).scalar_one_or_none()
    if section_id is None or author_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "missing_prerequisites",
                    "message": "A section and an author must exist before templates can be created.",
                }
            },
        )

    template = Template(
        slug=await ensure_unique_slug(session, Template, slugify(payload.title)),
        title=payload.title,
        description=payload.description,
        section_id=section_id,
        author_id=author_id,
        storage_key="",
        file_name="",
        file_size_bytes=0,
        mime_type="",
        published=False,
        is_free=payload.is_free,
    )
    session.add(template)
    await session.flush()
    await record_audit(
        session, actor=admin, action="create_template", target_type="template",
        target_id=template.id, context={"title": template.title},
    )
    await session.commit()
    return await _to_out(template, session)


@router.put("/admin/templates/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: uuid.UUID,
    payload: TemplateWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    template = await get_or_404(session, Template, template_id, "Template")
    template.title = payload.title
    template.description = payload.description
    template.is_free = payload.is_free
    # Slug is not regenerated on retitle, so shared URLs keep working.
    # ── W4-R1 evidence fields ──────────────────────────────────────────────────
    template.page_count = payload.page_count
    template.sheet_count = payload.sheet_count
    template.is_editable = payload.is_editable
    template.has_macros = payload.has_macros
    template.min_office_version = payload.min_office_version
    # preview_image_keys is NOT touched here — it's managed by the dedicated
    # upload/confirm and remove-preview endpoints below, each of which needs to also
    # act on Storage (write or delete an object), which a bare field assignment on this
    # general-purpose PUT can't do safely.
    if payload.version is not None:
        template.version = payload.version
    template.last_reviewed_at = payload.last_reviewed_at
    await record_audit(
        session, actor=admin, action="update_template", target_type="template",
        target_id=template.id, context={"title": template.title, "is_free": template.is_free},
    )
    await session.commit()
    return await _to_out(template, session)


@router.post("/admin/templates/{template_id}/file", response_model=TemplateOut)
async def upload_template_file(
    template_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Upload or replace the downloadable artefact. Bytes are buffered in memory (bounded
    by MAX_UPLOAD_BYTES) and written in a thread, since boto3 would block the event loop."""
    template = await get_or_404(session, Template, template_id, "Template")

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "empty_file", "message": "That file is empty."}},
        )
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": {
                    "code": "file_too_large",
                    "message": f"Files must be under {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
                }
            },
        )
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "error": {
                    "code": "unsupported_type",
                    "message": f"{content_type} isn't an accepted template format.",
                }
            },
        )

    # The template id lets two templates share a filename; the uuid4 means a replacement
    # writes a new object rather than swapping bytes under an already-presigned download
    # link. The old object is deleted after the row points at the new one.
    previous_key = template.storage_key
    safe_name = slugify(file.filename or "template") or "template"
    new_key = f"templates/{template.id}/{uuid.uuid4().hex}-{safe_name}"

    await asyncio.to_thread(upload_file, key=new_key, body=content, content_type=content_type)

    template.storage_key = new_key
    template.file_name = file.filename or safe_name
    template.file_size_bytes = len(content)
    template.mime_type = content_type
    await record_audit(
        session, actor=admin, action="upload_template_file", target_type="template",
        target_id=template.id,
        context={"file_name": template.file_name, "bytes": len(content), "replaced": bool(previous_key)},
    )
    await session.commit()

    if previous_key and previous_key != new_key:
        # Best-effort: the row is already committed. An orphaned object beats failing a
        # request whose upload succeeded.
        try:
            await asyncio.to_thread(delete_file, previous_key)
        except Exception:  # noqa: BLE001 — deliberately swallowed, see above
            pass

    return await _to_out(template, session)


class UploadUrlIn(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str
    file_size_bytes: int = Field(gt=0)
    # week4_plan.md Phase 2 step 1: the presigned path serves two different things —
    # the sold document itself, and a rendered preview page of it for PreviewGallery.
    # Same mechanism, different validation and a different write target on confirm.
    kind: Literal["file", "preview"] = "file"


class UploadUrlOut(BaseModel):
    upload_url: str
    storage_key: str
    expires_in: int


@router.post("/admin/templates/{template_id}/upload-url", response_model=UploadUrlOut)
async def create_template_upload_url(
    template_id: uuid.UUID,
    payload: UploadUrlIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """week3_plan.md Phase 5 step 2 — a presigned Storage PUT url the browser writes
    directly to, so a large template pack no longer has to be buffered in memory and
    proxied through this API. Type and size are validated here, BEFORE a URL is even
    issued — stated to the editor before a file is chosen, not discovered after a
    failed upload (§20.4). `upload_template_file` above still exists for anything that
    calls it directly; this is the path `UploadField` uses.

    `kind='preview'` (week4_plan.md W4-R1) is the same presigned mechanism against the
    same bucket, validated as an image rather than a document, and written into
    `preview_image_keys` rather than replacing the sold file — see `confirm_template_
    upload` below.
    """
    await get_or_404(session, Template, template_id, "Template")  # 404s a bad id early

    is_preview = payload.kind == "preview"
    allowed_types = ALLOWED_PREVIEW_MIME_TYPES if is_preview else ALLOWED_MIME_TYPES
    max_bytes = MAX_PREVIEW_UPLOAD_BYTES if is_preview else MAX_UPLOAD_BYTES

    if payload.content_type not in allowed_types:
        kind_label = "preview image" if is_preview else "template"
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"error": {"code": "unsupported_type", "message": f"{payload.content_type} isn't an accepted {kind_label} format."}},
        )
    if payload.file_size_bytes > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"error": {"code": "file_too_large", "message": f"That file is {payload.file_size_bytes / (1024 * 1024):.0f}MB. The ceiling is {max_bytes // (1024 * 1024)}MB."}},
        )

    safe_name = slugify(payload.file_name) or "template"
    prefix = f"templates/{template_id}/previews" if is_preview else f"templates/{template_id}"
    storage_key = f"{prefix}/{uuid.uuid4().hex}-{safe_name}"
    expiry_seconds = 300
    upload_url = generate_presigned_upload_url(key=storage_key, content_type=payload.content_type, expiry_seconds=expiry_seconds)
    return UploadUrlOut(upload_url=upload_url, storage_key=storage_key, expires_in=expiry_seconds)


class UploadConfirmIn(BaseModel):
    storage_key: str
    file_name: str = Field(min_length=1, max_length=255)
    kind: Literal["file", "preview"] = "file"
    # Required for kind='preview' only (validated below, not via a bare Field(...),
    # since kind='file' never supplies or needs one). §20.2: "alt text is a
    # requirement, not a nicety" — enforced here, not left to the admin's memory.
    alt: Optional[str] = Field(default=None, max_length=300)


@router.post("/admin/templates/{template_id}/upload-url/confirm", response_model=TemplateOut)
async def confirm_template_upload(
    template_id: uuid.UUID,
    payload: UploadConfirmIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Called once the browser's direct PUT to `storage_key` has completed. Verifies
    the object actually landed via a real `HEAD` against Storage — server-verified
    size/type, never the client's own say-so — then updates the row exactly as
    `upload_template_file` does, including deleting the superseded object.

    `kind='preview'` skips all of that replace-and-delete behaviour: it appends the
    confirmed key to `preview_image_keys` instead of touching the sold file at all,
    since a template can (and per W4-R1 must, to publish paid) carry more than one.
    """
    template = await get_or_404(session, Template, template_id, "Template")

    is_preview = payload.kind == "preview"
    max_bytes = MAX_PREVIEW_UPLOAD_BYTES if is_preview else MAX_UPLOAD_BYTES

    if is_preview and not (payload.alt and payload.alt.strip()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "alt_text_required",
                    "message": "Describe what this page shows (e.g. \"Page 3: the weighted-criteria table\") — a buyer decides on this image, so it needs real alt text.",
                }
            },
        )

    meta = await asyncio.to_thread(head_object, payload.storage_key)
    if meta is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "upload_not_found", "message": "That upload hasn't landed in storage yet — try again in a moment."}},
        )
    content_length = meta.get("content_length") or 0
    if content_length > max_bytes:
        await asyncio.to_thread(delete_file, payload.storage_key)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"error": {"code": "file_too_large", "message": f"That file is {content_length / (1024 * 1024):.0f}MB. The ceiling is {max_bytes // (1024 * 1024)}MB."}},
        )

    if is_preview:
        alt_text = (payload.alt or "").strip()
        existing = list(template.preview_image_keys or [])
        existing.append({"key": payload.storage_key, "alt": alt_text})
        template.preview_image_keys = existing
        await record_audit(
            session, actor=admin, action="upload_template_preview", target_type="template",
            target_id=template.id,
            context={"file_name": payload.file_name, "bytes": content_length, "via": "presigned", "count": len(existing)},
        )
        await session.commit()
        return await _to_out(template, session)

    previous_key = template.storage_key
    template.storage_key = payload.storage_key
    template.file_name = payload.file_name
    template.file_size_bytes = content_length
    template.mime_type = meta.get("content_type") or template.mime_type or "application/octet-stream"
    await record_audit(
        session, actor=admin, action="upload_template_file", target_type="template",
        target_id=template.id,
        context={"file_name": template.file_name, "bytes": content_length, "replaced": bool(previous_key), "via": "presigned"},
    )
    await session.commit()

    if previous_key and previous_key != payload.storage_key:
        try:
            await asyncio.to_thread(delete_file, previous_key)
        except Exception:  # noqa: BLE001 — best-effort, row is already committed
            pass

    return await _to_out(template, session)


class RemovePreviewIn(BaseModel):
    storage_key: str


@router.post("/admin/templates/{template_id}/preview/remove", response_model=TemplateOut)
async def remove_template_preview(
    template_id: uuid.UUID,
    payload: RemovePreviewIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """The other half of the `kind='preview'` upload path — a wrong page, a bad crop, or
    a scorecard that's since changed needs a way back out, not just a way in. Removes
    the row from `preview_image_keys` and deletes the Storage object; the row update
    commits first, same "row is truth, Storage cleanup is best-effort" ordering as the
    sold-file replace path above.
    """
    template = await get_or_404(session, Template, template_id, "Template")
    existing = list(template.preview_image_keys or [])
    remaining = [
        item for item in existing
        if (item if isinstance(item, str) else item.get("key")) != payload.storage_key
    ]
    if len(remaining) == len(existing):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "preview_not_found", "message": "That preview image isn't on this template."}},
        )
    template.preview_image_keys = remaining
    await record_audit(
        session, actor=admin, action="remove_template_preview", target_type="template",
        target_id=template.id, context={"storage_key": payload.storage_key, "remaining": len(remaining)},
    )
    await session.commit()

    try:
        await asyncio.to_thread(delete_file, payload.storage_key)
    except Exception:  # noqa: BLE001 — best-effort, row is already committed
        pass

    return await _to_out(template, session)


class CreateTemplateProductIn(BaseModel):
    # Found 2026-08-21 (owner-flagged): same fix as courses.py's CreateProductIn —
    # "Create Product" was a separate, unnecessary step before a price could be set
    # at all. Removed from the UI; the price control now calls this first,
    # transparently, on a template with no product yet. Both optional so any other
    # caller keeps working at the old A$49 default.
    price_amount: Optional[int] = Field(default=None, gt=0)
    currency: str = Field(default="AUD", min_length=3, max_length=3)


@router.post("/admin/templates/{template_id}/create-product", response_model=TemplateOut)
async def create_template_product(
    template_id: uuid.UUID,
    payload: CreateTemplateProductIn = CreateTemplateProductIn(),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Create a product associated with this template, making it purchasable.

    Phase 8 (8A): Creates a real Stripe Price and Product, removing the placeholder.
    Stripe is called first; if it fails, no database row is created.
    Transaction safety ensures a half-success state cannot exist.

    Price: the caller's own `price_amount`/`currency` if given (Phase 9A
    re-verification), else the A$49 default this endpoint has always had.
    - Slug: derived from template title
    - Licence: standard
    """
    from app.db.models.product import Licence
    from app.integrations.stripe_client import create_price
    import stripe

    template = await get_or_404(session, Template, template_id, "Template")

    # Check if a standalone product already exists for this template — NOT the same
    # query as "any ProductContent row referencing this template", which also matches
    # a pack that includes it and crashed here with MultipleResultsFound once a
    # template could be in both at once (found 2026-08-21, same root cause as
    # _to_out's identical fix above).
    existing = await _standalone_template_product(session, template.id)

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "product_already_exists",
                    "message": "A product already exists for this template.",
                }
            },
        )

    price_amount = payload.price_amount if payload.price_amount is not None else 4900
    currency = payload.currency

    # Step 1: Create Stripe Price and Product FIRST (8A-4: Stripe first, DB second)
    try:
        stripe_price_id, stripe_product_id = create_price(
            unit_amount=price_amount,
            currency=currency,
            product_name=template.title,
        )
    except stripe.StripeError as e:
        # Stripe failed: return 502 with Stripe's message, no DB row created
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": {
                    "code": "stripe_error",
                    "message": str(e),
                }
            },
        )

    # Step 2: Create database row only after Stripe succeeds
    product = Product(
        slug=await ensure_unique_slug(session, Product, slugify(template.title)),
        name=template.title,
        description=template.description,
        stripe_price_id=stripe_price_id,  # Real Stripe Price ID, not placeholder
        stripe_product_id=stripe_product_id,  # Phase 8B: so a later price change reuses this Product
        price_amount=price_amount,
        currency=currency,
        licence=Licence.STANDARD,
        published=False,  # Start unpublished, admin must publish after review
    )
    session.add(product)
    await session.flush()

    # Associate product with template
    product_content = ProductContent(
        product_id=product.id,
        content_type="template",
        content_id=template.id,
    )
    session.add(product_content)

    await record_audit(
        session, actor=admin, action="create_template_product", target_type="product",
        target_id=product.id, context={
            "template_id": str(template_id),
            "template_title": template.title,
            "stripe_price_id": stripe_price_id,
            "stripe_product_id": stripe_product_id,
            "price_amount": price_amount,
            "currency": currency,
        },
    )
    await session.commit()

    return await _to_out(template, session)


@router.post("/admin/templates/{template_id}/publish", response_model=TemplateOut)
async def set_published(
    template_id: uuid.UUID,
    payload: PublishStateIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    template = await get_or_404(session, Template, template_id, "Template")
    if payload.published and not template.storage_key:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "no_file",
                    "message": "Upload the template file before publishing it.",
                }
            },
        )
    # ── W4-R1 publish guards ───────────────────────────────────────────────────
    if payload.published:
        if check_has_macros(template):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "macros_present",
                        "message": "This template has macros. No macros are permitted in any sold artefact.",
                    }
                },
            )
        if not template.is_free:
            preview_result = check_preview_images(template)
            if not preview_result.ok:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "error": {
                            "code": "insufficient_previews",
                            "message": f"A paid template requires at least 2 preview images. "
                                       f"This one has {preview_result.key_count}.",
                        }
                    },
                )
    was_state = template.publish_state.value
    was = template.published
    new_state = apply_publish_state_or_422(template, payload)
    await record_audit(
        session, actor=admin,
        action="publish_template" if payload.published else "unpublish_template",
        target_type="template", target_id=template.id,
        context={"from": was, "to": payload.published, "state_from": was_state, "state_to": new_state.value},
    )
    await session.commit()
    return await _to_out(template, session)
