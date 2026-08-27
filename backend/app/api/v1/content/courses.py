"""Course catalogue and public syllabus pages. This file only ever answers "what is in
this course and do I own it" — lesson content is served by lessons.py.
"""
import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id_optional
from app.core.entitlements import ResourceType, resolve_granted_content_ids, resolve_product_ids
from app.db.models import (
    Assessment,
    Author,
    Certificate,
    Course,
    Entitlement,
    Lesson,
    LessonProgress,
    Media,
    Module,
    ModuleQuestion,
    Product,
    ProductContent,
    Question,
    Section,
)
from app.api.v1.content.reviews import aggregate_rating
from app.db.session import get_session
from app.integrations.storage_client import generate_presigned_url

router = APIRouter()


def _lesson_type_value(lesson_type) -> str:
    return lesson_type.value if hasattr(lesson_type, "value") else lesson_type


class RelatedProductOut(BaseModel):
    slug: str
    name: str
    price_amount: int
    currency: str


class CourseSummaryOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    description: str
    section: str
    module_count: int
    lesson_count: int
    owned: bool
    cover_image_url: Optional[str] = None
    # Level and estimated duration for catalogue filtering (migration 025).
    level: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    product: Optional[RelatedProductOut]
    # `rating` is null below MIN_REVIEWS_FOR_AGGREGATE — served from the denormalised
    # counters on the row, so a catalogue of N cards stays one query rather than N
    # calls to /reviews/rating.
    rating: Optional[float] = None
    review_count: int = 0


class LessonOutlineOut(BaseModel):
    id: str
    slug: str
    title: str
    lesson_type: str
    sort_order: int
    duration_seconds: Optional[int]
    locked: bool
    completed: bool


class ModuleQuestionOut(BaseModel):
    """A question attached to the module — always public, so it carries no lock state."""
    id: str
    slug: str
    title: str
    sort_order: int


class ModuleOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    sort_order: int
    lessons: list[LessonOutlineOut]
    questions: list[ModuleQuestionOut]
    # Whether this module has a *published* assessment, so the outline doesn't render
    # a "Take Assessment" row that 404s. Deliberately a boolean rather than the
    # assessment itself: this is the public outline, and the paper is entitled
    # content. The title is safe to show, so it ships alongside, but nothing more.
    has_assessment: bool = False
    assessment_title: Optional[str] = None


class CourseDetailOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    description: str
    section: str
    author_name: str
    # The bio establishes why the named author should be trusted. Optional, and the
    # author row is already loaded, so this costs no extra query.
    author_bio: Optional[str] = None
    owned: bool
    lesson_count: int
    first_lesson_slug: Optional[str]
    cover_image_url: Optional[str] = None
    modules: list[ModuleOut]
    related_products: list[RelatedProductOut]
    # When a buyer's access to THIS course ended because their order was refunded.
    # Null in every other case, including a course never bought — so a refunded buyer
    # is told what happened rather than seeing an ordinary buy page.
    access_ended_at: Optional[str] = None
    # Whether this reader has completed the course, and their certificate code if one
    # was issued. The page shows a completion badge and certificate link instead of
    # the "Continue the course" CTA.
    completed: bool = False
    certificate_verification_code: Optional[str] = None
    # Same as CourseSummaryOut — null below the display threshold.
    rating: Optional[float] = None
    review_count: int = 0


