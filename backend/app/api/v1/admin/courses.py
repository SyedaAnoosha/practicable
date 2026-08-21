"""Admin CRUD for courses, their modules, and their lessons — including attaching a
Mux video and a downloadable file to a lesson, and (week2_plan.md Phase 2) an ordered
sequence of content blocks for mixed-content lessons.
"""
import asyncio
import uuid
from typing import Literal, Optional, Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_admin
from app.core.html_sanitizer import sanitize_html
from app.db.models import (
    Author,
    Course,
    Lesson,
    LessonBlock,
    LessonBlockType,
    LessonType,
    Media,
    MediaStatus,
    Module,
    Product,
    ProductContent,
    Section,
    Template,
    User,
)
from app.db.session import get_session
from app.integrations.storage_client import delete_file, generate_presigned_upload_url, head_object

from .common import PublishStateIn, apply_publish_state_or_422, ensure_unique_slug, get_or_404, record_audit, slugify

router = APIRouter()


# ── Courses ──────────────────────────────────────────────────────────────────────

class CourseWriteIn(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1)
    subtitle: Optional[str] = Field(default=None, max_length=500)


class LessonBlockOut(BaseModel):
    id: str
    block_type: str
    sort_order: int
    # text / callout only.
    heading: Optional[str]
    text_body: Optional[str]
    prose_sanitized: Optional[str] = None  # Phase 8 (8E): sanitized HTML, null for plain text
    # video only — the underlying Mux id, so the editor can show whether it's attached.
    media_id: Optional[str]
    mux_playback_id: Optional[str]
    # Phase 8 (8D-3): lets the preview check the asset's *live* Mux encoding status —
    # Media.status in the DB is set optimistically at attach time and isn't kept in
    # sync with Mux afterward, so it can't answer "is this still encoding?" on its own.
    mux_asset_id: Optional[str]
    # file only.
    template_id: Optional[str]
    template_file_name: Optional[str]


class LessonOut(BaseModel):
    id: str
    slug: str
    title: str
    description: Optional[str]
    lesson_type: str
    body: Optional[str]
    sort_order: int
    published: bool
    publish_state: str
    download_template_id: Optional[str]
    mux_playback_id: Optional[str]
    # Phase 8 (8D-3): see LessonBlockOut.mux_asset_id — same reasoning.
    mux_asset_id: Optional[str]
    # A video lesson with no Mux asset renders an empty player after purchase — surfaced
    # so the editor can block publishing it.
    is_ready: bool
    # Ordered content blocks, populated for every lesson, not only `mixed` ones — a
    # video/reading/download lesson still carries the one block it was backfilled into.
    blocks: list[LessonBlockOut]


class ModuleOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    sort_order: int
    lessons: list[LessonOut]


class CourseRowOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    published: bool
    publish_state: str
    module_count: int
    lesson_count: int
    # Found 2026-08-21 (Phase 9A re-verification, owner-flagged usability gap): the
    # list view showed no price at all — an admin had to open every course to see
    # what it charges. Same fields CourseDetailOut already carries; None until
    # "Make purchasable" has been called, same as the detail page.
    price_amount: Optional[int] = None
    currency: Optional[str] = None


class CourseDetailOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    description: str
    published: bool
    publish_state: str
    cover_image_url: Optional[str] = None
    modules: list[ModuleOut]
    # Phase 8 (8A-6): server-derived readiness, same states/messages a bare product
    # would carry — computed here from the course's linked product (if any), via
    # `compute_readiness` (publish_guard.py), so the editor can show why a course
    # isn't purchasable without a second round trip to /admin/products.
    readiness: Literal["no_product", "price_unset", "stripe_price_unresolved", "unpublished", "ready"]
    readiness_message: str
    product_id: Optional[str] = None
    # Phase 8 (8B-7): the price-change confirmation step needs the *current* price to
    # compute the ±50%/zero delta — it cannot be inferred client-side without this.
    price_amount: Optional[int] = None
    currency: Optional[str] = None


def _enum_value(v) -> str:
    return v.value if hasattr(v, "value") else str(v)


def _block_out(b: LessonBlock) -> LessonBlockOut:
    return LessonBlockOut(
        id=str(b.id), block_type=_enum_value(b.block_type), sort_order=b.sort_order,
        heading=b.heading, text_body=b.text_body,
        prose_sanitized=b.prose_sanitized,
        media_id=str(b.media_id) if b.media_id else None,
        mux_playback_id=b.media.mux_playback_id if b.media else None,
        mux_asset_id=b.media.mux_asset_id if b.media else None,
        template_id=str(b.template_id) if b.template_id else None,
        template_file_name=b.template.file_name if b.template else None,
    )


