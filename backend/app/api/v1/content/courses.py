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
from app.core.entitlements import ResourceType, has_access_to
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
    modules: list[ModuleOut]
    related_products: list[RelatedProductOut]


@router.get("/courses", response_model=list[CourseSummaryOut])
async def list_courses(
    session: AsyncSession = Depends(get_session),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
):
    """The course catalogue — public. `owned` is a real entitlement check, so a card
    never shows a price on something the visitor already holds."""
    result = await session.execute(
        select(Course).where(Course.published.is_(True)).order_by(Course.created_at)
    )
    courses = result.scalars().all()

    out: list[CourseSummaryOut] = []
    for course in courses:
        section = (await session.execute(select(Section).where(Section.id == course.section_id))).scalar_one()
        modules = (
            (await session.execute(select(Module).where(Module.course_id == course.id))).scalars().all()
        )
        module_ids = [m.id for m in modules]

        lessons: list[Lesson] = []
        if module_ids:
            lessons = (
                (
                    await session.execute(
                        select(Lesson).where(Lesson.module_id.in_(module_ids), Lesson.published.is_(True))
                    )
                )
                .scalars()
                .all()
            )

        owned = False
        if user_id and lessons:
            for lesson in lessons:
                if await has_access_to(
                    user_id=uuid.UUID(user_id),
                    resource_type=ResourceType.LESSON,
                    resource_id=lesson.id,
                    session=session,
                ):
                    owned = True
                    break

        product_out = None
        if lessons:
            product_result = await session.execute(
                select(Product)
                .join(ProductContent, ProductContent.product_id == Product.id)
                .where(
                    ProductContent.content_type == "lesson",
                    ProductContent.content_id.in_([l.id for l in lessons]),
                    Product.published.is_(True),
                )
                # Cheapest first — same load-bearing reason TemplateSummaryOut orders
                # this way: a lesson can theoretically be sold by more than one product,
                # and an unordered .first() would sometimes quote the wrong one.
                .order_by(Product.price_amount)
                .distinct()
            )
            product = product_result.scalars().first()
            if product:
                product_out = RelatedProductOut(
                    slug=product.slug, name=product.name,
                    price_amount=product.price_amount, currency=product.currency,
                )

        out.append(
            CourseSummaryOut(
                id=str(course.id),
                slug=course.slug,
                title=course.title,
                subtitle=course.subtitle,
                description=course.description,
                section=section.name,
                module_count=len(modules),
                lesson_count=len(lessons),
                owned=owned,
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
    whether or not the visitor owns the course."""
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

    owned = False
    lesson_count = 0
    first_lesson_slug: Optional[str] = None
    all_lesson_ids: list[uuid.UUID] = []
    module_outs: list[ModuleOut] = []
    for module in modules:
        lessons = (
            (
                await session.execute(
                    select(Lesson)
                    .where(Lesson.module_id == module.id, Lesson.published.is_(True))
                    .order_by(Lesson.sort_order)
                )
            )
            .scalars()
            .all()
        )
        lesson_outs: list[LessonOutlineOut] = []
        for lesson in lessons:
            lesson_count += 1
            all_lesson_ids.append(lesson.id)
            if first_lesson_slug is None:
                first_lesson_slug = lesson.slug

            real_entitlement = False
            if user_id:
                real_entitlement = await has_access_to(
                    user_id=uuid.UUID(user_id),
                    resource_type=ResourceType.LESSON,
                    resource_id=lesson.id,
                    session=session,
                )
            if real_entitlement:
                owned = True

            duration = None
            if _lesson_type_value(lesson.lesson_type) in ("video", "mixed"):
                media = (
                    await session.execute(select(Media).where(Media.lesson_id == lesson.id))
                ).scalar_one_or_none()
                duration = media.duration_seconds if media else None

            lesson_outs.append(
                LessonOutlineOut(
                    id=str(lesson.id),
                    slug=lesson.slug,
                    title=lesson.title,
                    lesson_type=_lesson_type_value(lesson.lesson_type),
                    sort_order=lesson.sort_order,
                    duration_seconds=duration,
                    locked=not real_entitlement,
                    completed=lesson.id in completed_lesson_ids,
                )
            )

        module_question_rows = (
            await session.execute(
                select(ModuleQuestion, Question)
                .join(Question, Question.id == ModuleQuestion.question_id)
                .where(ModuleQuestion.module_id == module.id, Question.published.is_(True))
                .order_by(ModuleQuestion.sort_order)
            )
        ).all()
        question_outs = [
            ModuleQuestionOut(id=str(q.id), slug=q.slug, title=q.title, sort_order=mq.sort_order)
            for mq, q in module_question_rows
        ]

        module_outs.append(
            ModuleOut(
                id=str(module.id),
                title=module.title,
                description=module.description,
                sort_order=module.sort_order,
                lessons=lesson_outs,
                questions=question_outs,
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
        modules=module_outs,
        related_products=related_products,
    )