@router.get("/courses", response_model=list[CourseSummaryOut])
async def list_courses(
    session: AsyncSession = Depends(get_session),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
    level: Optional[str] = Query(None, description="Filter by level: beginner, intermediate, advanced"),
    min_duration: Optional[int] = Query(None, ge=0, description="Minimum duration in minutes"),
    max_duration: Optional[int] = Query(None, ge=0, description="Maximum duration in minutes"),
):
    """The course catalogue — public. `owned` is a real entitlement check, so a card
    never shows a price on something the visitor already holds.

    Uses a fixed handful of bulk queries regardless of how many courses or lessons
    exist, with the per-course/per-lesson work done in memory.
    """
    result = await session.execute(
        select(Course).where(Course.published.is_(True)).order_by(Course.created_at)
    )
    courses = list(result.scalars().all())
    if not courses:
        return []

    course_ids = [c.id for c in courses]
    section_ids = [c.section_id for c in courses]

    sections_by_id = {
        section_id: name
        for section_id, name in (
            await session.execute(select(Section.id, Section.name).where(Section.id.in_(section_ids)))
        ).all()
    }

    modules = (
        (await session.execute(select(Module).where(Module.course_id.in_(course_ids)))).scalars().all()
    )
    modules_by_course: dict = {}
    for m in modules:
        modules_by_course.setdefault(m.course_id, []).append(m)
    module_ids = [m.id for m in modules]

    lessons: list[Lesson] = []
    if module_ids:
        lessons = list(
            (
                await session.execute(
                    select(Lesson).where(Lesson.module_id.in_(module_ids), Lesson.published.is_(True))
                )
            )
            .scalars()
            .all()
        )
    module_to_course = {m.id: m.course_id for m in modules}
    lessons_by_course: dict = {}
    for lesson in lessons:
        # Query above filters on Lesson.module_id.in_(module_ids), so this is never None.
        assert lesson.module_id is not None
        course_id = module_to_course.get(lesson.module_id)
        if course_id:
            lessons_by_course.setdefault(course_id, []).append(lesson)

    # One bulk ownership check for every lesson across every course, rather than one
    # `has_access_to` round trip per lesson.
    granted_lesson_ids: set = set()
    if user_id and lessons:
        product_ids = await resolve_product_ids(user_id=uuid.UUID(user_id), session=session)
        granted_lesson_ids = await resolve_granted_content_ids(
            product_ids=product_ids, resource_type=ResourceType.LESSON, session=session
        )

    # One bulk product lookup for every lesson across every course — cheapest product
    # per lesson, resolved once, rather than one query per course.
    cheapest_product_by_lesson: dict = {}
    if lessons:
        product_result = await session.execute(
            select(ProductContent.content_id, Product)
            .join(Product, Product.id == ProductContent.product_id)
            .where(
                ProductContent.content_type == "lesson",
                ProductContent.content_id.in_([l.id for l in lessons]),
                Product.published.is_(True),
            )
            .order_by(Product.price_amount.desc())  # desc + overwrite => cheapest wins, same trick as questions.py
        )
        for lesson_id, product in product_result.all():
            cheapest_product_by_lesson[lesson_id] = product

    # Media durations for every video/mixed lesson, once — for the duration filter.
    media_lesson_ids = [
        l.id for l in lessons
        if _lesson_type_value(l.lesson_type) in ("video", "mixed")
    ]
    duration_by_lesson: dict = {}
    if media_lesson_ids:
        media_rows = await session.execute(
            select(Media.lesson_id, Media.duration_seconds).where(Media.lesson_id.in_(media_lesson_ids))
        )
        # `Media.duration_seconds` is nullable — a video row exists as soon as it is
        # uploaded, but its duration is only known once the encoder has probed it.
        # Unknown durations are dropped so the sum below can't do `int + None`; a
        # course then reports the duration of the lessons whose length is known.
        duration_by_lesson = {lid: dur for lid, dur in media_rows.all() if dur is not None}

    # Duration is in minutes. `Media.duration_seconds` is seconds, so it's divided
    # down (rounded up, so a 40-second lesson is "1 min" rather than 0). The authored
    # `Course.estimated_duration_minutes` is preferred where set — it covers reading
    # time, which no encoder can measure; computed video time is the fallback.
    video_seconds_by_course: dict = {}
    for lesson in lessons:
        assert lesson.module_id is not None
        course_id = module_to_course.get(lesson.module_id)
        if course_id and lesson.id in duration_by_lesson:
            video_seconds_by_course[course_id] = (
                video_seconds_by_course.get(course_id, 0) + duration_by_lesson[lesson.id]
            )

    duration_by_course: dict = {}
    for course in courses:
        if course.estimated_duration_minutes:
            duration_by_course[course.id] = course.estimated_duration_minutes
        elif course.id in video_seconds_by_course:
            duration_by_course[course.id] = max(1, math.ceil(video_seconds_by_course[course.id] / 60))

    # Apply course filters (level, duration) before building the output.
    filtered_courses = courses
    if level:
        filtered_courses = [c for c in filtered_courses if c.level and c.level.lower() == level.lower()]
    if min_duration is not None:
        filtered_courses = [
            c for c in filtered_courses
            if duration_by_course.get(c.id, 0) >= min_duration
        ]
    if max_duration is not None:
        # A course with unknown duration fails the upper bound rather than scoring 0
        # and satisfying every "under N minutes" filter — matching how min_duration
        # already treats it.
        filtered_courses = [
            c for c in filtered_courses
            if c.id in duration_by_course and duration_by_course[c.id] <= max_duration
        ]

    out: list[CourseSummaryOut] = []
    for course in filtered_courses:
        course_modules = modules_by_course.get(course.id, [])
        course_lessons = lessons_by_course.get(course.id, [])

        owned = any(lesson.id in granted_lesson_ids for lesson in course_lessons)

        product_out = None
        candidate_products = [
            cheapest_product_by_lesson[lesson.id]
            for lesson in course_lessons
            if lesson.id in cheapest_product_by_lesson
        ]
        if candidate_products:
            product = min(candidate_products, key=lambda p: p.price_amount)
            product_out = RelatedProductOut(
                slug=product.slug, name=product.name,
                price_amount=product.price_amount, currency=product.currency,
            )

        # Resolve cover image URL (best-effort)
        cover_url = None
        if course.cover_image_key:
            try:
                cover_url = generate_presigned_url(course.cover_image_key, expiry_seconds=3600)
            except Exception:  # noqa: BLE001
                pass

        duration_minutes = duration_by_course.get(course.id)

        out.append(
            CourseSummaryOut(
                id=str(course.id), slug=course.slug,
                title=course.title,
                subtitle=course.subtitle,
                description=course.description,
                section=sections_by_id[course.section_id],
                module_count=len(course_modules),
                lesson_count=len(course_lessons),
                owned=owned,
                cover_image_url=cover_url,
                level=course.level,
                estimated_duration_minutes=duration_minutes,
                product=product_out,
                rating=aggregate_rating(course.review_count, course.rating_sum),
                review_count=course.review_count or 0,
            )
        )
    return out