def _lesson_out(lesson: Lesson, media: Optional[Media], blocks: Optional[Sequence[LessonBlock]] = None) -> LessonOut:
    blocks = blocks or []
    playback_id = media.mux_playback_id if media else None
    asset_id = media.mux_asset_id if media else None
    if lesson.lesson_type == LessonType.MIXED:
        # A MIXED lesson is authored entirely through blocks, not the legacy fields, and
        # may hold more than one video block, which the single-`media` lookup above can't
        # represent. Readiness is judged block-by-block instead: zero blocks, an
        # unattached video block, or an unattached file block all block publishing.
        is_ready = bool(blocks) and all(
            (b.block_type != LessonBlockType.VIDEO or (b.media is not None and bool(b.media.mux_playback_id)))
            and (b.block_type != LessonBlockType.FILE or b.template_id is not None)
            for b in blocks
        )
    else:
        needs_video = lesson.lesson_type == LessonType.VIDEO
        needs_body = lesson.lesson_type == LessonType.READING
        needs_file = lesson.lesson_type == LessonType.DOWNLOAD
        is_ready = (
            (not needs_video or bool(playback_id))
            and (not needs_body or bool(lesson.body))
            and (not needs_file or lesson.download_template_id is not None)
        )
    return LessonOut(
        id=str(lesson.id), slug=lesson.slug, title=lesson.title,
        description=lesson.description,
        lesson_type=_enum_value(lesson.lesson_type),
        body=lesson.body, sort_order=lesson.sort_order, published=lesson.published,
        publish_state=lesson.publish_state.value,
        download_template_id=str(lesson.download_template_id) if lesson.download_template_id else None,
        mux_playback_id=playback_id, mux_asset_id=asset_id, is_ready=is_ready,
        blocks=[_block_out(b) for b in (blocks or [])],
    )


@router.get("/admin/courses", response_model=list[CourseRowOut])
async def list_courses(session: AsyncSession = Depends(get_session)):
    courses = (await session.execute(select(Course).order_by(Course.title))).scalars().all()
    if not courses:
        return []
    # Two grouped counts rather than a query per course, avoiding an N+1.
    module_counts = {
        course_id: count
        for course_id, count in (
            await session.execute(
                select(Module.course_id, func.count()).group_by(Module.course_id)
            )
        ).all()
    }
    lesson_counts = {
        course_id: count
        for course_id, count in (
            await session.execute(
                select(Module.course_id, func.count(Lesson.id))
                .join(Lesson, Lesson.module_id == Module.id)
                .group_by(Module.course_id)
            )
        ).all()
    }
    # Batched price lookup — same N+1-avoidance discipline as the counts above.
    # ProductContent -> Product, one join, keyed by course id.
    prices = {
        content_id: (price_amount, currency)
        for content_id, price_amount, currency in (
            await session.execute(
                select(ProductContent.content_id, Product.price_amount, Product.currency)
                .join(Product, Product.id == ProductContent.product_id)
                .where(ProductContent.content_type == "course")
            )
        ).all()
    }
    return [
        CourseRowOut(
            id=str(c.id), slug=c.slug, title=c.title, subtitle=c.subtitle,
            published=c.published, publish_state=c.publish_state.value,
            module_count=module_counts.get(c.id, 0),
            lesson_count=lesson_counts.get(c.id, 0),
            price_amount=prices.get(c.id, (None, None))[0],
            currency=prices.get(c.id, (None, None))[1],
        )
        for c in courses
    ]


