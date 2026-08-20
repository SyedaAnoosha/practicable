"""Course catalogue and public syllabus pages. This file only ever answers "what is in
this course and do I own it" — lesson content is served by lessons.py.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id_optional
from app.core.entitlements import ResourceType, resolve_granted_content_ids, resolve_product_ids
from app.db.models import (
    Author,
    Course,
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
    # week2_plan.md Phase 4 (`/store`'s ContentTypeCard needs a real price for every
    # type, W2-R5's "every price shown is real"). `/courses` never carried one before —
    # CoursesCatalogue.tsx simply didn't show one — so this mirrors TemplateSummaryOut's
    # existing cheapest-published-product resolution rather than inventing a second
    # pattern. None only when no published product currently sells this course.
    product: Optional[RelatedProductOut]


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


class CourseDetailOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    description: str
    section: str
    author_name: str
    owned: bool
    lesson_count: int
    first_lesson_slug: Optional[str]
    cover_image_url: Optional[str] = None
    modules: list[ModuleOut]
    related_products: list[RelatedProductOut]


@router.get("/courses", response_model=list[CourseSummaryOut])
async def list_courses(
    session: AsyncSession = Depends(get_session),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
):
    """The course catalogue — public. `owned` is a real entitlement check, so a card
    never shows a price on something the visitor already holds.

    `[FIXED]` This used to issue 3 queries per course (section, modules, lessons) plus,
    per lesson, a full `has_access_to` round trip (itself 2 queries) until an owned one
    was found, plus a product lookup per course — a query count proportional to the
    whole catalogue's course/lesson total, run serially. Each round trip to Postgres
    here costs on the order of hundreds of ms, so this page alone could take seconds.
    Everything below is now a fixed handful of bulk queries regardless of how many
    courses or lessons exist, with the per-course/per-lesson work done in memory.
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

    out: list[CourseSummaryOut] = []
    for course in courses:
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
                product=product_out,
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

    `[FIXED]` This used to issue one query for lessons, one for media, and one
    `has_access_to` round trip (itself 2 queries) PER LESSON, plus one module-questions
    query per module — all serial. Each round trip costs on the order of hundreds of ms
    against this DB, so a multi-module course could take seconds to load. Below,
    lessons/media/module-questions/entitlement are each resolved in one bulk query for
    the whole course, and the per-module assembly loop does no I/O.
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

    # Resolve cover image URL (best-effort)
    cover_url = None
    if course.cover_image_key:
        try:
            cover_url = generate_presigned_url(course.cover_image_key, expiry_seconds=3600)
        except Exception:  # noqa: BLE001
            pass

    return CourseDetailOut(
        id=str(course.id),
        slug=course.slug,
        title=course.title,
        subtitle=course.subtitle,
        description=course.description,
        section=section.name,
        author_name=author.name,
        owned=owned,
        lesson_count=lesson_count,
        first_lesson_slug=first_lesson_slug,
        cover_image_url=cover_url,
        modules=module_outs,
        related_products=related_products,
    )