@router.get("/courses/{slug}", response_model=CourseDetailOut)
async def get_course(
    slug: str,
    session: AsyncSession = Depends(get_session),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
):
    """The course product page. Every lesson is listed with a type icon and lock state
    whether or not the visitor owns the course.

    Lessons/media/module-questions/entitlement are each resolved in one bulk query
    for the whole course, and the per-module assembly loop does no I/O.
    """
    result = await session.execute(select(Course).where(Course.slug == slug, Course.published.is_(True)))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    section = (await session.execute(select(Section).where(Section.id == course.section_id))).scalar_one()
    author = (await session.execute(select(Author).where(Author.id == course.author_id))).scalar_one()

    modules = (
        (await session.execute(select(Module).where(Module.course_id == course.id).order_by(Module.sort_order)))
        .scalars()
        .all()
    )
    module_ids = [m.id for m in modules]

    completed_lesson_ids: set[uuid.UUID] = set()
    if user_id:
        completed_lesson_ids = set(
            (
                await session.execute(
                    select(LessonProgress.lesson_id).where(
                        LessonProgress.user_id == uuid.UUID(user_id),
                        LessonProgress.completed.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )

    # All lessons across every module, once — then bucketed by module_id in Python.
    all_lessons: list[Lesson] = []
    if module_ids:
        all_lessons = list(
            (
                await session.execute(
                    select(Lesson)
                    .where(Lesson.module_id.in_(module_ids), Lesson.published.is_(True))
                    .order_by(Lesson.sort_order)
                )
            )
            .scalars()
            .all()
        )
    lessons_by_module: dict = {}
    for lesson in all_lessons:
        lessons_by_module.setdefault(lesson.module_id, []).append(lesson)
    all_lesson_ids = [l.id for l in all_lessons]

    # Media (for duration) for every video/mixed lesson, once.
    media_lesson_ids = [
        l.id for l in all_lessons if _lesson_type_value(l.lesson_type) in ("video", "mixed")
    ]
    duration_by_lesson: dict = {}
    if media_lesson_ids:
        media_rows = await session.execute(
            select(Media.lesson_id, Media.duration_seconds).where(Media.lesson_id.in_(media_lesson_ids))
        )
        duration_by_lesson = {lesson_id: duration for lesson_id, duration in media_rows.all()}

    # One bulk ownership check for every lesson in the course, rather than one
    # `has_access_to` round trip per lesson.
    granted_lesson_ids: set = set()
    if user_id and all_lesson_ids:
        product_ids = await resolve_product_ids(user_id=uuid.UUID(user_id), session=session)
        granted_lesson_ids = await resolve_granted_content_ids(
            product_ids=product_ids, resource_type=ResourceType.LESSON, session=session
        )

    # Module-attached questions for every module, once.
    module_question_rows_all = (
        (
            await session.execute(
                select(ModuleQuestion, Question)
                .join(Question, Question.id == ModuleQuestion.question_id)
                .where(ModuleQuestion.module_id.in_(module_ids), Question.published.is_(True))
                .order_by(ModuleQuestion.sort_order)
            )
        ).all()
        if module_ids
        else []
    )
    module_questions_by_module: dict = {}
    for mq, q in module_question_rows_all:
        module_questions_by_module.setdefault(mq.module_id, []).append(
            ModuleQuestionOut(id=str(q.id), slug=q.slug, title=q.title, sort_order=mq.sort_order)
        )

    # Published assessments for every module, once — same batched shape as the module
    # questions above, so adding the outline's assessment rows costs one query for the
    # whole page rather than one per module.
    assessment_by_module: dict = {}
    if module_ids:
        for row in (
            (
                await session.execute(
                    select(Assessment.module_id, Assessment.title).where(
                        Assessment.module_id.in_(module_ids),
                        Assessment.published.is_(True),
                    )
                )
            ).all()
        ):
            assessment_by_module[row[0]] = row[1]

    # Ledger row 92: distinguish "never owned" from "owned, then refunded". The gate
    # itself is untouched — `resolve_product_ids` already excludes revoked entitlements,
    # so this is purely about what the page is allowed to SAY, never about access.
    # One query, and only for a signed-in reader who does not currently own the course.
    access_ended_at: Optional[str] = None

    owned = False
    lesson_count = 0
    first_lesson_slug: Optional[str] = None
    module_outs: list[ModuleOut] = []
    for module in modules:
        lessons = lessons_by_module.get(module.id, [])
        lesson_outs: list[LessonOutlineOut] = []
        for lesson in lessons:
            lesson_count += 1
            if first_lesson_slug is None:
                first_lesson_slug = lesson.slug

            real_entitlement = lesson.id in granted_lesson_ids
            if real_entitlement:
                owned = True

            lesson_outs.append(
                LessonOutlineOut(
                    id=str(lesson.id),
                    slug=lesson.slug,
                    title=lesson.title,
                    lesson_type=_lesson_type_value(lesson.lesson_type),
                    sort_order=lesson.sort_order,
                    duration_seconds=duration_by_lesson.get(lesson.id),
                    locked=not real_entitlement,
                    completed=lesson.id in completed_lesson_ids,
                )
            )

        module_outs.append(
            ModuleOut(
                id=str(module.id),
                title=module.title,
                description=module.description,
                sort_order=module.sort_order,
                lessons=lesson_outs,
                questions=module_questions_by_module.get(module.id, []),
                has_assessment=module.id in assessment_by_module,
                assessment_title=assessment_by_module.get(module.id),
            )
        )

    # The price/[Buy the course] surface, resolved via product_contents rather than a
    # course-to-product FK that would assume a course is only ever sold on its own.
    related_products: list[RelatedProductOut] = []
    if all_lesson_ids:
        related_result = await session.execute(
            select(Product)
            .join(ProductContent, ProductContent.product_id == Product.id)
            .where(
                ProductContent.content_type == ResourceType.LESSON.value,
                ProductContent.content_id.in_(all_lesson_ids),
                Product.published.is_(True),
            )
            .distinct()
            .order_by(Product.price_amount)
        )
        related_products = [
            RelatedProductOut(slug=p.slug, name=p.name, price_amount=p.price_amount, currency=p.currency)
            for p in related_result.scalars().all()
        ]

    # Ledger row 92 — "owned, then refunded", resolved only when it can possibly apply:
    # a signed-in reader who does NOT currently own the course. One query, skipped
    # entirely for anonymous readers and for readers who still have access.
    if user_id and not owned and all_lesson_ids:
        revoked_row = await session.execute(
            select(Entitlement.revoked_at)
            .join(ProductContent, ProductContent.product_id == Entitlement.product_id)
            .where(
                Entitlement.user_id == uuid.UUID(user_id),
                Entitlement.revoked_at.is_not(None),
                ProductContent.content_type == ResourceType.LESSON.value,
                ProductContent.content_id.in_(all_lesson_ids),
            )
            # Most recent revocation wins: a reader who bought, refunded, re-bought and
            # refunded again should see the date their access actually ended, not the
            # first time it ever did.
            .order_by(Entitlement.revoked_at.desc())
            .limit(1)
        )
        revoked_at = revoked_row.scalar_one_or_none()
        if revoked_at is not None:
            access_ended_at = revoked_at.isoformat()

    # Resolve cover image URL (best-effort)
    cover_url = None
    if course.cover_image_key:
        try:
            cover_url = generate_presigned_url(course.cover_image_key, expiry_seconds=3600)
        except Exception:  # noqa: BLE001
            pass

    # Check for a certificate. One query, only for a signed-in reader who owns the
    # course — an anonymous or non-owner never has a certificate.
    completed = False
    cert_verification_code: Optional[str] = None
    if user_id and owned:
        cert_row = await session.execute(
            select(Certificate.verification_code).where(
                Certificate.user_id == uuid.UUID(user_id),
                Certificate.course_id == course.id,
                Certificate.revoked_at.is_(None),
            )
        )
        cert_code = cert_row.scalar_one_or_none()
        if cert_code is not None:
            completed = True
            cert_verification_code = cert_code

    return CourseDetailOut(
        id=str(course.id),
        slug=course.slug,
        title=course.title,
        subtitle=course.subtitle,
        description=course.description,
        section=section.name,
        author_name=author.name,
        author_bio=author.bio,
        owned=owned,
        lesson_count=lesson_count,
        first_lesson_slug=first_lesson_slug,
        cover_image_url=cover_url,
        modules=module_outs,
        related_products=related_products,
        access_ended_at=access_ended_at,
        completed=completed,
        certificate_verification_code=cert_verification_code,
        rating=aggregate_rating(course.review_count, course.rating_sum),
        review_count=course.review_count or 0,
    )