@router.get("/admin/courses/{course_id}", response_model=CourseDetailOut)
async def get_course(course_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    course = await get_or_404(session, Course, course_id, "Course")
    modules = (
        (await session.execute(select(Module).where(Module.course_id == course.id).order_by(Module.sort_order)))
        .scalars()
        .all()
    )
    module_ids = [m.id for m in modules]

    lessons_by_module: dict[uuid.UUID, list[Lesson]] = {}
    media_by_lesson: dict[uuid.UUID, Media] = {}
    blocks_by_lesson: dict[uuid.UUID, list[LessonBlock]] = {}
    if module_ids:
        lessons = (
            (
                await session.execute(
                    select(Lesson)
                    .where(Lesson.module_id.in_(module_ids))
                    .order_by(Lesson.sort_order)
                )
            )
            .scalars()
            .all()
        )
        for lesson in lessons:
            # Query above filters on Lesson.module_id.in_(module_ids), so this is never None.
            assert lesson.module_id is not None
            lessons_by_module.setdefault(lesson.module_id, []).append(lesson)
        if lessons:
            lesson_ids = [lesson.id for lesson in lessons]
            media_rows = (
                (await session.execute(select(Media).where(Media.lesson_id.in_(lesson_ids))))
                .scalars()
                .all()
            )
            media_by_lesson = {m.lesson_id: m for m in media_rows}

            block_rows = (
                (
                    await session.execute(
                        select(LessonBlock)
                        .where(LessonBlock.lesson_id.in_(lesson_ids))
                        .options(selectinload(LessonBlock.media), selectinload(LessonBlock.template))
                        .order_by(LessonBlock.sort_order)
                    )
                )
                .scalars()
                .all()
            )
            for b in block_rows:
                blocks_by_lesson.setdefault(b.lesson_id, []).append(b)

    # Resolve cover image URL (best-effort — an invalid key just returns None)
    cover_image_url = None
    if course.cover_image_key:
        try:
            from app.integrations.storage_client import generate_presigned_url
            cover_image_url = generate_presigned_url(course.cover_image_key, expiry_seconds=3600)
        except Exception:  # noqa: BLE001
            pass

    # Phase 8 (8A-6): resolve the course's linked product (None until "Make
    # purchasable" has been called) and derive readiness from it.
    from app.core.publish_guard import compute_readiness

    product_content = (
        await session.execute(
            select(ProductContent).where(
                ProductContent.content_type == "course",
                ProductContent.content_id == course.id,
            )
        )
    ).scalar_one_or_none()
    product = None
    if product_content is not None:
        product = (
            await session.execute(select(Product).where(Product.id == product_content.product_id))
        ).scalar_one_or_none()
    readiness_result = compute_readiness(product)

    return CourseDetailOut(
        id=str(course.id), slug=course.slug, title=course.title,
        subtitle=course.subtitle, description=course.description, published=course.published,
        publish_state=course.publish_state.value,
        cover_image_url=cover_image_url,
        readiness=readiness_result.state,
        readiness_message=readiness_result.message,
        product_id=str(product.id) if product else None,
        price_amount=product.price_amount if product else None,
        currency=product.currency if product else None,
        modules=[
            ModuleOut(
                id=str(m.id), title=m.title, description=m.description, sort_order=m.sort_order,
                lessons=[
                    _lesson_out(lesson, media_by_lesson.get(lesson.id), blocks_by_lesson.get(lesson.id))
                    for lesson in lessons_by_module.get(m.id, [])
                ],
            )
            for m in modules
        ],
    )


async def grant_course_lessons(
    session: AsyncSession, *, product_id: uuid.UUID, course_id: uuid.UUID, dry_run: bool = False
) -> int:
    """Grant every lesson in a course to the course's own product.

    Found live 2026-08-21: a lesson added to an already-published, already-purchased
    course showed locked to a buyer who owned the course. Root cause traced end to
    end — `_lesson_entitled` (content/lessons.py) and `require_entitlement`
    (core/entitlements.py) both gate lesson access on a per-lesson `ProductContent`
    row (`content_type="lesson"`, `content_id=<lesson.id>`), never on the course-level
    `content_type="course"` row `create_course_product` writes below. Grepped the
    entire backend: no production code path — not `create_course_product`, not
    `create_lesson`, not any migration — had ever written a `content_type="lesson"`
    row; only test fixtures did. So this wasn't specific to a newly-added lesson —
    every lesson in every course only ever unlocked if someone created that row by
    hand outside this code. This function is the fix, called from both
    `create_course_product` (grants every lesson that exists when the course becomes
    purchasable) and `create_lesson` (grants a lesson added afterward, if the course
    already has a product) — see the calls at each site for which gap each one closes.

    Idempotent by construction: checks which of this course's lessons this exact
    product has already granted, in one query, and only inserts the ones missing — safe
    to call again (a retried request, a backfill re-run) without creating duplicate
    `product_contents` rows, since there is no unique constraint on
    `(product_id, content_type, content_id)` to rely on for that instead.

    `dry_run=True` (backfill_lesson_entitlements.py's dry-run mode) runs the exact same
    lookup and returns the same count, but skips the `session.add()` calls — so the
    reported number is guaranteed to match what --apply would actually create, rather
    than a second, separately-maintained query that could drift from this one.

    Returns the number of new grants actually created (0 on a repeat call, or always
    in dry-run mode).
    """
    lesson_ids = (
        await session.execute(
            select(Lesson.id).join(Module, Module.id == Lesson.module_id).where(Module.course_id == course_id)
        )
    ).scalars().all()
    if not lesson_ids:
        return 0

    already_granted = (
        await session.execute(
            select(ProductContent.content_id).where(
                ProductContent.product_id == product_id,
                ProductContent.content_type == "lesson",
                ProductContent.content_id.in_(lesson_ids),
            )
        )
    ).scalars().all()
    already_granted_set = set(already_granted)

    missing = [lid for lid in lesson_ids if lid not in already_granted_set]
    if not dry_run:
        for lesson_id in missing:
            session.add(ProductContent(product_id=product_id, content_type="lesson", content_id=lesson_id))
    return len(missing)


class CreateProductIn(BaseModel):
    # Found 2026-08-21 (owner-flagged): "Create Product" was a separate, unnecessary
    # step before a course could be priced at all — the admin clicked one button to
    # get a product, then a second control to actually set its price. Removed from
    # the UI; this endpoint now takes the admin's own price directly (the frontend's
    # price control calls this first, transparently, the first time a price is set
    # on a course with no product yet — see AdminCourses.tsx). Both fields optional
    # so any other caller of this endpoint keeps working unchanged at the old A$99
    # default.
    price_amount: Optional[int] = Field(default=None, gt=0)
    currency: str = Field(default="AUD", min_length=3, max_length=3)


@router.post("/admin/courses/{course_id}/create-product", response_model=CourseDetailOut)
async def create_course_product(
    course_id: uuid.UUID,
    payload: CreateProductIn = CreateProductIn(),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Create a product associated with this course, making it purchasable.

    Phase 8 (8A): Creates a real Stripe Price and Product, removing the placeholder.
    Stripe is called first; if it fails, no database row is created.
    Transaction safety ensures a half-success state cannot exist.

    Price: the caller's own `price_amount`/`currency` if given (Phase 9A
    re-verification: the admin sets this directly now, no separate step), else the
    A$99 default this endpoint has always had.
    - Slug: derived from course title
    - Licence: standard
    """
    from app.db.models.product import Licence
    from app.integrations.stripe_client import create_price
    from .common import slugify
    import stripe

    course = await get_or_404(session, Course, course_id, "Course")

    # Check if product already exists for this course
    existing = (
        await session.execute(
            select(ProductContent).where(
                ProductContent.content_type == "course",
                ProductContent.content_id == course.id
            )
        )
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "product_already_exists",
                    "message": "A product already exists for this course.",
                }
            },
        )

    price_amount = payload.price_amount if payload.price_amount is not None else 9900
    currency = payload.currency

    # Step 1: Create Stripe Price and Product FIRST (8A-4: Stripe first, DB second)
    try:
        stripe_price_id, stripe_product_id = create_price(
            unit_amount=price_amount,
            currency=currency,
            product_name=f"{course.title} (Course)",
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
        slug=await ensure_unique_slug(session, Product, slugify(f"{course.title}-course")),
        name=f"{course.title} (Course)",
        description=course.description,
        stripe_price_id=stripe_price_id,  # Real Stripe Price ID, not placeholder
        stripe_product_id=stripe_product_id,  # Phase 8B: so a later price change reuses this Product
        price_amount=price_amount,
        currency=currency,
        licence=Licence.STANDARD,
        published=False,  # Start unpublished, admin must publish after review
    )
    session.add(product)
    await session.flush()

    # Associate product with course
    product_content = ProductContent(
        product_id=product.id,
        content_type="course",
        content_id=course.id,
    )
    session.add(product_content)

    # Grant every lesson that exists right now — see grant_course_lessons' own
    # docstring for the bug this closes. A lesson added later is granted by
    # create_lesson below instead, at the moment it's created.
    lessons_granted = await grant_course_lessons(session, product_id=product.id, course_id=course.id)

    await record_audit(
        session, actor=admin, action="create_course_product", target_type="product",
        target_id=product.id, context={
            "course_id": str(course_id),
            "course_title": course.title,
            "stripe_price_id": stripe_price_id,
            "stripe_product_id": stripe_product_id,
            "price_amount": price_amount,
            "currency": currency,
            "lessons_granted": lessons_granted,
        },
    )
    await session.commit()

    return await get_course(course_id, session)


@router.post("/admin/courses", response_model=CourseDetailOut, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    section_id = (await session.execute(select(Section.id).limit(1))).scalar_one_or_none()
    author_id = (await session.execute(select(Author.id).limit(1))).scalar_one_or_none()
    if section_id is None or author_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "missing_prerequisites",
                    "message": "A section and an author must exist before courses can be created.",
                }
            },
        )
    course = Course(
        slug=await ensure_unique_slug(session, Course, slugify(payload.title)),
        title=payload.title, subtitle=payload.subtitle, description=payload.description,
        section_id=section_id, author_id=author_id, published=False,
    )
    session.add(course)
    await session.flush()
    await record_audit(
        session, actor=admin, action="create_course", target_type="course",
        target_id=course.id, context={"title": course.title},
    )
    await session.commit()
    return await get_course(course.id, session)


@router.put("/admin/courses/{course_id}", response_model=CourseDetailOut)
async def update_course(
    course_id: uuid.UUID,
    payload: CourseWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    course = await get_or_404(session, Course, course_id, "Course")
    course.title = payload.title
    course.subtitle = payload.subtitle
    course.description = payload.description
    await record_audit(
        session, actor=admin, action="update_course", target_type="course",
        target_id=course.id, context={"title": course.title},
    )
    await session.commit()
    return await get_course(course_id, session)


@router.post("/admin/courses/{course_id}/publish", response_model=CourseDetailOut)
async def set_course_published(
    course_id: uuid.UUID,
    payload: PublishStateIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    course = await get_or_404(session, Course, course_id, "Course")
    was_state = course.publish_state.value
    was = course.published
    new_state = apply_publish_state_or_422(course, payload)
    await record_audit(
        session, actor=admin,
        action="publish_course" if payload.published else "unpublish_course",
        target_type="course", target_id=course.id,
        context={"from": was, "to": payload.published, "state_from": was_state, "state_to": new_state.value},
    )
    await session.commit()
    return await get_course(course_id, session)


# ── Cover image upload ───────────────────────────────────────────────────────────
# week4_plan.md Phase 3 step 6 — courses need preview images like Coursera/edX/Udemy.
# Same presigned-upload pattern as templates: validate type/size, issue a URL, let
# the browser write directly, confirm via HEAD, update the row.

ALLOWED_COVER_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_COVER_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB — a cover image, not a document


class CoverUploadUrlIn(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str
    file_size_bytes: int = Field(gt=0)


class CoverUploadUrlOut(BaseModel):
    upload_url: str
    storage_key: str
    expires_in: int


@router.post("/admin/courses/{course_id}/cover/upload-url", response_model=CoverUploadUrlOut)
async def create_cover_upload_url(
    course_id: uuid.UUID,
    payload: CoverUploadUrlIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Presigned Storage PUT URL for a course cover image. Validated before the URL
    is issued — type and size checked server-side, not discovered after a failed upload.
    """
    await get_or_404(session, Course, course_id, "Course")

    if payload.content_type not in ALLOWED_COVER_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"error": {"code": "unsupported_type", "message": f"{payload.content_type} isn't an accepted image format. Use PNG, JPEG or WebP."}},
        )
    if payload.file_size_bytes > MAX_COVER_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"error": {"code": "file_too_large", "message": f"That file is {payload.file_size_bytes / (1024 * 1024):.0f}MB. The ceiling is {MAX_COVER_UPLOAD_BYTES // (1024 * 1024)}MB."}},
        )

    safe_name = slugify(payload.file_name) or "cover"
    storage_key = f"courses/{course_id}/cover/{uuid.uuid4().hex}-{safe_name}"
    expiry_seconds = 300
    upload_url = generate_presigned_upload_url(key=storage_key, content_type=payload.content_type, expiry_seconds=expiry_seconds)
    return CoverUploadUrlOut(upload_url=upload_url, storage_key=storage_key, expires_in=expiry_seconds)


class CoverUploadConfirmIn(BaseModel):
    storage_key: str
    file_name: str = Field(min_length=1, max_length=255)


@router.post("/admin/courses/{course_id}/cover/upload-url/confirm", response_model=CourseDetailOut)
async def confirm_cover_upload(
    course_id: uuid.UUID,
    payload: CoverUploadConfirmIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Called after the browser's direct PUT to storage_key completes. Verifies the
    object landed via a real HEAD, then updates the course row."""
    course = await get_or_404(session, Course, course_id, "Course")

    meta = await asyncio.to_thread(head_object, payload.storage_key)
    if meta is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "upload_not_found", "message": "That upload hasn't landed in storage yet — try again in a moment."}},
        )
    content_length = meta.get("content_length") or 0
    if content_length > MAX_COVER_UPLOAD_BYTES:
        await asyncio.to_thread(delete_file, payload.storage_key)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"error": {"code": "file_too_large", "message": f"That file is {content_length / (1024 * 1024):.0f}MB. The ceiling is {MAX_COVER_UPLOAD_BYTES // (1024 * 1024)}MB."}},
        )

    previous_key = course.cover_image_key
    course.cover_image_key = payload.storage_key
    await record_audit(
        session, actor=admin, action="upload_course_cover", target_type="course",
        target_id=course.id,
        context={"file_name": payload.file_name, "bytes": content_length, "replaced": bool(previous_key), "via": "presigned"},
    )
    await session.commit()

    if previous_key and previous_key != payload.storage_key:
        try:
            await asyncio.to_thread(delete_file, previous_key)
        except Exception:  # noqa: BLE001 — best-effort, row is already committed
            pass

    return await get_course(course_id, session)


@router.post("/admin/courses/{course_id}/cover/remove", response_model=CourseDetailOut)
async def remove_cover_image(
    course_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Remove the cover image. Deletes the Storage object; the row update commits first
    (row is truth, Storage cleanup is best-effort)."""
    course = await get_or_404(session, Course, course_id, "Course")
    if not course.cover_image_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "no_cover_image", "message": "This course has no cover image."}},
        )
    previous_key = course.cover_image_key
    course.cover_image_key = None
    await record_audit(
        session, actor=admin, action="remove_course_cover", target_type="course",
        target_id=course.id, context={"storage_key": previous_key},
    )
    await session.commit()

    try:
        await asyncio.to_thread(delete_file, previous_key)
    except Exception:  # noqa: BLE001 — best-effort, row is already committed
        pass

    return await get_course(course_id, session)


# ── Modules ──────────────────────────────────────────────────────────────────────

class ModuleWriteIn(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    sort_order: Optional[int] = None


@router.post("/admin/courses/{course_id}/modules", response_model=CourseDetailOut, status_code=status.HTTP_201_CREATED)
async def create_module(
    course_id: uuid.UUID,
    payload: ModuleWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    course = await get_or_404(session, Course, course_id, "Course")
    # Default to the end of the list, so appending doesn't need a sort-order field.
    sort_order = payload.sort_order
    if sort_order is None:
        highest = (
            await session.execute(
                select(func.max(Module.sort_order)).where(Module.course_id == course.id)
            )
        ).scalar()
        sort_order = (highest or 0) + 1
    module = Module(
        course_id=course.id, title=payload.title,
        description=payload.description, sort_order=sort_order,
    )
    session.add(module)
    await session.flush()
    await record_audit(
        session, actor=admin, action="create_module", target_type="module",
        target_id=module.id, context={"course": course.slug, "title": module.title},
    )
    await session.commit()
    return await get_course(course_id, session)


@router.put("/admin/modules/{module_id}", response_model=CourseDetailOut)
async def update_module(
    module_id: uuid.UUID,
    payload: ModuleWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    module = await get_or_404(session, Module, module_id, "Module")
    module.title = payload.title
    module.description = payload.description
    if payload.sort_order is not None:
        module.sort_order = payload.sort_order
    await record_audit(
        session, actor=admin, action="update_module", target_type="module",
        target_id=module.id, context={"title": module.title},
    )
    await session.commit()
    return await get_course(module.course_id, session)


# ── Lessons ──────────────────────────────────────────────────────────────────────

class LessonWriteIn(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    lesson_type: LessonType
    description: Optional[str] = None
    # Required for reading/mixed lessons, but validated on publish rather than save so a
    # draft can be written across several sittings.
    body: Optional[str] = None
    download_template_id: Optional[uuid.UUID] = None
    sort_order: Optional[int] = None


async def _course_id_for_lesson(session: AsyncSession, lesson: Lesson) -> uuid.UUID:
    # module_id is nullable at the schema level, but every lesson reachable through
    # these admin routes was created under a module and always has one set.
    assert lesson.module_id is not None
    module = await get_or_404(session, Module, lesson.module_id, "Module")
    return module.course_id


@router.post("/admin/modules/{module_id}/lessons", response_model=CourseDetailOut, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    module_id: uuid.UUID,
    payload: LessonWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    module = await get_or_404(session, Module, module_id, "Module")
    if payload.download_template_id is not None:
        await get_or_404(session, Template, payload.download_template_id, "Template")

    sort_order = payload.sort_order
    if sort_order is None:
        highest = (
            await session.execute(
                select(func.max(Lesson.sort_order)).where(Lesson.module_id == module.id)
            )
        ).scalar()
        sort_order = (highest or 0) + 1

    lesson = Lesson(
        slug=await ensure_unique_slug(session, Lesson, slugify(payload.title)),
        title=payload.title, description=payload.description,
        lesson_type=payload.lesson_type, body=payload.body,
        prose_sanitized=sanitize_html(payload.body),  # Phase 8 (8E)
        download_template_id=payload.download_template_id,
        module_id=module.id, sort_order=sort_order, published=False,
    )
    session.add(lesson)
    await session.flush()

    # Found live 2026-08-21: a lesson added to a course that's already purchasable
    # showed locked to a buyer who owned the course — grant_course_lessons' docstring
    # has the full root cause. If this course already has a product, grant the new
    # lesson to it now rather than leaving it stranded until someone thinks to run the
    # backfill script again. A course with no product yet has nothing to grant against
    # — create_course_product's own call to grant_course_lessons covers it once one
    # exists.
    course_product = (
        await session.execute(
            select(ProductContent.product_id).where(
                ProductContent.content_type == "course",
                ProductContent.content_id == module.course_id,
            )
        )
    ).scalar_one_or_none()
    if course_product is not None:
        session.add(ProductContent(product_id=course_product, content_type="lesson", content_id=lesson.id))

    await record_audit(
        session, actor=admin, action="create_lesson", target_type="lesson",
        target_id=lesson.id, context={"module": str(module.id), "title": lesson.title},
    )
    await session.commit()
    return await get_course(module.course_id, session)


@router.put("/admin/lessons/{lesson_id}", response_model=CourseDetailOut)
async def update_lesson(
    lesson_id: uuid.UUID,
    payload: LessonWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    lesson = await get_or_404(session, Lesson, lesson_id, "Lesson")
    if payload.download_template_id is not None:
        await get_or_404(session, Template, payload.download_template_id, "Template")
    lesson.title = payload.title
    lesson.description = payload.description
    lesson.lesson_type = payload.lesson_type
    lesson.body = payload.body
    lesson.prose_sanitized = sanitize_html(payload.body)  # Phase 8 (8E)
    lesson.download_template_id = payload.download_template_id
    if payload.sort_order is not None:
        lesson.sort_order = payload.sort_order
    await record_audit(
        session, actor=admin, action="update_lesson", target_type="lesson",
        target_id=lesson.id, context={"title": lesson.title},
    )
    await session.commit()
    return await get_course(await _course_id_for_lesson(session, lesson), session)


class LessonVideoIn(BaseModel):
    """Mux ids, pasted from the Mux dashboard after an upload there.

    Deliberately not a video upload endpoint: proxying video bytes through this API
    would tie up a worker for the length of the upload, where Mux's own direct-upload
    flow handles resumable transfer, retries and encoding. Swapping to that flow later
    is an isolated change to this one endpoint.
    """
    mux_asset_id: str = Field(min_length=1, max_length=255)
    mux_playback_id: str = Field(min_length=1, max_length=255)
    duration_seconds: Optional[int] = None


@router.put("/admin/lessons/{lesson_id}/video", response_model=CourseDetailOut)
async def set_lesson_video(
    lesson_id: uuid.UUID,
    payload: LessonVideoIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    lesson = await get_or_404(session, Lesson, lesson_id, "Lesson")
    media = (
        await session.execute(select(Media).where(Media.lesson_id == lesson.id))
    ).scalar_one_or_none()
    if media is None:
        media = Media(lesson_id=lesson.id)
        session.add(media)
    media.mux_asset_id = payload.mux_asset_id
    media.mux_playback_id = payload.mux_playback_id
    media.duration_seconds = payload.duration_seconds
    media.status = MediaStatus.READY
    await record_audit(
        session, actor=admin, action="set_lesson_video", target_type="lesson",
        target_id=lesson.id, context={"playback_id": payload.mux_playback_id},
    )
    await session.commit()
    return await get_course(await _course_id_for_lesson(session, lesson), session)


@router.post("/admin/lessons/{lesson_id}/publish", response_model=CourseDetailOut)
async def set_lesson_published(
    lesson_id: uuid.UUID,
    payload: PublishStateIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Publishing is refused unless the lesson actually has its content — otherwise a
    video lesson with no Mux asset renders an empty player to someone who just paid."""
    lesson = await get_or_404(session, Lesson, lesson_id, "Lesson")
    if payload.published:
        # `.first()`, not `scalar_one_or_none()`: a MIXED lesson can legitimately have
        # more than one Media row, and this lookup is never authoritative for one.
        media = (
            (await session.execute(select(Media).where(Media.lesson_id == lesson.id)))
            .scalars()
            .first()
        )
        blocks = (
            (
                await session.execute(
                    select(LessonBlock)
                    .where(LessonBlock.lesson_id == lesson.id)
                    .options(selectinload(LessonBlock.media), selectinload(LessonBlock.template))
                )
            )
            .scalars()
            .all()
        )
        out = _lesson_out(lesson, media, blocks)
        if not out.is_ready:
            missing = {
                LessonType.VIDEO: "a video",
                LessonType.MIXED: "at least one content block, with every video/file block attached",
                LessonType.READING: "a written body",
                LessonType.DOWNLOAD: "a downloadable file",
            }.get(lesson.lesson_type, "its content")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "lesson_incomplete",
                        "message": f"Add {missing} before publishing this lesson.",
                    }
                },
            )
    was_state = lesson.publish_state.value
    was = lesson.published
    new_state = apply_publish_state_or_422(lesson, payload)
    await record_audit(
        session, actor=admin,
        action="publish_lesson" if payload.published else "unpublish_lesson",
        target_type="lesson", target_id=lesson.id,
        context={"from": was, "to": payload.published, "state_from": was_state, "state_to": new_state.value},
    )
    await session.commit()
    return await get_course(await _course_id_for_lesson(session, lesson), session)


# ── Lesson blocks ────────────────────────────────────────────────────────────────
# Ordered content — text, video, file, callout — for a lesson authored as more than one
# piece. Reordering is up/down buttons, not drag-and-drop: fewer moving parts,
# keyboard-operable for free, no drag library dependency.

class LessonBlockWriteIn(BaseModel):
    block_type: LessonBlockType
    # text / callout only.
    heading: Optional[str] = Field(default=None, max_length=500)
    text_body: Optional[str] = None
    # file only — an existing Template row's id, not a new upload here.
    template_id: Optional[uuid.UUID] = None


async def _course_id_for_block(session: AsyncSession, block: LessonBlock) -> uuid.UUID:
    lesson = await get_or_404(session, Lesson, block.lesson_id, "Lesson")
    return await _course_id_for_lesson(session, lesson)


@router.post("/admin/lessons/{lesson_id}/blocks", response_model=CourseDetailOut, status_code=status.HTTP_201_CREATED)
async def create_lesson_block(
    lesson_id: uuid.UUID,
    payload: LessonBlockWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    lesson = await get_or_404(session, Lesson, lesson_id, "Lesson")
    if payload.template_id is not None:
        await get_or_404(session, Template, payload.template_id, "Template")

    highest = (
        await session.execute(select(func.max(LessonBlock.sort_order)).where(LessonBlock.lesson_id == lesson.id))
    ).scalar()
    sort_order = (highest + 1) if highest is not None else 0

    block = LessonBlock(
        lesson_id=lesson.id, sort_order=sort_order, block_type=payload.block_type,
        heading=payload.heading, text_body=payload.text_body,
        prose_sanitized=sanitize_html(payload.text_body),  # Phase 8 (8E)
        template_id=payload.template_id,
    )
    session.add(block)
    await session.flush()
    await record_audit(
        session, actor=admin, action="create_lesson_block", target_type="lesson_block",
        target_id=block.id, context={"lesson": str(lesson.id), "block_type": payload.block_type.value},
    )
    await session.commit()
    return await get_course(await _course_id_for_lesson(session, lesson), session)


@router.put("/admin/lesson-blocks/{block_id}", response_model=CourseDetailOut)
async def update_lesson_block(
    block_id: uuid.UUID,
    payload: LessonBlockWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    block = await get_or_404(session, LessonBlock, block_id, "Block")
    if payload.template_id is not None:
        await get_or_404(session, Template, payload.template_id, "Template")
    block.block_type = payload.block_type
    block.heading = payload.heading
    block.text_body = payload.text_body
    block.prose_sanitized = sanitize_html(payload.text_body)  # Phase 8 (8E)
    block.template_id = payload.template_id
    await record_audit(
        session, actor=admin, action="update_lesson_block", target_type="lesson_block",
        target_id=block.id, context={"block_type": payload.block_type.value},
    )
    await session.commit()
    return await get_course(await _course_id_for_block(session, block), session)


@router.delete("/admin/lesson-blocks/{block_id}", response_model=CourseDetailOut)
async def delete_lesson_block(
    block_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    block = await get_or_404(session, LessonBlock, block_id, "Block")
    course_id = await _course_id_for_block(session, block)
    await record_audit(
        session, actor=admin, action="delete_lesson_block", target_type="lesson_block",
        target_id=block.id, context={"lesson": str(block.lesson_id), "block_type": block.block_type.value},
    )
    await session.delete(block)
    await session.commit()
    return await get_course(course_id, session)


class BlockMoveIn(BaseModel):
    direction: Literal["up", "down"]


@router.post("/admin/lesson-blocks/{block_id}/move", response_model=CourseDetailOut)
async def move_lesson_block(
    block_id: uuid.UUID,
    payload: BlockMoveIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Swaps this block's sort_order with its immediate neighbour. A no-op (not an
    error) at either end of the list, so the editor's up/down buttons don't need to
    special-case disabling themselves against a race with another admin's edit."""
    block = await get_or_404(session, LessonBlock, block_id, "Block")
    siblings = (
        (
            await session.execute(
                select(LessonBlock).where(LessonBlock.lesson_id == block.lesson_id).order_by(LessonBlock.sort_order)
            )
        )
        .scalars()
        .all()
    )
    idx = next(i for i, b in enumerate(siblings) if b.id == block.id)
    swap_idx = idx - 1 if payload.direction == "up" else idx + 1

    if 0 <= swap_idx < len(siblings):
        other = siblings[swap_idx]
        # A three-step swap, not a direct exchange: the UNIQUE (lesson_id, sort_order)
        # constraint is checked immediately per statement, so writing `other`'s old
        # value onto `block` while `other` still holds it collides mid-flush. -1 is
        # never a real sort_order, so it's a safe scratch value.
        block_order, other_order = block.sort_order, other.sort_order
        block.sort_order = -1
        await session.flush()
        other.sort_order = block_order
        await session.flush()
        block.sort_order = other_order
        await record_audit(
            session, actor=admin, action="move_lesson_block", target_type="lesson_block",
            target_id=block.id, context={"direction": payload.direction},
        )
    await session.commit()
    return await get_course(await _course_id_for_block(session, block), session)


class LessonBlockVideoIn(BaseModel):
    """Same shape as `LessonVideoIn` above, scoped to one block instead of one lesson —
    what makes a MIXED lesson with more than one video block possible at all."""
    mux_asset_id: str = Field(min_length=1, max_length=255)
    mux_playback_id: str = Field(min_length=1, max_length=255)
    duration_seconds: Optional[int] = None


@router.put("/admin/lesson-blocks/{block_id}/video", response_model=CourseDetailOut)
async def set_lesson_block_video(
    block_id: uuid.UUID,
    payload: LessonBlockVideoIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    block = await get_or_404(session, LessonBlock, block_id, "Block")
    if block.block_type != LessonBlockType.VIDEO:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "wrong_block_type", "message": "This block is not a video block."}},
        )
    media = (
        (await session.execute(select(Media).where(Media.id == block.media_id))).scalar_one_or_none()
        if block.media_id
        else None
    )
    if media is None:
        # `lesson_id` is a NOT NULL legacy column on `media` — set for validity, but
        # `block.media_id` (set below) is what actually associates it with THIS block.
        media = Media(lesson_id=block.lesson_id)
        session.add(media)
        await session.flush()
        block.media_id = media.id
    media.mux_asset_id = payload.mux_asset_id
    media.mux_playback_id = payload.mux_playback_id
    media.duration_seconds = payload.duration_seconds
    media.status = MediaStatus.READY
    await record_audit(
        session, actor=admin, action="set_lesson_block_video", target_type="lesson_block",
        target_id=block.id, context={"playback_id": payload.mux_playback_id},
    )
    await session.commit()
    return await get_course(await _course_id_for_block(session, block), session)
